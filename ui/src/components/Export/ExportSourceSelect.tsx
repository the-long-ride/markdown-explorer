// =============================================================================
// components/Export/ExportSourceSelect.tsx — dropdown styled like theme selects
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCssVars } from '../../utils/useCssVars';

export interface ExportSourceSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ExportSourceSelectProps {
  value: string;
  options: readonly ExportSourceSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

const MAX_VISIBLE_SOURCE_ITEMS = 6;

function getSourceMenuDesiredHeight(itemCount: number) {
  const rowHeight = 30;
  const items = Math.min(MAX_VISIBLE_SOURCE_ITEMS, Math.max(1, itemCount));
  return rowHeight * items + 10;
}

export function ExportSourceSelect({ value, options, onChange, ariaLabel }: ExportSourceSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value) ?? options[0];

  const updateMenuPosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const desiredHeight = getSourceMenuDesiredHeight(options.length);
    const roomBelow = window.innerHeight - rect.bottom - margin;
    const roomAbove = rect.top - margin;
    const openUp = roomBelow < Math.min(180, desiredHeight) && roomAbove > roomBelow;
    const maxHeight = openUp
      ? Math.max(80, Math.min(desiredHeight, roomAbove - 5))
      : Math.max(80, Math.min(desiredHeight, roomBelow - 5));
    const width = Math.max(200, rect.width);
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));

    setMenuPosition((current) => {
      // Reuse the previous object when nothing moved so scroll storms do not re-render.
      const top = openUp ? undefined : rect.bottom + 5;
      const bottom = openUp ? window.innerHeight - rect.top + 5 : undefined;
      if (
        current &&
        current.left === left &&
        current.width === width &&
        current.maxHeight === maxHeight &&
        current.top === top &&
        current.bottom === bottom
      ) return current;
      return { top, bottom, left, width, maxHeight };
    });
  };

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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useCssVars(menuRef, menuPosition ? {
    '--menu-top': menuPosition.top !== undefined ? `${menuPosition.top}px` : undefined,
    '--menu-bottom': menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : undefined,
    '--menu-left': `${menuPosition.left}px`,
    '--menu-width': `${menuPosition.width}px`,
    '--menu-max-height': `${menuPosition.maxHeight}px`,
  } : {});

  const choose = (option: ExportSourceSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`export-source-select${open ? ' is-open' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className="export-source-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="export-source-select__label">{selected?.label ?? ''}</span>
        <span className="pet-theme-select__chevron" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>
      {open && menuPosition && createPortal(
        <div ref={menuRef} className="export-source-menu export-source-menu--portal" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              className={`export-source-menu__option${option.value === value ? ' is-selected' : ''}${option.disabled ? ' is-disabled' : ''}`}
              onClick={() => choose(option)}
            >
              <span className="export-source-menu__label">{option.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
