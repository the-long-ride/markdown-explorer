import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ResolvedLink } from '../../dom/linkContextMenu';
import { useCssVars } from '../../utils/useCssVars';
import { AddBookmarkIcon } from '../Bookmarks/BookmarkIcons';
import { CopyIcon, OpenInBrowserIcon, SaveImageIcon } from './icons';

export interface LinkContextMenuState {
  x: number;
  y: number;
  anchor?: HTMLAnchorElement | null;
  bookmarkTarget?: Element | null;
  link?: ResolvedLink | null;
  imageTarget?: HTMLElement | SVGElement | null;
}

interface LinkContextMenuProps {
  state: LinkContextMenuState;
  menuLabel: string;
  openLabel: string;
  copyLabel: string;
  copyImageLabel?: string;
  saveImageLabel?: string;
  bookmarkLabel?: string;
  onOpen?: (link: ResolvedLink) => void;
  onCopy?: (link: ResolvedLink) => void;
  onCopyImage?: (target: HTMLElement | SVGElement) => void;
  onSaveImage?: (target: HTMLElement | SVGElement) => void;
  onBookmark?: () => void;
  onClose: () => void;
}

export function LinkContextMenu({
  state,
  menuLabel,
  openLabel,
  copyLabel,
  copyImageLabel,
  saveImageLabel,
  bookmarkLabel,
  onOpen,
  onCopy,
  onCopyImage,
  onSaveImage,
  onBookmark,
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
      if (state.anchor?.isConnected) state.anchor.focus({ preventScroll: true });
    };
  }, [onClose, state]);

  return createPortal(
    <div
      ref={menuRef}
      className="mdn-link-context-menu"
      role="menu"
      aria-label={menuLabel}
    >
      {state.imageTarget && onCopyImage && copyImageLabel && (
        <button
          type="button"
          role="menuitem"
          onClick={() => onCopyImage(state.imageTarget!)}
        >
          <CopyIcon size={14} />
          <span>{copyImageLabel}</span>
        </button>
      )}
      {state.imageTarget && onSaveImage && saveImageLabel && (
        <button
          type="button"
          role="menuitem"
          onClick={() => onSaveImage(state.imageTarget!)}
        >
          <SaveImageIcon size={14} />
          <span>{saveImageLabel}</span>
        </button>
      )}
      {state.link && onOpen && (
        <button
          type="button"
          role="menuitem"
          disabled={!state.link.openable}
          onClick={() => onOpen(state.link!)}
        >
          <OpenInBrowserIcon size={14} />
          <span>{openLabel}</span>
        </button>
      )}
      {state.link && onCopy && (
        <button
          type="button"
          role="menuitem"
          disabled={!state.link.copyable}
          onClick={() => { void onCopy(state.link!); }}
        >
          <CopyIcon size={14} />
          <span>{copyLabel}</span>
        </button>
      )}
      {onBookmark && bookmarkLabel && (
        <button type="button" role="menuitem" onClick={onBookmark}>
          <AddBookmarkIcon size={14} />
          <span>{bookmarkLabel}</span>
        </button>
      )}
    </div>,
    document.body,
  );
}
