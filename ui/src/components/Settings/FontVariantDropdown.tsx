import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Translations } from '../../contexts/translationTypes';
import {
  getDesktopFontVariantOptions,
  type DesktopFontBinding,
  type DesktopFontFamily,
  type DesktopFontStyle,
} from '../../desktop/fonts/fontModel';
import { ChevronDownIcon } from '../shared/icons';

const MAX_VISIBLE_VARIANTS = 7;

function variantLabel(style: DesktopFontStyle, weight: number, t: Translations) {
  return `${style === 'italic' ? t.fontItalic : t.fontNormal} ${weight}`;
}

function optionId(style: DesktopFontStyle, weight: number) {
  return `font-variant-option-${style}-${weight}`;
}

export function FontVariantDropdown({
  family,
  value,
  t,
  onChange,
}: {
  family: DesktopFontFamily | undefined;
  value: DesktopFontBinding;
  t: Translations;
  onChange: (variant: { style: DesktopFontStyle; weight: number }) => void;
}) {
  const options = getDesktopFontVariantOptions(family);
  const disabled = value.source === 'default' || options.length === 0;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.style === value.style && option.weight === value.weight));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    const label = variantLabel(value.style, value.weight, t);
    return value.source === 'default' ? `${t.fontDefault} · ${label}` : label;
  }, [t, value.source, value.style, value.weight]);

  useEffect(() => {
    if (!open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  const closeMenu = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange({ style: option.style, weight: option.weight });
    closeMenu();
  };

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const rowHeight = 34;
    const desiredHeight = Math.min(MAX_VISIBLE_VARIANTS, Math.max(1, options.length)) * rowHeight + 10;
    const roomBelow = window.innerHeight - rect.bottom - margin;
    const roomAbove = rect.top - margin;
    const maxHeight = Math.max(rowHeight + 10, Math.min(desiredHeight, Math.max(roomBelow, roomAbove)));
    const openUp = roomBelow < Math.min(desiredHeight, rowHeight * 4) && roomAbove > roomBelow;
    const top = openUp
      ? Math.max(margin, rect.top - maxHeight - 5)
      : Math.min(window.innerHeight - maxHeight - margin, rect.bottom + 5);
    const width = Math.max(180, rect.width);
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));
    setPosition({ top, left, width, maxHeight });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
    const reposition = () => updatePosition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    requestAnimationFrame(() => menuRef.current?.focus());
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        closeMenu(false);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const moveActive = (delta: number) => {
    setActiveIndex((current) => {
      const length = Math.max(1, options.length);
      return (current + delta + length) % length;
    });
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(event.key === 'ArrowDown' ? selectedIndex : Math.max(0, options.length - 1));
      setOpen(true);
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(activeIndex);
    }
  };

  const activeOption = options[activeIndex];

  return (
    <div className="font-variant-dropdown" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="font-variant-dropdown__trigger"
        disabled={disabled}
        aria-label={t.fontVariant}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon size={11} className={`font-dropdown-chevron${open ? ' is-open' : ''}`} />
      </button>
      {open && position && createPortal(
        <div
          ref={menuRef}
          className="font-variant-menu"
          role="listbox"
          tabIndex={-1}
          aria-label={t.fontVariant}
          aria-activedescendant={activeOption ? optionId(activeOption.style, activeOption.weight) : undefined}
          onKeyDown={handleMenuKeyDown}
          style={{ position: 'fixed', top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}
        >
          {options.map((option, index) => {
            const selected = option.style === value.style && option.weight === value.weight;
            return (
              <button
                id={optionId(option.style, option.weight)}
                key={`${option.style}:${option.weight}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`font-variant-menu__option${selected ? ' is-selected' : ''}${index === activeIndex ? ' is-keyboard-active' : ''}`}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                {variantLabel(option.style, option.weight, t)}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
