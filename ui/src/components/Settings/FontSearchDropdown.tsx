import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Translations } from '../../contexts/translationTypes';
import type { DesktopFontBinding, DesktopFontFamily, DesktopFontSelection } from '../../desktop/fonts/fontModel';
import { findDesktopFontFamily } from '../../desktop/fonts/fontModel';
import { useCssVars } from '../../utils/useCssVars';
import { ChevronDownIcon, SearchIcon } from '../shared/icons';

type SearchChoice = {
  id: string;
  label: string;
  family?: DesktopFontFamily;
  selection: DesktopFontSelection;
};

function optionId(id: string) {
  return `font-search-option-${id.replace(/[^a-z0-9_-]/gi, '-')}`;
}

function FontSearchOption({
  id,
  font,
  active,
  keyboardActive,
  onPointerMove,
  onChoose,
  children,
}: {
  id: string;
  font: DesktopFontFamily;
  active: boolean;
  keyboardActive: boolean;
  onPointerMove: () => void;
  onChoose: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useCssVars(ref, { '--font-preview-family': font.cssFamily });
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      className={`font-search-menu__option${active ? ' is-selected' : ''}${keyboardActive ? ' is-keyboard-active' : ''}`}
      onPointerMove={onPointerMove}
      onClick={onChoose}
    >
      {children}
    </button>
  );
}

export function FontSearchDropdown({
  value,
  fonts,
  t,
  onChange,
}: {
  value: DesktopFontBinding;
  fonts: readonly DesktopFontFamily[];
  t: Translations;
  onChange: (selection: DesktopFontSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const naturalHeightRef = useRef(0);
  const selected = findDesktopFontFamily(value, fonts);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return fonts.filter((font) => !needle || font.family.toLocaleLowerCase().includes(needle));
  }, [fonts, query]);
  const system = filtered.filter((font) => font.source === 'system');
  const imported = filtered.filter((font) => font.source === 'imported');
  const choices = useMemo<SearchChoice[]>(() => [
    { id: 'default', label: t.fontDefault, selection: { source: 'default' } },
    ...system.map((font) => ({
      id: font.id,
      label: font.family,
      family: font,
      selection: { source: 'system' as const, family: font.family },
    })),
    ...imported.map((font) => ({
      id: font.id,
      label: font.family,
      family: font,
      selection: { source: 'imported' as const, family: font.family, id: font.id },
    })),
  ], [imported, system, t.fontDefault]);

  useEffect(() => setActiveIndex(0), [query, open]);

  const updatePosition = () => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const settingsCard = button.closest('.settings-card--settings') as HTMLElement | null;
    const boundary = settingsCard?.getBoundingClientRect() ?? { top: 0, right: window.innerWidth, bottom: window.innerHeight, left: 0 };
    const margin = 8;
    const gap = 5;
    // scrollHeight equals the constrained height once max-height is applied
    // (the menu is a flex column with overflow hidden), so only trust it as
    // the natural content height the first time, while unconstrained.
    if (!naturalHeightRef.current && menu.scrollHeight > 0) {
      naturalHeightRef.current = menu.scrollHeight;
    }
    const desiredHeight = Math.min(340, Math.max(1, naturalHeightRef.current || menu.scrollHeight));
    const roomBelow = Math.max(0, boundary.bottom - rect.bottom - gap - margin);
    const roomAbove = Math.max(0, rect.top - boundary.top - gap - margin);
    const openUp = desiredHeight > roomBelow && roomAbove > roomBelow;
    const availableHeight = openUp ? roomAbove : roomBelow;
    const maxHeight = Math.max(1, Math.min(desiredHeight, availableHeight || desiredHeight));
    const maxWidth = Math.max(1, boundary.right - boundary.left - margin * 2);
    const width = Math.min(Math.max(280, rect.width), maxWidth);
    const minLeft = Math.max(margin, boundary.left + margin);
    const maxLeft = Math.max(minLeft, Math.min(window.innerWidth - width - margin, boundary.right - width - margin));
    const left = Math.min(Math.max(minLeft, rect.left), maxLeft);
    const top = openUp
      ? Math.max(boundary.top + margin, rect.top - maxHeight - gap)
      : rect.bottom + gap;
    setPosition({ top, left, width, maxHeight });
  };

  useLayoutEffect(() => {
    if (!open) return;
    // Re-measure naturally on (re)open and when the option count changes:
    // lift the height constraint first so scrollHeight is the content height.
    menuRef.current?.style.setProperty('--menu-max-height', 'none');
    naturalHeightRef.current = 0;
    updatePosition();
    const onViewport = (event?: Event) => {
      // Scrolling inside the menu itself cannot move the anchor button.
      if (event && event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      updatePosition();
    };
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [open, choices.length]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const choose = (selection: DesktopFontSelection) => {
    onChange(selection);
    setOpen(false);
    setQuery('');
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => buttonRef.current?.focus());
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const length = Math.max(1, choices.length);
        return (current + delta + length) % length;
      });
      return;
    }
    if (event.key === 'Enter' && choices[activeIndex]) {
      event.preventDefault();
      choose(choices[activeIndex].selection);
    }
  };

  const renderGroup = (label: string, items: readonly DesktopFontFamily[]) => items.length > 0 && (
    <div className="font-search-menu__group">
      <div className="font-search-menu__group-label">{label}</div>
      {items.map((font) => {
        const choiceIndex = choices.findIndex((choice) => choice.id === font.id);
        const active = value.source === font.source && (font.source === 'imported' ? value.id === font.id : value.family === font.family);
        return (
          <FontSearchOption
            id={optionId(font.id)}
            key={font.id}
            font={font}
            active={active}
            keyboardActive={choiceIndex === activeIndex}
            onPointerMove={() => setActiveIndex(choiceIndex)}
            onChoose={() => choose(font.source === 'system'
              ? { source: 'system', family: font.family }
              : { source: 'imported', family: font.family, id: font.id })}
          >
            <span>{font.family}</span>
            <span className="font-search-menu__source">{font.source === 'system' ? t.fontSystem : t.fontImported}</span>
          </FontSearchOption>
        );
      })}
    </div>
  );

  const activeChoice = choices[activeIndex];
  const toggleOpen = () => {
    if (!open) setPosition(null);
    setOpen((current) => !current);
  };

  useCssVars(menuRef, position
    ? {
        '--menu-top': `${position.top}px`,
        '--menu-left': `${position.left}px`,
        '--menu-width': `${position.width}px`,
        '--menu-max-height': `${position.maxHeight}px`,
        '--menu-visibility': 'visible',
      }
    : { '--menu-visibility': 'hidden' });

  return (
    <div className={`font-search-dropdown${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="font-search-dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <span>{selected?.family ?? t.fontDefault}</span>
        <ChevronDownIcon size={11} className={`font-dropdown-chevron${open ? ' is-open' : ''}`} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="font-search-menu"
          role="listbox"
        >
          <label className="font-search-menu__search">
            <SearchIcon size={13} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder={t.fontSearchPlaceholder}
              aria-activedescendant={activeChoice ? optionId(activeChoice.id) : undefined}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </label>
          <div className="font-search-menu__results">
            <button
              id={optionId('default')}
              type="button"
              role="option"
              aria-selected={value.source === 'default'}
              className={`font-search-menu__option${value.source === 'default' ? ' is-selected' : ''}${activeIndex === 0 ? ' is-keyboard-active' : ''}`}
              onPointerMove={() => setActiveIndex(0)}
              onClick={() => choose({ source: 'default' })}
            >
              <span>{t.fontDefault}</span>
            </button>
            {renderGroup(t.fontSystem, system)}
            {renderGroup(t.fontImported, imported)}
            {system.length === 0 && imported.length === 0 && query && <div className="font-search-menu__empty">{t.fontNoResults}</div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
