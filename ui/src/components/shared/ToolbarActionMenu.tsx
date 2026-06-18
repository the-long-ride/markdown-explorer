import { useEffect, useRef, useState } from "react";
import { createToolbarMenuItems, type ToolbarMenuItem } from "../../utils/toolbar-menu.js";
import {
  EditIcon,
  HomeIcon,
  SettingsIcon,
  MoonIcon,
  SunIcon,
} from "./icons";
import { TooltipButton } from "./TooltipButton";

interface ToolbarActionMenuProps {
  triggerTooltip: string;
  triggerAlign?: "left" | "right";
  homeLabel: string;
  themeLabel: string;
  editLabel: string;
  settingsLabel: string;
  homeTooltip: string;
  themeTooltip: string;
  editTooltip: string;
  settingsTooltip: string;
  homeShortcut?: string;
  themeShortcut?: string;
  settingsShortcut?: string;
  canEdit: boolean;
  isDark: boolean;
  hasUpdate?: boolean;
  onHome: () => void;
  onTheme: () => void;
  onEdit: () => void;
  onSettings: () => void;
}

function getItemIcon(item: ToolbarMenuItem, isDark: boolean) {
  switch (item.id) {
    case "home":
      return <HomeIcon size={13} />;
    case "theme":
      return isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />;
    case "edit":
      return <EditIcon size={12} />;
    case "settings":
      return <SettingsIcon size={14} />;
    default:
      return null;
  }
}

export function ToolbarActionMenu({
  triggerTooltip,
  triggerAlign = "right",
  homeLabel,
  themeLabel,
  editLabel,
  settingsLabel,
  homeTooltip,
  themeTooltip,
  editTooltip,
  settingsTooltip,
  homeShortcut,
  themeShortcut,
  settingsShortcut,
  canEdit,
  isDark,
  hasUpdate = false,
  onHome,
  onTheme,
  onEdit,
  onSettings,
}: ToolbarActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleClose = () => setOpen(false);

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
  }, [open]);

  const items = createToolbarMenuItems({
    labels: {
      home: homeLabel,
      theme: themeLabel,
      edit: editLabel,
      settings: settingsLabel,
    },
    tooltips: {
      home: homeTooltip,
      theme: themeTooltip,
      edit: editTooltip,
      settings: settingsTooltip,
    },
    shortcuts: {
      home: homeShortcut,
      theme: themeShortcut,
      settings: settingsShortcut,
    },
    canEdit,
  });

  const handleAction = (item: ToolbarMenuItem) => {
    setOpen(false);
    switch (item.id) {
      case "home":
        onHome();
        return;
      case "theme":
        onTheme();
        return;
      case "edit":
        onEdit();
        return;
      case "settings":
        onSettings();
        return;
    }
  };

  return (
    <div
      ref={menuRef}
      className={`toolbar-action-menu${open ? " is-open" : ""}`}
    >
      <TooltipButton
        className={`btn btn--icon${hasUpdate ? " has-update" : ""}`}
        onClick={() => setOpen((value) => !value)}
        tooltip={triggerTooltip}
        tooltipAlign={triggerAlign}
        icon={<SettingsIcon />}
        aria-expanded={open}
        aria-haspopup="menu"
      />
      {open && (
        <div
          className="toolbar-action-menu__panel"
          role="menu"
          aria-label={triggerTooltip}
        >
          {items.map((item) => (
            <TooltipButton
              key={item.id}
              type="button"
              role="menuitem"
              className={`toolbar-action-menu__item${item.id === "settings" ? " is-primary" : ""}`}
              onClick={() => handleAction(item)}
              tooltip={item.tooltip}
              icon={getItemIcon(item, isDark)}
              label={item.label}
              onlyIcon={false}
              disabled={item.disabled}
              tooltipPos="above"
              tooltipAlign="left"
            />
          ))}
        </div>
      )}
    </div>
  );
}
