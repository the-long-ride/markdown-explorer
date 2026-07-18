import { useEffect, useRef, useState } from "react";
import { buildShortcutTooltip } from "../../utils/toolbar-menu.js";
import {
  EditIcon,
  HomeIcon,
  SettingsIcon,
  MoonIcon,
  SunIcon,
  SidebarIcon,
  TocIcon,
  MinimizeIcon,
  MaximizeIcon,
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
  showEdit?: boolean;
  onHome: () => void;
  onTheme: () => void;
  onEdit: () => void;
  onSettings: () => void;

  sidebarLabel?: string;
  sidebarTooltip?: string;
  sidebarShortcut?: string;
  sidebarActive?: boolean;
  onSidebarToggle?: () => void;

  tocLabel?: string;
  tocTooltip?: string;
  tocShortcut?: string;
  tocActive?: boolean;
  tocToggleDisabled?: boolean;
  onTocToggle?: () => void;

  focusModeLabel?: string;
  focusModeTooltip?: string;
  focusModeShortcut?: string;
  isFocusMode?: boolean;
  onFocusModeToggle?: () => void;
  fullscreenLabel?: string;
  fullscreenTooltip?: string;
  fullscreenShortcut?: string;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
}

function getItemIcon(id: string, isDark: boolean, isFocusMode: boolean) {
  switch (id) {
    case "home":
      return <HomeIcon size={13} />;
    case "theme":
      return isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />;
    case "edit":
      return <EditIcon size={12} />;
    case "sidebar":
      return <SidebarIcon size={14} />;
    case "toc":
      return <TocIcon size={14} />;
    case "focusMode":
      return isFocusMode ? <MinimizeIcon size={12} /> : <MaximizeIcon size={12} />;
    case "fullscreen":
      return <MaximizeIcon size={12} />;
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
  showEdit = true,
  onHome,
  onTheme,
  onEdit,
  onSettings,
  sidebarLabel,
  sidebarTooltip,
  sidebarShortcut,
  sidebarActive = false,
  onSidebarToggle,
  tocLabel,
  tocTooltip,
  tocShortcut,
  tocActive = false,
  tocToggleDisabled = false,
  onTocToggle,
  focusModeLabel,
  focusModeTooltip,
  focusModeShortcut,
  isFocusMode = false,
  onFocusModeToggle,
  fullscreenLabel,
  fullscreenTooltip,
  fullscreenShortcut,
  isFullscreen = false,
  onFullscreenToggle,
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

  const items: Array<{
    id: string;
    label: string;
    tooltip: string;
    disabled: boolean;
    toggleState?: boolean;
  }> = [
    {
      id: "home",
      label: homeLabel,
      tooltip: buildShortcutTooltip(homeTooltip, homeShortcut),
      disabled: false,
    },
    {
      id: "theme",
      label: themeLabel,
      tooltip: buildShortcutTooltip(themeTooltip, themeShortcut),
      disabled: false,
    },
  ];

  if (showEdit) {
    items.push({
      id: "edit",
      label: editLabel,
      tooltip: buildShortcutTooltip(editTooltip),
      disabled: !canEdit,
    });
  }

  if (onSidebarToggle && sidebarLabel && sidebarTooltip) {
    items.push({
      id: "sidebar",
      label: sidebarLabel,
      tooltip: buildShortcutTooltip(sidebarTooltip, sidebarShortcut),
      disabled: false,
      toggleState: sidebarActive,
    });
  }

  if (onTocToggle && tocLabel && tocTooltip) {
    items.push({
      id: "toc",
      label: tocLabel,
      tooltip: buildShortcutTooltip(tocTooltip, tocShortcut),
      disabled: tocToggleDisabled,
      toggleState: tocActive,
    });
  }

  if (onFocusModeToggle && focusModeLabel && focusModeTooltip) {
    items.push({
      id: "focusMode",
      label: focusModeLabel,
      tooltip: buildShortcutTooltip(focusModeTooltip, focusModeShortcut),
      disabled: false,
    });
  }

    if (onFullscreenToggle && fullscreenLabel && fullscreenTooltip) {
      items.push({
        id: "fullscreen",
        label: fullscreenLabel,
        tooltip: buildShortcutTooltip(fullscreenTooltip, fullscreenShortcut),
        disabled: false,
        toggleState: isFullscreen,
      });
  }

  items.push({
    id: "settings",
    label: settingsLabel,
    tooltip: buildShortcutTooltip(settingsTooltip, settingsShortcut),
    disabled: false,
  });

  const handleAction = (item: typeof items[number]) => {
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
      case "sidebar":
        onSidebarToggle?.();
        return;
      case "toc":
        onTocToggle?.();
        return;
      case "focusMode":
        onFocusModeToggle?.();
        return;
      case "fullscreen":
        onFullscreenToggle?.();
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
              role="menuitemcheckbox"
              aria-checked={typeof item.toggleState === "boolean" ? item.toggleState : undefined}
              className={`toolbar-action-menu__item${item.id === "settings" ? " is-primary" : ""}${typeof item.toggleState === "boolean" ? " is-toggle" : ""}`}
              onClick={() => handleAction(item)}
              tooltip={item.tooltip}
              icon={getItemIcon(item.id, isDark, isFocusMode)}
              label={item.label}
              onlyIcon={false}
              disabled={item.disabled}
              tooltipPos="above"
              tooltipAlign="left"
            >
              {typeof item.toggleState === "boolean" && (
                <span
                  className={`toolbar-action-menu__switch${item.toggleState ? " is-on" : ""}${item.disabled ? " is-disabled" : ""}`}
                  aria-hidden="true"
                >
                  <span className="toolbar-action-menu__switch-thumb" />
                </span>
              )}
            </TooltipButton>
          ))}
        </div>
      )}
    </div>
  );
}

