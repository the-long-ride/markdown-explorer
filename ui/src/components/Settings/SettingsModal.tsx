// =============================================================================
// components/Settings/SettingsModal.tsx — Settings Modal & Shortcuts Manager
// =============================================================================

import { useState, useEffect, useRef } from "react";
import {
  DEFAULT_KEYBINDINGS,
  DESKTOP_DEFAULT_KEYBINDINGS,
  THEME_MODE_OPTIONS,
} from "../../contexts/appStateConstants";
import { useAppState } from "../../contexts/AppStateContext";
import type { UpdateCheckState } from "../../hooks/useUpdateCheck";
import { TooltipButton } from "../shared/TooltipButton";
import { ThemeStylePicker } from "./ThemeStylePicker";
import { ThemeRemixModal } from "./ThemeRemixModal";
import { LANGUAGE_OPTIONS, getTranslations } from "../../contexts/translations";
import { createSettingsExport, parseSettingsImport, restoreLocalUiSettings } from "../../settings/settingsImportExport";
import { usePlatform } from "../../contexts/PlatformContext";
import { CopyIcon, FolderIcon, GlobeIcon } from "../shared/icons";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateCheck: UpdateCheckState;
  onDownloadUpdate: () => void;
  onOpenChangelog: () => void;
}

const ACTIONS_LIST = [
  { id: "findCurrentFile", label: "Find in current file", scope: "both" },
  { id: "searchCurrent", label: "Search current workspace", scope: "desktop" },
  { id: "searchAllTabs", label: "Search all tabs", scope: "desktop" },
  { id: "back", label: "Back to previous file", scope: "both" },
  { id: "forward", label: "Go to next file", scope: "both" },
  { id: "welcome", label: "Go to welcome page", scope: "both" },
  { id: "settings", label: "Toggle settings modal", scope: "both" },
  { id: "toggleTheme", label: "Toggle light/dark mode", scope: "both" },
  { id: "refresh", label: "Refresh current file", scope: "desktop" },
  { id: "collapseAll", label: "Collapse all headings", scope: "desktop" },
  { id: "expandAll", label: "Expand all headings", scope: "desktop" },
  {
    id: "workspaceSelection",
    label: "Go to workspace selection",
    scope: "desktop",
  },
  { id: "toggleSidebar", label: "Toggle sidebar visibility", scope: "desktop" },
  { id: "sidebarCursorMode", label: "Sidebar cursor mode", scope: "both" },
  { id: "zoomIn", label: "Zoom in", scope: "desktop" },
  { id: "zoomOut", label: "Zoom out", scope: "desktop" },
];

function formatCurrentVersion(version: string) {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/i);
  return match ? `v${match[1]}.${match[2]}.${match[3]}` : "";
}

export function SettingsModal({
  isOpen,
  onClose,
  updateCheck,
  onDownloadUpdate,
  onOpenChangelog,
}: SettingsModalProps) {
  const { state, dispatch, setTheme, setThemeStyle, updateSettings } = useAppState();
  const bridge = usePlatform();
  const [recordingAction, setRecordingAction] = useState<string | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [themeRemixOpen, setThemeRemixOpen] = useState(false);
  const [settingsDataStatus, setSettingsDataStatus] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!langMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!langDropdownRef.current?.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [langMenuOpen]);

  if (!isOpen) return null;

  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);
  const currentVersionLabel = formatCurrentVersion(
    updateCheck.currentVersion || state.appVersion,
  );

  const handleLanguageChange = (lang: string) => {
    updateSettings({ language: lang });
    setLangMenuOpen(false);
  };

  const isElectron = typeof (window as any).electronAPI !== "undefined";
  const updateAvailable = updateCheck.status === "available" && updateCheck.hasUpdate;
  const visibleActions = ACTIONS_LIST.filter(
    (act) => act.scope === "both" || isElectron,
  );

  const handleKeyDown = (
    actionId: string,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Do not record modifiers alone
    const modifierKeys = ["control", "shift", "alt", "meta"];
    if (modifierKeys.includes(e.key.toLowerCase())) {
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");

    let keyName = e.key;
    if (keyName === " ") keyName = "Space";
    // Standardize arrow names
    if (keyName === "ArrowLeft") keyName = "ArrowLeft";
    if (keyName === "ArrowRight") keyName = "ArrowRight";
    if (keyName === "ArrowUp") keyName = "ArrowUp";
    if (keyName === "ArrowDown") keyName = "ArrowDown";
    // Standardize alphabet to uppercase
    if (keyName.length === 1) keyName = keyName.toUpperCase();

    parts.push(keyName);
    const shortcutStr = parts.join("+");

    const nextBindings = {
      ...state.settings.keybindings,
      [actionId]: shortcutStr,
    };
    updateSettings({ keybindings: nextBindings });
    setRecordingAction(null);
    // Remove focus
    (e.target as HTMLInputElement).blur();
  };

  const exportSettings = () => {
    const envelope = createSettingsExport({
      theme: state.theme,
      themeStyle: state.themeStyle,
      settings: state.settings,
      recentWorkspaces: state.recentWorkspaces,
      appVersion: state.appVersion,
    });
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `markdown-explorer-settings-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSettingsDataStatus("Exported settings JSON.");
  };

  const importSettingsFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseSettingsImport(String(reader.result || ""), isElectron);
        const activeCustomTheme = imported.settings.activeCustomThemeId
          ? imported.settings.customThemes?.find((theme) => theme.id === imported.settings.activeCustomThemeId)
          : undefined;
        updateSettings(imported.settings);
        setTheme(imported.theme);
        if (!activeCustomTheme) {
          setThemeStyle(imported.themeStyle);
        } else {
          bridge.postMessage({
            command: "updateAppearance",
            theme: imported.theme,
            themeStyle: activeCustomTheme.baseStyle,
          });
        }
        dispatch({
          type: "RECENT_WORKSPACES_CHANGED",
          recentWorkspaces: imported.recentWorkspaces,
        });
        if (isElectron) {
          bridge.postMessage({
            command: "replaceRecentWorkspaces",
            recentWorkspaces: imported.recentWorkspaces,
          });
        }
        restoreLocalUiSettings(imported.localUi);
        setSettingsDataStatus("Imported settings and workspace history.");
      } catch (err) {
        setSettingsDataStatus(err instanceof Error ? err.message : "Import failed.");
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      id="settingsModal"
      className="mdn-modal settings-modal"
      style={{ display: "flex" }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="settings-card settings-card--settings"
      >
        <div className="settings-card__top-actions">
          {currentVersionLabel && (
            <a
              className="settings-current-version tooltip-container"
              href={updateCheck.changelogUrl || "#"}
              onClick={(event) => {
                event.preventDefault();
                onOpenChangelog();
              }}
              aria-label={t.tooltips.openChangelog}
              data-tooltip-pos="below"
            >
              {currentVersionLabel}
              <span className="tooltip-text">{t.tooltips.openChangelog}</span>
            </a>
          )}
          <div className="settings-data-actions" role="group" aria-label="Settings data">
            <button
              type="button"
              className="settings-data-btn"
              onClick={() => importInputRef.current?.click()}
              aria-label="Import all user settings from JSON"
              title="Import all user settings from JSON"
            >
              <FolderIcon size={13} />
              Import JSON
            </button>
            <button
              type="button"
              className="settings-data-btn"
              onClick={exportSettings}
              aria-label="Export all user settings to JSON"
              title="Export all user settings to JSON"
            >
              <CopyIcon size={13} />
              Export JSON
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => importSettingsFile(event.currentTarget.files?.[0])}
            />
          </div>
          {settingsDataStatus && (
            <span className="settings-data-status" role="status">
              {settingsDataStatus}
            </span>
          )}
          <div className="settings-language-dropdown" ref={langDropdownRef}>
            <TooltipButton
              className="settings-language-btn"
              onClick={() => setLangMenuOpen((open) => !open)}
              tooltip={t.tooltips.switchLanguage}
              tooltipPos="below"
              icon={<GlobeIcon size={16} />}
            />
            {langMenuOpen && (
              <div className="settings-language-menu" role="listbox" aria-label="Languages">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={currentLang === option.id}
                    className={`settings-language-menu__option${
                      currentLang === option.id ? " is-selected" : ""
                    }`}
                    onClick={() => handleLanguageChange(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <TooltipButton
            className="settings-card__close"
            onClick={onClose}
            tooltip={t.closeSettings}
            tooltipPos="below"
            tooltipAlign="right"
          >
            &times;
          </TooltipButton>
        </div>
        <div className="settings-card__header">
          <h2>{t.settings}</h2>
          <p>{t.subtitle}</p>
        </div>
        <div
          className="settings-card__body"
          style={{ display: "flex", gap: "32px", marginTop: "7px" }}
        >
          {/* Left Column: Preferences */}
          <div
            className="settings-card__column settings-card__column--preferences"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: "13.5px",
                color: "var(--tx)",
                marginBottom: "4px",
              }}
            >
              {t.appearance}
            </div>
            <div className="settings-field">
              <div className="settings-item__info">
                <div className="settings-item__title">{t.colorMode}</div>
                <div className="settings-item__desc">
                  {t.colorModeDesc}
                </div>
              </div>
              <div
                className="segmented-control"
                role="radiogroup"
                aria-label="Color mode"
              >
                {THEME_MODE_OPTIONS.map((option) => {
                  let label = option.label;
                  if (option.id === "auto") label = t.auto;
                  else if (option.id === "light") label = t.light;
                  else if (option.id === "dark") label = t.dark;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`segmented-option${
                        state.theme === option.id ? " is-active" : ""
                      }`}
                      aria-pressed={state.theme === option.id}
                      onClick={() => setTheme(option.id)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="settings-field"
              style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
            >
              <div className="settings-item__info">
                <div className="settings-item__title">{t.themeStyle}</div>
                <div className="settings-item__desc">
                  {t.themeStyleDesc}
                </div>
              </div>
              <ThemeStylePicker
                value={state.themeStyle}
                onChange={setThemeStyle}
                showCustomThemes
                onOpenThemeRemix={() => setThemeRemixOpen(true)}
              />
            </div>

            <div
              style={{
                fontWeight: 600,
                fontSize: "13.5px",
                color: "var(--tx)",
                marginTop: "4px",
                marginBottom: "-4px",
              }}
            >
              {t.viewPrefs}
            </div>
            {isElectron && (
              <div
                className="settings-field"
                style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
              >
                <div className="settings-item__info">
                  <div className="settings-item__title">{t.desktopView}</div>
                  <div className="settings-item__desc">
                    {t.desktopViewDesc}
                  </div>
                </div>
                <div
                  className="segmented-control"
                  role="radiogroup"
                  aria-label="Desktop view mode"
                >
                  {[
                    { id: "focus", label: "Focus" },
                    { id: "tabs", label: "Tabs" },
                  ].map((option) => {
                    let label = option.label;
                    if (option.id === "focus") label = t.focus;
                    else if (option.id === "tabs") label = t.tabs;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`segmented-option${
                          (state.settings.desktopViewMode ?? "focus") === option.id
                            ? " is-active"
                            : ""
                        }`}
                        aria-pressed={(state.settings.desktopViewMode ?? "focus") === option.id}
                        onClick={() =>
                          updateSettings({
                            desktopViewMode: option.id as "focus" | "tabs",
                          })
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Show Title */}
            <div
              className="settings-item"
              style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
            >
              <div className="settings-item__info">
                <div className="settings-item__title">{t.sidebarLabels}</div>
                <div className="settings-item__desc">
                  {t.sidebarLabelsDesc}
                </div>
              </div>
              <label
                className="switch-toggle"
                aria-label="Toggle sidebar file labels"
              >
                <input
                  type="checkbox"
                  checked={state.settings.showTitle}
                  onChange={(e) =>
                    updateSettings({ showTitle: e.target.checked })
                  }
                />
                <span className="switch-slider" />
              </label>
            </div>

            {/* File Tabs */}
            <div
              className="settings-item"
              style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
            >
              <div className="settings-item__info">
                <div className="settings-item__title">{t.fileTabs}</div>
                <div className="settings-item__desc">
                  {t.fileTabsDesc}
                </div>
              </div>
              <label
                className="switch-toggle"
                aria-label={t.fileTabs}
              >
                <input
                  type="checkbox"
                  checked={state.settings.fileTabs}
                  onChange={(e) =>
                    updateSettings({ fileTabs: e.target.checked })
                  }
                />
                <span className="switch-slider" />
              </label>
            </div>

            {/* Document Conversion */}
            <div
              className="settings-item settings-item--document-conversion"
              style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
            >
              <div className="settings-item__info">
                <div className="settings-item__title">
                  Read DOCX, PDF, Office, and text files
                </div>
                <div className="settings-item__desc">
                  Converts DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF, and TXT to Markdown for preview. Converted previews can lose layout or formatting quality.
                </div>
              </div>
              <label
                className="switch-toggle"
                aria-label="Toggle document conversion previews"
              >
                <input
                  type="checkbox"
                  checked={state.settings.documentConversion}
                  onChange={(e) =>
                    updateSettings({ documentConversion: e.target.checked })
                  }
                />
                <span className="switch-slider" />
              </label>
            </div>

            {/* Default HTML Preview */}
            <div
              className="settings-item"
              style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
            >
              <div className="settings-item__info">
                <div className="settings-item__title">
                  {t.htmlPreview}
                </div>
                <div className="settings-item__desc">
                  {t.htmlPreviewDesc}
                </div>
              </div>
              <label
                className="switch-toggle"
                aria-label="Toggle default HTML view"
              >
                <input
                  type="checkbox"
                  checked={state.settings.defaultHtmlPreview}
                  onChange={(e) =>
                    updateSettings({ defaultHtmlPreview: e.target.checked })
                  }
                />
                <span className="switch-slider" />
              </label>
            </div>
          </div>

          {/* Vertical Divider */}
          <div
            className="settings-card__divider"
            style={{
              width: "1px",
              background: "var(--bd)",
              alignSelf: "stretch",
            }}
          />

          {/* Right Column: Shortcuts Customizer */}
          <div
            className="settings-card__column settings-card__column--shortcuts"
            style={{ flex: 1.2, display: "flex", flexDirection: "column" }}
          >
            <div className="settings-shortcuts-header">
              <div className="settings-shortcuts-title">
                {t.shortcuts}
              </div>
              <div className="settings-shortcuts-hint">
                {t.shortcutsHint}
              </div>
            </div>
            <div
              className="settings-shortcuts-list"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                overflowY: "auto",
                paddingRight: "6px",
              }}
            >
              {visibleActions.map((act) => {
                const isRecording = recordingAction === act.id;
                const val = state.settings.keybindings?.[act.id] || "";
                return (
                  <div
                    className="settings-shortcut-row"
                    key={act.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                    }}
                  >
                    <div
                      className="settings-shortcut-label"
                      style={{
                        color: "var(--tx2)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{t.actions[act.id as keyof typeof t.actions] || act.label}</span>
                    </div>
                    <input
                      className="settings-shortcut-input"
                      type="text"
                      readOnly
                      placeholder="Click to record..."
                      value={
                        isRecording
                          ? "Press keys..."
                          : val.split("+").join(" + ")
                      }
                      onFocus={() => setRecordingAction(act.id)}
                      onBlur={() => {
                        // Allow some delay to capture keys
                        setTimeout(
                          () =>
                            setRecordingAction((prev) =>
                              prev === act.id ? null : prev,
                            ),
                          250,
                        );
                      }}
                      onKeyDown={(e) => handleKeyDown(act.id, e)}
                      style={{
                        width: "130px",
                        textAlign: "center",
                        background: isRecording
                          ? "rgba(109, 94, 240, 0.15)"
                          : "var(--bg-s)",
                        border: isRecording
                          ? "1px solid var(--accent)"
                          : "1px solid var(--bd-s)",
                        color: isRecording ? "var(--accent-text)" : "var(--tx)",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "1px",
                        outline: "none",
                        transition: "all 0.15s ease",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              className="settings-shortcuts-footer"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                marginTop: "16px",
              }}
            >
              <button
                type="button"
                className="settings-reset-shortcuts-btn"
                onClick={() =>
                  updateSettings({
                    keybindings: isElectron
                      ? DESKTOP_DEFAULT_KEYBINDINGS
                      : DEFAULT_KEYBINDINGS,
                  })
                }
              >
                {t.resetShortcuts}
              </button>
              {updateAvailable && (
                <div className="settings-update-card" role="status">
                  <div className="settings-update-card__title">
                    New version {updateCheck.latestVersion} available
                  </div>
                  <div className="settings-update-card__desc">
                    Current version {updateCheck.currentVersion}. Release notes:{" "}
                    <button
                      type="button"
                      className="settings-update-card__link"
                      onClick={onOpenChangelog}
                    >
                      see changelog in GitHub
                    </button>
                    .
                  </div>
                  <button
                    type="button"
                    className="settings-download-update-btn"
                    onClick={onDownloadUpdate}
                  >
                    Download new version
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ThemeRemixModal
        isOpen={themeRemixOpen}
        onClose={() => setThemeRemixOpen(false)}
      />
    </div>
  );
}
