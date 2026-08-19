import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, SearchIcon } from './icons';

export interface SearchableSelectOption {
  value: string;
  label: string;
  detail?: string;
}

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
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return options.filter((option) => {
      if (!needle) return true;
      return `${option.label} ${option.detail ?? ''}`.toLocaleLowerCase().includes(needle);
    });
  }, [options, query]);

  useEffect(() => setActiveIndex(0), [open, query]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  };

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
      {open && (
        <div className="searchable-select__menu">
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
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`searchable-select__option${index === activeIndex ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}`}
                key={option.value}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {option.detail && <small>{option.detail}</small>}
              </button>
            ))}
            {filtered.length === 0 && <div className="searchable-select__empty">{emptyLabel}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
