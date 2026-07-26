import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useCssVars } from '../../utils/useCssVars';
import { formatShortcutLabel } from '../../utils/shortcuts';
import {
  computeSidebarItemMenuPosition,
  type SidebarItemMenuPosition,
} from './sidebarItemMenuPosition';

export interface SidebarItemMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  dividerBefore?: boolean;
  onSelect: () => void;
}

export interface SidebarItemMenuProps {
  anchor: HTMLElement;
  sidebar: HTMLElement;
  menuLabel: string;
  items: readonly SidebarItemMenuItem[];
  onClose: () => void;
}

export function SidebarItemMenu({
  anchor,
  sidebar,
  menuLabel,
  items,
  onClose,
}: SidebarItemMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<SidebarItemMenuPosition>({
    left: 0,
    top: 0,
    placement: 'below',
  });

  const updatePosition = useCallback(() => {
    if (!anchor.isConnected || !sidebar.isConnected) {
      onClose();
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const menuRect = menuRef.current?.getBoundingClientRect();
    setPosition(computeSidebarItemMenuPosition({
      anchorRect,
      sidebarRect,
      menuWidth: menuRect?.width || 248,
      menuHeight: menuRect?.height || Math.max(44, items.length * 36 + 8),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
  }, [anchor, items.length, onClose, sidebar]);

  useLayoutEffect(() => {
    updatePosition();
    firstActionRef.current?.focus();
  }, [items, updatePosition]);

  const menuCssVariables = useMemo(() => ({
    '--sidebar-item-menu-left': `${position.left}px`,
    '--sidebar-item-menu-top': `${position.top}px`,
  }), [position.left, position.top]);
  useCssVars(menuRef, menuCssVariables);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        menuRef.current?.contains(event.target as Node)
        || anchor.contains(event.target as Node)
      ) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handleScrollOrResize = () => onClose();
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [anchor, onClose]);

  if (items.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="tab-context-menu sidebar-item-menu"
      data-placement={position.placement}
      role="menu"
      aria-label={menuLabel}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={index === 0 ? firstActionRef : undefined}
          autoFocus={index === 0}
          type="button"
          className={`tab-context-menu__item${item.dividerBefore ? ' has-divider-before' : ''}`}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          <span className="tab-context-menu__item-icon">{item.icon}</span>
          <span className="tab-context-menu__item-label">{item.label}</span>
          {item.shortcut ? (
            <kbd className="tab-context-menu__item-shortcut">
              {formatShortcutLabel(item.shortcut, ' + ')}
            </kbd>
          ) : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}
