import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { getTranslations } from "../../contexts/translations";
import { useCssVars } from "../../utils/useCssVars";
import { formatShortcutLabel } from "../../utils/shortcuts";

export type TabContextMenuAction =
  | "openInBrowser"
  | "toggleHtmlDocumentView"
  | "openLocation"
  | "openInSplit"
  | "moveToOtherPane"
  | "swapPanes"
  | "closeSplit"
  | "closeThisTab"
  | "closeTabsToRight"
  | "closeOtherTabs"
  | "closeAllTabs";

export interface TabContextMenuLabels {
  openLocation?: string;
  closeThisTab: string;
  closeTabsToRight: string;
  closeOtherTabs: string;
  closeAllTabs: string;
}

export interface TabContextMenuItem {
  action: TabContextMenuAction;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  hidden?: boolean;
  dividerBefore?: boolean;
  primary?: boolean;
}

export type TabContextMenuShortcuts = Partial<Record<TabContextMenuAction, string>>;

interface TabContextMenuProps {
  x: number;
  y: number;
  items?: readonly TabContextMenuItem[];
  labels?: TabContextMenuLabels;
  shortcuts?: TabContextMenuShortcuts;
  disabled?: Partial<Record<TabContextMenuAction, boolean>>;
  onAction: (action: TabContextMenuAction) => void;
  openLocationIcon?: ReactNode;
  closeThisTabIcon?: ReactNode;
  closeTabsToRightIcon?: ReactNode;
  closeOtherTabsIcon?: ReactNode;
  closeAllTabsIcon?: ReactNode;
  ariaLabel?: string;
  onClose: () => void;
}

const MENU_WIDTH = 300;
const MENU_MARGIN = 8;

function clampPosition(value: number, max: number, size: number): number {
  return Math.max(MENU_MARGIN, Math.min(value, Math.max(MENU_MARGIN, max - size - MENU_MARGIN)));
}

export function TabContextMenu({
  x,
  y,
  items,
  labels,
  shortcuts,
  disabled,
  onAction,
  openLocationIcon,
  closeThisTabIcon,
  closeTabsToRightIcon,
  closeOtherTabsIcon,
  closeAllTabsIcon,
  ariaLabel,
  onClose,
}: TabContextMenuProps) {
  const { state } = useAppState();
  const t = getTranslations(state.settings.language);
  const menuRef = useRef<HTMLDivElement>(null);
  const resolvedItems = useMemo<readonly TabContextMenuItem[]>(() => {
    if (items) return items.filter((item) => !item.hidden);
    if (!labels) return [];
    return [
      ...(labels.openLocation && openLocationIcon
        ? [{ action: "openLocation" as const, label: labels.openLocation, icon: openLocationIcon }]
        : []),
      { action: "closeThisTab", label: labels.closeThisTab, icon: closeThisTabIcon, shortcut: shortcuts?.closeThisTab, primary: true },
      { action: "closeTabsToRight", label: labels.closeTabsToRight, icon: closeTabsToRightIcon, shortcut: shortcuts?.closeTabsToRight },
      { action: "closeOtherTabs", label: labels.closeOtherTabs, icon: closeOtherTabsIcon, shortcut: shortcuts?.closeOtherTabs },
      { action: "closeAllTabs", label: labels.closeAllTabs, icon: closeAllTabsIcon, shortcut: shortcuts?.closeAllTabs },
    ];
  }, [
    closeAllTabsIcon,
    closeOtherTabsIcon,
    closeTabsToRightIcon,
    closeThisTabIcon,
    items,
    labels,
    openLocationIcon,
    shortcuts,
  ]);

  const left = typeof window === "undefined"
    ? x
    : clampPosition(x, window.innerWidth || MENU_WIDTH + MENU_MARGIN * 2, MENU_WIDTH);
  const estimatedHeight = Math.max(48, resolvedItems.length * 36 + 16);
  const top = typeof window === "undefined"
    ? y
    : clampPosition(y, window.innerHeight || estimatedHeight + MENU_MARGIN * 2, estimatedHeight);
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

  return (
    <div
      ref={menuRef}
      className="tab-context-menu"
      role="menu"
      aria-label={ariaLabel ?? t.ui.tabActions}
      onContextMenu={(event) => event.preventDefault()}
    >
      {resolvedItems.map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          className={`tab-context-menu__item${item.primary ? " is-primary" : ""}${item.dividerBefore ? " has-divider-before" : ""}`}
          disabled={item.disabled ?? disabled?.[item.action]}
          onClick={() => {
            onAction(item.action);
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
    </div>
  );
}
