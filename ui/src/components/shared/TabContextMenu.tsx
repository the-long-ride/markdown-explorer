import { useEffect, useRef } from "react";

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

interface TabContextMenuProps {
  x: number;
  y: number;
  labels: TabContextMenuLabels;
  disabled?: Partial<Record<TabContextMenuAction, boolean>>;
  onAction: (action: TabContextMenuAction) => void;
  onClose: () => void;
}

const MENU_WIDTH = 220;
const MENU_HEIGHT = 142;
const MENU_MARGIN = 8;

function clampPosition(value: number, max: number, size: number): number {
  return Math.max(MENU_MARGIN, Math.min(value, max - size - MENU_MARGIN));
}

export function TabContextMenu({
  x,
  y,
  labels,
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

  const items: readonly { action: TabContextMenuAction; label: string }[] = [
    { action: "closeThisTab", label: labels.closeThisTab },
    { action: "closeTabsToRight", label: labels.closeTabsToRight },
    { action: "closeOtherTabs", label: labels.closeOtherTabs },
    { action: "closeAllTabs", label: labels.closeAllTabs },
  ];

  return (
    <div
      ref={menuRef}
      className="tab-context-menu"
      style={{ left, top }}
      role="menu"
      aria-label="Tab actions"
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          className={`tab-context-menu__item${index === 0 ? " is-primary" : ""}`}
          disabled={disabled?.[item.action]}
          onClick={() => {
            onAction(item.action);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
