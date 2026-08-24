import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ResolvedLink } from '../../dom/linkContextMenu';
import { useCssVars } from '../../utils/useCssVars';
import { AddBookmarkIcon } from '../Bookmarks/BookmarkIcons';
import { CopyIcon, OpenInBrowserIcon, SaveImageIcon } from './icons';

interface ScopeIconProps {
  size?: number;
}

function ScopeIcon({ size = 16 }: ScopeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 122.881 122.88" fill="currentColor" aria-hidden="true">
      <path d="M61.44,35.174c7.253,0,13.82,2.94,18.572,7.694c4.754,4.753,7.693,11.319,7.693,18.572c0,7.253-2.939,13.819-7.693,18.572 c-4.752,4.754-11.318,7.694-18.572,7.694c-7.252,0-13.819-2.94-18.572-7.694c-4.753-4.753-7.693-11.319-7.693-18.572 c0-7.252,2.94-13.819,7.693-18.572C47.621,38.114,54.188,35.174,61.44,35.174L61.44,35.174z M61.44,0 c16.966,0,32.326,6.877,43.445,17.996s17.996,26.479,17.996,43.444c0,16.967-6.877,32.326-17.996,43.444 C93.766,116.003,78.406,122.88,61.44,122.88c-16.966,0-32.325-6.877-43.444-17.996C6.877,93.766,0,78.406,0,61.439 c0-16.965,6.877-32.325,17.996-43.444C29.115,6.877,44.474,0,61.44,0L61.44,0z M100.012,22.869 C90.141,12.998,76.504,6.893,61.44,6.893c-15.063,0-28.7,6.105-38.571,15.976C12.999,32.74,6.893,46.376,6.893,61.439 c0,15.063,6.105,28.701,15.976,38.571c9.871,9.871,23.508,15.976,38.571,15.976c15.064,0,28.701-6.104,38.572-15.976 c9.869-9.87,15.975-23.508,15.975-38.571C115.986,46.376,109.881,32.74,100.012,22.869L100.012,22.869z M75.139,47.741 c-3.506-3.505-8.348-5.674-13.699-5.674c-5.35,0-10.193,2.168-13.698,5.674c-3.506,3.505-5.674,8.349-5.674,13.698 c0,5.351,2.168,10.193,5.674,13.699c3.505,3.505,8.349,5.674,13.698,5.674c5.351,0,10.193-2.169,13.699-5.674 c3.506-3.506,5.674-8.349,5.674-13.699C80.813,56.09,78.645,51.247,75.139,47.741L75.139,47.741z" />
    </svg>
  );
}

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
  scopeLabel?: string;
  onOpen?: (link: ResolvedLink) => void;
  onOpenScope?: () => void;
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
  scopeLabel,
  onOpen,
  onOpenScope,
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
      {state.link && onOpenScope && scopeLabel && (
        <button type="button" role="menuitem" onClick={onOpenScope}>
          <ScopeIcon size={14} />
          <span>{scopeLabel}</span>
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
