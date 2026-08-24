import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCssVars } from '../../utils/useCssVars';
import { ChevronDownIcon, SearchIcon } from './icons';

export interface SearchableSelectOption {
  value: string;
  label: string;
  detail?: string;
}

interface SearchableSelectRowProps {
  option: SearchableSelectOption;
  active: boolean;
  selected: boolean;
  onSelect: (value: string) => void;
  onActivate: (index: number) => void;
  index: number;
}

// Row is memoized so hovering the list only re-renders the two affected rows,
// not the whole option list — large folder lists stay interactive.
const SearchableSelectRow = memo(function SearchableSelectRow({
  option, active, selected, onSelect, onActivate, index,
}: SearchableSelectRowProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`searchable-select__option${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}
      onPointerMove={() => onActivate(index)}
      onClick={() => onSelect(option.value)}
    >
      <span>{option.label}</span>
      {option.detail && <small>{option.detail}</small>}
    </button>
  );
});

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  searchPlaceholder = 'Search',
  emptyLabel = 'No matches',
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly SearchableSelectOption[];
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.detail ?? ''}`.toLocaleLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => setActiveIndex(0), [open, query]);

  // The menu renders in a body portal so panel overflow cannot clip it.
  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const desiredHeight = Math.min(260, Math.max(1, filtered.length) * 30 + 44);
    const roomBelow = window.innerHeight - rect.bottom - margin;
    const roomAbove = rect.top - margin;
    const openUp = roomBelow < Math.min(160, desiredHeight) && roomAbove > roomBelow;
    const maxHeight = openUp
      ? Math.max(80, Math.min(desiredHeight, roomAbove - 5))
      : Math.max(80, Math.min(desiredHeight, roomBelow - 5));
    const width = Math.max(200, rect.width);
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));

    setMenuPosition((current) => {
      // Reuse the previous object when nothing moved so scroll storms do not re-render.
      const next = openUp
        ? { bottom: window.innerHeight - rect.top + 4, left, width, maxHeight }
        : { top: rect.bottom + 4, left, width, maxHeight };
      if (
        current &&
        current.left === next.left &&
        current.width === next.width &&
        current.maxHeight === next.maxHeight &&
        current.top === ('top' in next ? next.top : undefined) &&
        current.bottom === ('bottom' in next ? next.bottom : undefined)
      ) return current;
      return next;
    });
  }, [filtered.length]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    const reposition = () => updateMenuPosition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useCssVars(menuRef, menuPosition ? {
    '--menu-top': menuPosition.top !== undefined ? `${menuPosition.top}px` : undefined,
    '--menu-bottom': menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : undefined,
    '--menu-left': `${menuPosition.left}px`,
    '--menu-width': `${menuPosition.width}px`,
    '--menu-max-height': `${menuPosition.maxHeight}px`,
  } : {});

  const choose = useCallback((nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const activate = useCallback((index: number) => {
    setActiveIndex((current) => (current === index ? current : index));
  }, []);

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => {
        const length = Math.max(1, filtered.length);
        return (index + delta + length) % length;
      });
      return;
    }
    if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex].value);
    }
  };

  return (
    <div className={`searchable-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls="searchable-select-options"
        className="searchable-select__trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? label}</span>
        <ChevronDownIcon size={11} />
      </button>
      {open && menuPosition && createPortal(
        <div ref={menuRef} className="searchable-select__menu searchable-select__menu--portal">
          <label className="searchable-select__search">
            <SearchIcon size={13} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </label>
          <div id="searchable-select-options" role="listbox" className="searchable-select__options">
            {filtered.map((option, index) => (
              <SearchableSelectRow
                key={option.value}
                index={index}
                option={option}
                active={index === activeIndex}
                selected={option.value === value}
                onSelect={choose}
                onActivate={activate}
              />
            ))}
            {filtered.length === 0 && <div className="searchable-select__empty">{emptyLabel}</div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
