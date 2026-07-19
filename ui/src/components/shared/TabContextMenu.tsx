import { useEffect, useRef } from "react";
import { useCssVars } from "../../utils/useCssVars";
import { formatShortcutLabel } from "../../utils/shortcuts";

export type TabContextMenuAction =
  | "closeThisTab"
  | "closeTabsToRight"
  | "closeOtherTabs"
  | "closeAllTabs";

export interface TabContextMenuLabels {
  closeThisTab: string;
  closeTabsToRight: string;
  closeOtherTabs: string;
  closeAllTabs: string;
}

export type TabContextMenuShortcuts = Partial<Record<TabContextMenuAction, string>>;

interface TabContextMenuProps {
  x: number;
  y: number;
  labels: TabContextMenuLabels;
  shortcuts?: TabContextMenuShortcuts;
  disabled?: Partial<Record<TabContextMenuAction, boolean>>;
  onAction: (action: TabContextMenuAction) => void;
  onClose: () => void;
}

const MENU_WIDTH = 280;
const MENU_HEIGHT = 142;
const MENU_MARGIN = 8;

function clampPosition(value: number, max: number, size: number): number {
  return Math.max(MENU_MARGIN, Math.min(value, max - size - MENU_MARGIN));
}

export function TabContextMenu({
  x,
  y,
  labels,
  shortcuts,
  disabled,
  onAction,
  onClose,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const left = typeof window === "undefined"
    ? x
    : clampPosition(x, window.innerWidth || MENU_WIDTH + MENU_MARGIN * 2, MENU_WIDTH);
  const top = typeof window === "undefined"
    ? y
    : clampPosition(y, window.innerHeight || MENU_HEIGHT + MENU_MARGIN * 2, MENU_HEIGHT);
  useCssVars(menuRef, { '--menu-left': `${left}px`, '--menu-top': `${top}px` });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handleClose = () => onClose();

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", handleClose);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", handleClose);
      window.removeEventListener("resize", handleClose);
    };
  }, [onClose]);

  const items: readonly { action: TabContextMenuAction; label: string; shortcut?: string }[] = [
    { action: "closeThisTab", label: labels.closeThisTab, shortcut: shortcuts?.closeThisTab },
    { action: "closeTabsToRight", label: labels.closeTabsToRight, shortcut: shortcuts?.closeTabsToRight },
    { action: "closeOtherTabs", label: labels.closeOtherTabs, shortcut: shortcuts?.closeOtherTabs },
    { action: "closeAllTabs", label: labels.closeAllTabs, shortcut: shortcuts?.closeAllTabs },
  ];

  return (
    <div
      ref={menuRef}
      className="tab-context-menu"
      role="menu"
      aria-label="Tab actions"
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          className={`tab-context-menu__item${item.action === "closeThisTab" ? " is-primary" : ""}`}
          disabled={disabled?.[item.action]}
          onClick={() => {
            onAction(item.action);
            onClose();
          }}
        >
          <span>{item.label}</span>
          {item.shortcut ? <kbd>{formatShortcutLabel(item.shortcut, ' + ')}</kbd> : null}
        </button>
      ))}
    </div>
  );
}
