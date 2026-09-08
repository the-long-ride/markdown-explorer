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
  MaximizeIcon,
  ExitFocusIcon,
  FullscreenMenuIcon,
  ResetZoomMenuIcon,
} from "./icons";
import { TooltipButton } from "./TooltipButton";
import { SwitchButton } from "./SwitchButton";

export const EXPORT_CENTER_OPEN_EVENT = 'mdn-export-center-open';
export const WORKSPACE_INSIGHTS_TOGGLE_EVENT = 'mdn-workspace-insights-toggle';
export const DOCUMENT_HISTORY_OPEN_EVENT = 'mdn-document-history-open';

interface ToolbarActionMenuProps {
  triggerTooltip: string; triggerAlign?: "left" | "right";
  homeLabel: string; themeLabel: string; editLabel: string; settingsLabel: string; exportLabel?: string;
  homeTooltip: string; themeTooltip: string; editTooltip: string; settingsTooltip: string; exportTooltip?: string;
  homeShortcut?: string; themeShortcut?: string; editShortcut?: string; settingsShortcut?: string;
  canEdit: boolean; isDark: boolean; hasUpdate?: boolean; showEdit?: boolean;
  onHome: () => void; onTheme: () => void; onEdit: () => void; onSettings: () => void; onExport?: () => void;
  historyLabel?: string; historyTooltip?: string; canHistory?: boolean; onHistory?: () => void;
  sidebarLabel?: string; sidebarTooltip?: string; sidebarShortcut?: string; sidebarActive?: boolean; onSidebarToggle?: () => void;
  tocLabel?: string; tocTooltip?: string; tocShortcut?: string; tocActive?: boolean; tocToggleDisabled?: boolean; onTocToggle?: () => void;
  showInsights?: boolean; insightsLabel?: string; insightsTooltip?: string; insightsShortcut?: string; insightsActive?: boolean; canInsights?: boolean; onInsightsToggle?: () => void;
  focusModeLabel?: string; focusModeTooltip?: string; focusModeShortcut?: string; isFocusMode?: boolean; onFocusModeToggle?: () => void;
  showFullscreen?: boolean; fullscreenLabel?: string; fullscreenTooltip?: string; fullscreenShortcut?: string; isFullscreen?: boolean; onFullscreenToggle?: () => void;
  showResetZoom?: boolean; resetZoomLabel?: string; resetZoomTooltip?: string; resetZoomShortcut?: string; onResetZoom?: () => void;
}

function getItemIcon(id: string, isDark: boolean, isFocusMode: boolean) {
  switch (id) {
    case "home": return <HomeIcon size={13} />;
    case "theme": return isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />;
    case "edit": return <EditIcon size={12} />;
    case "history": return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/><path d="M12 7v5l3 2"/></svg>;
    case "sidebar": return <SidebarIcon size={14} />;
    case "toc": return <TocIcon size={14} />;
    case "insights": return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19V3" /></svg>;
    case "focusMode": return isFocusMode ? <ExitFocusIcon size={12} /> : <MaximizeIcon size={12} />;
    case "fullscreen": return <FullscreenMenuIcon size={12} />;
    case "resetZoom": return <ResetZoomMenuIcon size={12} />;
    case "export": return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M5 21h14a2 2 0 0 0 2-2v-3" /><path d="M3 16v3a2 2 0 0 0 2 2" /></svg>;
    case "settings": return <SettingsIcon size={14} />;
    default: return null;
  }
}

export function ToolbarActionMenu({
  triggerTooltip, triggerAlign = "right", homeLabel, themeLabel, editLabel, settingsLabel, exportLabel = "Export Center",
  homeTooltip, themeTooltip, editTooltip, settingsTooltip, exportTooltip, homeShortcut, themeShortcut, editShortcut, settingsShortcut,
  canEdit, isDark, hasUpdate = false, showEdit = true, onHome, onTheme, onEdit, onSettings, onExport,
  historyLabel = 'History', historyTooltip = 'Browse document Git history', canHistory = true, onHistory,
  sidebarLabel, sidebarTooltip, sidebarShortcut, sidebarActive = false, onSidebarToggle,
  tocLabel, tocTooltip, tocShortcut, tocActive = false, tocToggleDisabled = false, onTocToggle,
  showInsights = false, insightsLabel, insightsTooltip, insightsShortcut, insightsActive = false, canInsights = true, onInsightsToggle,
  focusModeLabel, focusModeTooltip, focusModeShortcut, isFocusMode = false, onFocusModeToggle,
  showFullscreen = false, fullscreenLabel, fullscreenTooltip, fullscreenShortcut, isFullscreen = false, onFullscreenToggle,
  showResetZoom = false, resetZoomLabel, resetZoomTooltip, resetZoomShortcut, onResetZoom,
}: ToolbarActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
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

  const items: Array<{ id: string; label: string; tooltip: string; disabled: boolean; toggleState?: boolean }> = [
    { id: "home", label: homeLabel, tooltip: buildShortcutTooltip(homeTooltip, homeShortcut), disabled: false },
    { id: "theme", label: themeLabel, tooltip: buildShortcutTooltip(themeTooltip, themeShortcut), disabled: false },
  ];
  if (showEdit) items.push({ id: "edit", label: editLabel, tooltip: buildShortcutTooltip(editTooltip, editShortcut), disabled: !canEdit });
  items.push({ id: "history", label: historyLabel, tooltip: historyTooltip, disabled: !canHistory });
  if (onSidebarToggle && sidebarLabel && sidebarTooltip) items.push({ id: "sidebar", label: sidebarLabel, tooltip: buildShortcutTooltip(sidebarTooltip, sidebarShortcut), disabled: false, toggleState: sidebarActive });
  if (onTocToggle && tocLabel && tocTooltip) items.push({ id: "toc", label: tocLabel, tooltip: buildShortcutTooltip(tocTooltip, tocShortcut), disabled: tocToggleDisabled, toggleState: tocActive });
  if (showInsights && insightsLabel) items.push({ id: "insights", label: insightsLabel, tooltip: buildShortcutTooltip(insightsTooltip || insightsLabel, insightsShortcut), disabled: !canInsights, toggleState: insightsActive });
  if (onFocusModeToggle && focusModeLabel && focusModeTooltip) items.push({ id: "focusMode", label: focusModeLabel, tooltip: buildShortcutTooltip(focusModeTooltip, focusModeShortcut), disabled: false });
  if (showFullscreen && onFullscreenToggle && fullscreenLabel && fullscreenTooltip) items.push({ id: "fullscreen", label: fullscreenLabel, tooltip: buildShortcutTooltip(fullscreenTooltip, fullscreenShortcut), disabled: false, toggleState: isFullscreen });
  if (showResetZoom && onResetZoom && resetZoomLabel && resetZoomTooltip) items.push({ id: "resetZoom", label: resetZoomLabel, tooltip: buildShortcutTooltip(resetZoomTooltip, resetZoomShortcut), disabled: false });
  items.push({ id: "export", label: exportLabel, tooltip: exportTooltip || exportLabel, disabled: false });
  items.push({ id: "settings", label: settingsLabel, tooltip: buildShortcutTooltip(settingsTooltip, settingsShortcut), disabled: false });

  const handleAction = (item: typeof items[number]) => {
    setOpen(false);
    switch (item.id) {
      case "home": onHome(); return;
      case "theme": onTheme(); return;
      case "edit": onEdit(); return;
      case "history": if (onHistory) onHistory(); else window.dispatchEvent(new Event(DOCUMENT_HISTORY_OPEN_EVENT)); return;
      case "sidebar": onSidebarToggle?.(); return;
      case "toc": onTocToggle?.(); return;
      case "insights": if (onInsightsToggle) onInsightsToggle(); else window.dispatchEvent(new Event(WORKSPACE_INSIGHTS_TOGGLE_EVENT)); return;
      case "focusMode": onFocusModeToggle?.(); return;
      case "fullscreen": onFullscreenToggle?.(); return;
      case "resetZoom": onResetZoom?.(); return;
      case "export": if (onExport) onExport(); else window.dispatchEvent(new Event(EXPORT_CENTER_OPEN_EVENT)); return;
      case "settings": onSettings(); return;
    }
  };

  return (
    <div ref={menuRef} className={`toolbar-action-menu${open ? " is-open" : ""}`}>
      <TooltipButton className={`topbar__action-btn btn btn--icon${hasUpdate ? " has-update" : ""}`} onClick={() => setOpen((value) => !value)} tooltip={triggerTooltip} tooltipAlign={triggerAlign} icon={<SettingsIcon />} aria-expanded={open} aria-haspopup="menu" />
      {open && (
        <div className="toolbar-action-menu__panel" role="menu" aria-label={triggerTooltip}>
          {items.map((item) => typeof item.toggleState === "boolean" ? (
            <div key={item.id} className={`toolbar-action-menu__item is-toggle${item.disabled ? " is-disabled" : ""}`} role="none">
              <TooltipButton type="button" role="menuitem" className="toolbar-action-menu__toggle-action" onClick={() => handleAction(item)} tooltip={item.tooltip} icon={getItemIcon(item.id, isDark, isFocusMode)} label={item.label} onlyIcon={false} disabled={item.disabled} tooltipPos="above" tooltipAlign="center" />
              <SwitchButton checked={item.toggleState} label={item.label} className="toolbar-action-menu__switch" disabled={item.disabled} onClick={() => handleAction(item)} />
            </div>
          ) : (
            <TooltipButton key={item.id} type="button" role="menuitem" className={`toolbar-action-menu__item${item.id === "settings" ? " is-primary" : ""}${item.id === "settings" && hasUpdate ? " has-update" : ""}`} onClick={() => handleAction(item)} tooltip={item.tooltip} icon={getItemIcon(item.id, isDark, isFocusMode)} label={item.label} onlyIcon={false} disabled={item.disabled} tooltipPos="above" tooltipAlign="center" />
          ))}
        </div>
      )}
    </div>
  );
}
