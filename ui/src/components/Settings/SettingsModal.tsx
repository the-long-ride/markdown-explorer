// =============================================================================
// components/Settings/SettingsModal.tsx — Settings Modal & Shortcuts Manager
// =============================================================================

import { useState, useEffect, useRef } from "react";
import {
  THEME_MODE_OPTIONS,
  getDefaultKeybindings,
} from "../../contexts/appStateConstants";
import { useAppState } from "../../contexts/AppStateContext";
import type { UpdateCheckState } from "../../hooks/useUpdateCheck";
import type { UpdateState } from "../../types";
import { TooltipButton } from "../shared/TooltipButton";
import { ThemeStylePicker } from "./ThemeStylePicker";
import { ThemeRemixModal } from "./ThemeRemixModal";
import { LANGUAGE_OPTIONS, getTranslations, Translations } from "../../contexts/translations";
import { createSettingsExport, parseSettingsImport, restoreLocalUiSettings } from "../../settings/settingsImportExport";
import { usePlatform } from "../../contexts/PlatformContext";
import { CopyIcon, FolderIcon, GlobeIcon, AlertTriangleIcon } from "../shared/icons";
import { formatShortcutLabel } from "../../utils/shortcuts";
import {
  filterKeyboardShortcutActions,
} from "./keyboardShortcutSearch";

import whiteShibaBlep from "../../assets/themes/pets/backgrounds/white-shiba-blep.png";
import shibaBlep from "../../assets/themes/pets/backgrounds/shiba-blep.png";
import blackShibaBlep from "../../assets/themes/pets/backgrounds/shiba-memes-blep.png";
import kInkSurprise from "../../assets/themes/pets/backgrounds/k-ink-surprise.png";
import catBlep from "../../assets/themes/pets/backgrounds/cat-blep.png";
import hamsterBlep from "../../assets/themes/pets/backgrounds/hamster-blep.png";
import corgiBlep from "../../assets/themes/pets/backgrounds/corgi-blep.png";

const PET_BLEP_URLS = {
  "pet-white-shiba": whiteShibaBlep,
  "pet-shiba": shibaBlep,
  "pet-shiba-memes": blackShibaBlep,
  "pet-k-ink": kInkSurprise,
  "pet-cat": catBlep,
  "pet-hamster": hamsterBlep,
  "pet-corgi": corgiBlep,
};


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateCheck: UpdateCheckState;
  hostUpdateState: UpdateState;
  onDownloadUpdate: () => void;
  onScheduleUpdateOnExit: () => void;
  onRestartAndApplyUpdate: () => void;
  onOpenChangelog: () => void;
}

export const ACTIONS_LIST = [
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
    scope: "both",
  },
  { id: "toggleSidebar", label: "Toggle sidebar visibility", scope: "desktop" },
  { id: "toggleDesktopViewMode", label: "Toggle Tabs/Focus view", scope: "electron" },
  { id: "toggleToc", label: "Toggle table of contents panel", scope: "both" },
  { id: "toggleFocusMode", label: "Toggle focus mode", scope: "both" },
  { id: "sidebarCursorMode", label: "Sidebar cursor mode", scope: "both" },
  { id: "locateFile", label: "Locate current open file in sidebar", scope: "both" },
  { id: "zoomIn", label: "Zoom in", scope: "desktop" },
  { id: "zoomOut", label: "Zoom out", scope: "desktop" },
];

function formatCurrentVersion(version: string) {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/i);
  return match ? `v${match[1]}.${match[2]}.${match[3]}` : "";
}

// Shortcuts that are reserved by the browser/OS and cannot be registered.
const BANNED_SHORTCUTS: Record<string, keyof Translations> = {
  "Ctrl+Space": "bannedShortcutImeMessage",
};

export function SettingsModal({
  isOpen,
  onClose,
  updateCheck,
  hostUpdateState,
  onDownloadUpdate,
  onScheduleUpdateOnExit,
  onRestartAndApplyUpdate,
  onOpenChangelog,
}: SettingsModalProps) {
  const { state, dispatch, setTheme, setThemeStyle, updateSettings } = useAppState();
  const bridge = usePlatform();
  const [recordingAction, setRecordingAction] = useState<string | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [themeRemixOpen, setThemeRemixOpen] = useState(false);
  const [settingsDataStatus, setSettingsDataStatus] = useState("");
  const [bannedShortcutError, setBannedShortcutError] = useState<string | null>(null);
  const [shortcutSearchQuery, setShortcutSearchQuery] = useState("");
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
  const isDesktop = isElectron;
  const isChrome = typeof (window as any).__chromeExtBus !== "undefined";
  const isDesktopLike = isDesktop || isChrome;
  const updateAvailable = updateCheck.status === "available" && updateCheck.hasUpdate;
  const updateStatus = hostUpdateState.status;
  const isUpdateDownloading = updateStatus === "downloading";
  const isUpdateDownloaded = updateStatus === "downloaded";
  const isUpdateScheduled = updateStatus === "scheduled-on-exit";
  const isUpdateApplying = updateStatus === "applying";
  const updateErrorCode = updateStatus === "error" ? hostUpdateState.error || "" : "";
  const updateVersionLabel = hostUpdateState.downloadedVersion || updateCheck.latestVersion;
  const showUpdateCard =
    updateAvailable ||
    isUpdateDownloading ||
    isUpdateDownloaded ||
    isUpdateScheduled ||
    isUpdateApplying ||
    updateStatus === "error";
  const visibleActions = ACTIONS_LIST.filter(
    (act) =>
      act.scope === "both" ||
      (act.scope === "desktop" && isDesktopLike) ||
      (act.scope === "electron" && isDesktop),
  );
  const filteredActions = filterKeyboardShortcutActions(
    visibleActions,
    shortcutSearchQuery,
    t.actions,
  );

  const getUpdateErrorText = () => {
    if (!updateErrorCode) return "";
    if (updateErrorCode === "missing-staged-update") return t.update.stagedMissing;
    if (updateErrorCode.includes("download")) return t.update.downloadFailed;
    return t.update.installFailed;
  };

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

    // Reject banned shortcuts — rollback and notify via dialog
    if (BANNED_SHORTCUTS[shortcutStr]) {
      const translationKey = BANNED_SHORTCUTS[shortcutStr];
      setBannedShortcutError(t[translationKey] as string);
      setRecordingAction(null);
      (e.target as HTMLInputElement).blur();
      return;
    }

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
        const imported = parseSettingsImport(String(reader.result || ""), isDesktop);
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
        if (isDesktop) {
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
          style={{ display: "flex", gap: "16px", marginTop: "7px" }}
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
              }}            >
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
            {isDesktop && (
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
                  className="segmented-control segmented-control--two"
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
            {isDesktop && (
              <div
                className="settings-item settings-item--document-conversion"
                style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
              >
                <div className="settings-item__info">
                  <div className="settings-item__title">
                    {t.documentConversion}
                  </div>
                  <div className="settings-item__desc">
                    {t.documentConversionDesc}
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
            )}

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
            {isDesktop && (
              <div
                className="settings-shortcuts-search"
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: "10px",
                  marginBottom: "12px",
                }}
              >
                <input
                  className="settings-shortcuts-search-input"
                  type="text"
                  value={shortcutSearchQuery}
                  onChange={(event) => setShortcutSearchQuery(event.target.value)}
                  placeholder="Search keyboard shortcuts..."
                  aria-label="Search keyboard shortcuts"
                />
                <button
                  className="settings-shortcuts-search-clear"
                  type="button"
                  onClick={() => setShortcutSearchQuery("")}
                  aria-label="Clear keyboard shortcut search"
                  disabled={!shortcutSearchQuery}
                >
                  &times;
                </button>
              </div>
            )}
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
              {filteredActions.map((act) => {
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
                          : formatShortcutLabel(val, " + ")
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
                        fontFamily: "var(--font-ui)",
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
                    keybindings: getDefaultKeybindings(isDesktop),
                  })
                }
              >
                {t.resetShortcuts}
              </button>
              {showUpdateCard && (
                <div className="settings-update-card" role="status">
                  <div className="settings-update-card__title">
                    {t.update.availableTitle.replace("{version}", updateVersionLabel || "")}
                  </div>
                  <div className="settings-update-card__desc">
                    {t.update.availableDescription.replace(
                      "{version}",
                      updateCheck.currentVersion || state.appVersion,
                    )}{" "}
                    <button
                      type="button"
                      className="settings-update-card__link"
                      onClick={onOpenChangelog}
                    >
                      {t.update.viewChangelog}
                    </button>
                    .
                  </div>
                  {isUpdateDownloading ? (
                    <div className="settings-update-card__desc">
                      {t.update.downloading.replace(
                        "{progress}",
                        String(hostUpdateState.progressPercent ?? 0),
                      )}
                    </div>
                  ) : null}
                  {isUpdateScheduled ? (
                    <div className="settings-update-card__desc">
                      {t.update.scheduled}
                    </div>
                  ) : null}
                  {isUpdateApplying ? (
                    <div className="settings-update-card__desc">
                      {t.update.applying}
                    </div>
                  ) : null}
                  {updateStatus === "error" ? (
                    <div className="settings-update-card__desc">
                      {getUpdateErrorText()}
                    </div>
                  ) : null}
                  {!isUpdateDownloading && !isUpdateScheduled && !isUpdateApplying && !isUpdateDownloaded ? (
                    <button
                      type="button"
                      className="settings-download-update-btn"
                      onClick={onDownloadUpdate}
                    >
                      {t.update.downloadButton}
                    </button>
                  ) : null}
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
      {isUpdateDownloaded && (
        <div
          className="mdn-modal banned-shortcut-modal"
          style={{ display: "flex" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="settings-card banned-shortcut-card">
            <div className="banned-shortcut-header">
              <div className="banned-shortcut-icon">
                <AlertTriangleIcon size={38} />
              </div>
              <h3>{t.update.restartPromptTitle}</h3>
            </div>
            <div className="banned-shortcut-body">
              <p>
                {t.update.restartPromptBody.replace("{version}", updateVersionLabel || "")}
              </p>
            </div>
            <div className="banned-shortcut-footer">
              <button
                type="button"
                className="banned-shortcut-close-btn"
                onClick={onScheduleUpdateOnExit}
              >
                {t.update.updateOnExit}
              </button>
              <button
                type="button"
                className="banned-shortcut-close-btn"
                onClick={onRestartAndApplyUpdate}
              >
                {t.update.restartAndUpdate}
              </button>
            </div>
          </div>
        </div>
      )}
      {bannedShortcutError && (
        <div
          className="mdn-modal banned-shortcut-modal"
          style={{ display: "flex" }}
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setBannedShortcutError(null);
          }}
        >
          <div className="settings-card banned-shortcut-card">
            <button
              type="button"
              className="settings-card__close"
              onClick={() => setBannedShortcutError(null)}
              aria-label="Close warning"
            >
              &times;
            </button>
            <div className="banned-shortcut-header">
              {state.themeStyle.startsWith("pet-") ? (
                <div className="banned-shortcut-mascot">
                  <img
                    src={
                      PET_BLEP_URLS[state.themeStyle as keyof typeof PET_BLEP_URLS] ||
                      shibaBlep
                    }
                    alt="Warning Mascot"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="banned-shortcut-icon">
                  <AlertTriangleIcon size={38} />
                </div>
              )}
              <h3>{t.bannedShortcutTitle}</h3>
            </div>
            <div className="banned-shortcut-body">
              <p>{bannedShortcutError}</p>
            </div>
            <div className="banned-shortcut-footer">
              <button
                type="button"
                className="banned-shortcut-close-btn"
                onClick={() => setBannedShortcutError(null)}
              >
                {t.bannedShortcutDismiss}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
