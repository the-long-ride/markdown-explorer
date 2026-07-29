import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ResolvedLink } from '../../dom/linkContextMenu';
import { useCssVars } from '../../utils/useCssVars';
import { OpenInBrowserIcon } from './icons';

export interface LinkContextMenuState {
  x: number;
  y: number;
  anchor: HTMLAnchorElement;
  link: ResolvedLink;
}

interface LinkContextMenuProps {
  state: LinkContextMenuState;
  menuLabel: string;
  openLabel: string;
  copyLabel: string;
  onOpen: (link: ResolvedLink) => void;
  onCopy: (link: ResolvedLink) => void;
  onClose: () => void;
}

export function LinkContextMenu({
  state,
  menuLabel,
  openLabel,
  copyLabel,
  onOpen,
  onCopy,
  onClose,
}: LinkContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const menuCssVariables = useMemo(() => ({
    '--link-context-menu-left': `${state.x}px`,
    '--link-context-menu-top': `${state.y}px`,
  }), [state.x, state.y]);
  useCssVars(menuRef, menuCssVariables);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(state.x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(state.y, window.innerHeight - rect.height - 8));
    menu.style.setProperty('--link-context-menu-left', `${left}px`);
    menu.style.setProperty('--link-context-menu-top', `${top}px`);
    menu.querySelector<HTMLElement>('button:not([disabled])')?.focus();

    const close = (event: Event) => {
      if (event.type === 'pointerdown' && menu.contains(event.target as Node)) return;
      onClose();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = buttons[(current + delta + buttons.length) % buttons.length];
      next?.focus();
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', close, true);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('resize', close, true);
      window.removeEventListener('scroll', close, true);
      if (state.anchor.isConnected) state.anchor.focus({ preventScroll: true });
    };
  }, [onClose, state]);

  return createPortal(
    <div
      ref={menuRef}
      className="mdn-link-context-menu"
      role="menu"
      aria-label={menuLabel}
    >
      <button
        type="button"
        role="menuitem"
        disabled={!state.link.openable}
        onClick={() => onOpen(state.link)}
      >
        <OpenInBrowserIcon size={14} />
        <span>{openLabel}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!state.link.copyable}
        onClick={() => { void onCopy(state.link); }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>{copyLabel}</span>
      </button>
    </div>,
    document.body,
  );
}
