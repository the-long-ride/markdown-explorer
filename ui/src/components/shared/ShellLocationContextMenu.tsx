import { useEffect, useRef, type ReactNode } from 'react';
import { useCssVars } from '../../utils/useCssVars';

interface ShellLocationContextMenuProps {
  x: number;
  y: number;
  label: string;
  icon: ReactNode;
  onOpen: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 280;
const MENU_HEIGHT = 52;
const MENU_MARGIN = 8;

function clampPosition(value: number, max: number, size: number): number {
  return Math.max(MENU_MARGIN, Math.min(value, max - size - MENU_MARGIN));
}

export function ShellLocationContextMenu({
  x,
  y,
  label,
  icon,
  onOpen,
  onClose,
}: ShellLocationContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const left = typeof window === 'undefined'
    ? x
    : clampPosition(x, window.innerWidth || MENU_WIDTH + MENU_MARGIN * 2, MENU_WIDTH);
  const top = typeof window === 'undefined'
    ? y
    : clampPosition(y, window.innerHeight || MENU_HEIGHT + MENU_MARGIN * 2, MENU_HEIGHT);
  useCssVars(menuRef, { '--menu-left': `${left}px`, '--menu-top': `${top}px` });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handleClose = () => onClose();
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', handleClose);
    window.addEventListener('resize', handleClose);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', handleClose);
      window.removeEventListener('resize', handleClose);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="tab-context-menu shell-location-context-menu"
      role="menu"
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        className="tab-context-menu__item is-primary"
        onClick={() => {
          onOpen();
          onClose();
        }}
      >
        <span className="tab-context-menu__item-label">
          <span className="tab-context-menu__item-icon">{icon}</span>
          <span>{label}</span>
        </span>
      </button>
    </div>
  );
}
