import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCssVars } from '../../utils/useCssVars';

export interface ThemeRemixDropdownOption<T extends string> { value: T; label: string; }
export interface ThemeRemixDropdownProps<T extends string> { ariaLabel: string; value: T; options: readonly ThemeRemixDropdownOption<T>[]; onChange: (value: T) => void; }

export function ThemeRemixDropdown<T extends string>({ ariaLabel, value, options, onChange }: ThemeRemixDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  useCssVars(menuRef, menuPosition ? { '--menu-top': `${menuPosition.top}px`, '--menu-left': `${menuPosition.left}px`, '--menu-width': `${menuPosition.width}px` } : {});
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const updateMenuPosition = () => { const rect = selectRef.current?.getBoundingClientRect(); if (rect) setMenuPosition({ top: rect.bottom + 5, left: rect.left, width: rect.width }); };

  useLayoutEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => { if (!dropdownRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    updateMenuPosition();
    document.addEventListener('pointerdown', handlePointerDown); document.addEventListener('keydown', handleKeyDown); window.addEventListener('resize', updateMenuPosition); window.addEventListener('scroll', updateMenuPosition, true);
    return () => { document.removeEventListener('pointerdown', handlePointerDown); document.removeEventListener('keydown', handleKeyDown); window.removeEventListener('resize', updateMenuPosition); window.removeEventListener('scroll', updateMenuPosition, true); };
  }, [open]);

  return <div className={`theme-remix-dropdown${open ? ' is-open' : ''}`} ref={dropdownRef}><button type="button" className="theme-remix-select" ref={selectRef} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span className="theme-remix-select__label">{selectedOption?.label ?? value}</span><span className="pet-theme-select__chevron" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></span></button>{open && menuPosition && createPortal(<div ref={menuRef} className="theme-remix-menu theme-remix-menu--portal" role="listbox" aria-label={ariaLabel}>{options.map((option) => { const selected = option.value === value; return <button key={option.value} type="button" role="option" aria-selected={selected} className={`theme-remix-menu__option${selected ? ' is-selected' : ''}`} onClick={() => { onChange(option.value); setOpen(false); }}><span className="theme-remix-menu__mark" aria-hidden="true" /><span className="theme-remix-menu__label">{option.label}</span></button>; })}</div>, document.body)}</div>;
}
