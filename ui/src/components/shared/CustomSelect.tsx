import { useEffect, useRef, useState } from 'react';

export interface CustomSelectOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
  readonly badge?: string;
  readonly disabled?: boolean;
}

export interface CustomSelectProps<T extends string = string> {
  readonly id?: string;
  readonly 'aria-label'?: string;
  readonly value: T;
  readonly options: readonly CustomSelectOption<T>[];
  readonly onChange: (value: T) => void;
  readonly className?: string;
  readonly disabled?: boolean;
}

export function CustomSelect<T extends string = string>({
  id,
  'aria-label': ariaLabel,
  value,
  options,
  onChange,
  className = '',
  disabled = false,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (val: T) => {
    onChange(val);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
        const idx = options.findIndex(opt => opt.value === value);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        const target = options[focusedIndex];
        if (!target.disabled) handleSelect(target.value);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      id={id}
      className={`custom-select ${className}${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <select
        className="custom-select__native"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={e => onChange(e.target.value as T)}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="custom-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen(prev => !prev);
          const idx = options.findIndex(opt => opt.value === value);
          setFocusedIndex(idx >= 0 ? idx : 0);
        }}
      >
        <span className="custom-select__label">{selectedOption?.label ?? value}</span>
        <span className="custom-select__arrow" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <ul className="custom-select__menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={`custom-select__option${isSelected ? ' is-selected' : ''}${isFocused ? ' is-focused' : ''}${opt.disabled ? ' is-disabled' : ''}`}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <span className="custom-select__option-text">{opt.label}</span>
                {opt.badge && <span className="custom-select__option-badge">{opt.badge}</span>}
                {isSelected && <span className="custom-select__option-check" aria-hidden="true">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
