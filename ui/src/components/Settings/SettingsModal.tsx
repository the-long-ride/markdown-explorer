// =============================================================================
// components/Settings/SettingsModal.tsx — Settings Modal & Shortcuts Manager
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import type { UpdateCheckState } from "../../hooks/useUpdateCheck";
import type { UpdateState } from "../../types";
import { TooltipButton } from "../shared/TooltipButton";
import { SettingsShortcutsPanel } from "./SettingsShortcutsPanel";
import { SettingsUpdateBackupPanel } from "./SettingsUpdateBackupPanel";
import { SettingsPreferencesPanel, type SettingsPreferencesSection } from "./SettingsPreferencesPanel";
import { ThemeRemixModal } from "./ThemeRemixModal";
import { LANGUAGE_OPTIONS, getTranslations } from "../../contexts/translations";
import { createSettingsExport, parseSettingsImport, restoreLocalUiSettings, SettingsImportError } from "../../settings/settingsImportExport";
import { usePlatform } from "../../contexts/PlatformContext";
import {
  LanguageIcon,
  SettingsAppearanceIcon,
  SettingsShortcutsIcon,
  SettingsThemeStyleIcon,
  SettingsTypographyIcon,
  SettingsUpdateBackupIcon,
} from "../shared/icons";
import {
  filterKeyboardShortcutActions,
} from "./keyboardShortcutSearch";
import { BannedShortcutDialog, DownloadedUpdateDialog, ResetShortcutsConfirmDialog } from "./SettingsModalDialogs";
import { ACTIONS_LIST, getLocalizedShortcutActionLabels } from "./settingsActions";
import { getDefaultKeybindingsForRuntime } from "../../contexts/appStateConstants";

export { ACTIONS_LIST };

import { BANNED_SHORTCUTS, formatCurrentVersion, PET_BLEP_URLS } from "./settingsModalData";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateCheck: UpdateCheckState;
  hostUpdateState: UpdateState;
  onDownloadUpdate: () => void;
  onScheduleUpdateOnExit: () => void;
  onRestartAndApplyUpdate: () => void;
  onOpenChangelog: () => void;
  hasUpdateAttention?: boolean;
}


export function SettingsModal({
  isOpen,
  onClose,
  updateCheck,
  hostUpdateState,
  onDownloadUpdate,
  onScheduleUpdateOnExit,
  onRestartAndApplyUpdate,
  onOpenChangelog,
  hasUpdateAttention = false,
}: SettingsModalProps) {
  const { state, dispatch, setTheme, setThemeStyle, updateSettings } = useAppState();
  const bridge = usePlatform();
  const [recordingAction, setRecordingAction] = useState<string | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [themeRemixOpen, setThemeRemixOpen] = useState(false);
  const [settingsDataStatus, setSettingsDataStatus] = useState("");
  const [activeSection, setActiveSection] = useState<SettingsPreferencesSection | 'shortcuts' | 'update'>('appearance');
  const [bannedShortcutError, setBannedShortcutError] = useState<string | null>(null);
  const [shortcutSearchQuery, setShortcutSearchQuery] = useState("");
  const [resetShortcutsConfirmOpen, setResetShortcutsConfirmOpen] = useState(false);
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

  const isDesktop = typeof (window as any).electronAPI !== "undefined" || state.appRuntime === "tauri";
  const isChrome = typeof (window as any).__chromeExtBus !== "undefined";
  const supportsTypography = isDesktop || state.appRuntime === "vscode";
  const isDesktopLike = isDesktop || isChrome;
  const supportsEditor = isDesktop || state.appRuntime === "vscode";
  const updateStatus = hostUpdateState.status;
  const isUpdateDownloaded = updateStatus === "downloaded";
  const updateVersionLabel = hostUpdateState.downloadedVersion || updateCheck.latestVersion;
  const visibleActions = ACTIONS_LIST.filter(
    (act) =>
      act.scope === "both" ||
      (act.scope === "non-vscode" && state.appRuntime !== "vscode") ||
      (act.scope === "desktop" && isDesktopLike) ||
      (act.scope === "electron" && isDesktop) ||
      (act.scope === "editor" && supportsEditor),
  );
  const shortcutActionLabels = getLocalizedShortcutActionLabels(t);
  const filteredActions = filterKeyboardShortcutActions(
    visibleActions,
    shortcutSearchQuery,
    shortcutActionLabels,
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

    const duplicateAction = Object.entries(state.settings.keybindings ?? {}).find(
      ([existingActionId, existingShortcut]) =>
        existingActionId !== actionId && existingShortcut.toLowerCase() === shortcutStr.toLowerCase(),
    );
    if (duplicateAction) {
      setBannedShortcutError(t.ui.shortcutAlreadyAssigned.replace('{shortcut}', shortcutStr));
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
    setSettingsDataStatus(t.settingsData.exported);
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
        setSettingsDataStatus(t.settingsData.imported);
      } catch (err) {
        setSettingsDataStatus(
          err instanceof SettingsImportError
            ? t.settingsData[err.code]
            : t.settingsData.importFailed,
        );
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const settingsSections = [
    { id: 'appearance' as const, label: t.appearance, icon: <SettingsAppearanceIcon size={14} /> },
    ...(supportsTypography ? [{ id: 'typography' as const, label: t.typography, icon: <SettingsTypographyIcon size={14} /> }] : []),
    { id: 'theme' as const, label: t.themeStyle, icon: <SettingsThemeStyleIcon size={14} /> },
    { id: 'shortcuts' as const, label: t.shortcuts, icon: <SettingsShortcutsIcon size={14} /> },
    { id: 'update' as const, label: t.updateBackup, icon: <SettingsUpdateBackupIcon size={14} />, attention: hasUpdateAttention },
  ];

  return (
    <div
      id="settingsModal"
      className="mdn-modal settings-modal"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-card settings-card--settings settings-card--navigation">
        <header className="settings-navigation-header">
          <div className="settings-navigation-header__copy">
            <h2>{t.settings}</h2>
            <p>{t.subtitle}</p>
          </div>
        </header>
        <div className="settings-card__top-actions">
          <div className="settings-language-dropdown" ref={langDropdownRef}>
            <TooltipButton
              className="settings-language-btn"
              onClick={() => setLangMenuOpen((open) => !open)}
              tooltip={t.tooltips.switchLanguage}
              tooltipPos="below"
              icon={<LanguageIcon size={16} />}
            />
            {langMenuOpen && (
              <div className="settings-language-menu" role="listbox" aria-label={t.ui.languages}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={currentLang === option.id}
                    className={`settings-language-menu__option${currentLang === option.id ? " is-selected" : ""}`}
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
            shortcut="Esc"
            tooltipPos="below"
            tooltipAlign="right"
          >
            &times;
          </TooltipButton>
        </div>

        <div className="settings-navigation-layout">
          <aside className="settings-navigation" aria-label={t.ui.settingsSections}>
            <nav className="settings-navigation__items">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`settings-navigation__item${activeSection === section.id ? ' is-active' : ''}`}
                  aria-current={activeSection === section.id ? 'page' : undefined}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className="settings-navigation__item-label">
                    <span className="settings-navigation__item-icon" aria-hidden="true">{section.icon}</span>
                    <span>{section.label}</span>
                  </span>
                  {section.attention && <span className="settings-nav-badge-dot" aria-label={t.ui.updateAvailable} />}
                </button>
              ))}
            </nav>
            {currentVersionLabel && (
              <TooltipButton
                type="button"
                className="settings-navigation__version"
                onClick={onOpenChangelog}
                tooltip={t.tooltips.openChangelog}
                tooltipPos="above"
                tooltipAlign="left"
              >
                {currentVersionLabel}
              </TooltipButton>
            )}
          </aside>

          <main className={`settings-navigation__content${activeSection === 'typography' ? ' settings-navigation__content--typography' : ''}`}>
            {(activeSection === 'appearance' || activeSection === 'typography' || activeSection === 'theme') && (
              <SettingsPreferencesPanel
                section={activeSection}
                state={state}
                t={t}
                isDesktop={isDesktop}
                supportsTypography={supportsTypography}
                setTheme={setTheme}
                setThemeStyle={setThemeStyle}
                updateSettings={updateSettings}
                onOpenThemeRemix={() => setThemeRemixOpen(true)}
              />
            )}
            {activeSection === 'shortcuts' && (
              <SettingsShortcutsPanel
                state={state}
                t={t}
                isDesktop={isDesktop}
                shortcutSearchQuery={shortcutSearchQuery}
                setShortcutSearchQuery={setShortcutSearchQuery}
                filteredActions={filteredActions}
                actionLabels={shortcutActionLabels}
                recordingAction={recordingAction}
                setRecordingAction={setRecordingAction}
                handleKeyDown={handleKeyDown}
                updateSettings={updateSettings}
                onRequestReset={() => setResetShortcutsConfirmOpen(true)}
              />
            )}
            {activeSection === 'update' && (
              <SettingsUpdateBackupPanel
                state={state}
                t={t}
                updateCheck={updateCheck}
                hostUpdateState={hostUpdateState}
                settingsDataStatus={settingsDataStatus}
                onImport={() => importInputRef.current?.click()}
                onExport={exportSettings}
                onOpenChangelog={onOpenChangelog}
                onDownloadUpdate={onDownloadUpdate}
              />
            )}
          </main>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => importSettingsFile(event.currentTarget.files?.[0])}
        />
      </div>
      <ThemeRemixModal isOpen={themeRemixOpen} onClose={() => setThemeRemixOpen(false)} />
      {state.appRuntime !== "vscode" && isUpdateDownloaded && <DownloadedUpdateDialog t={t} version={updateVersionLabel || ""} onSchedule={onScheduleUpdateOnExit} onRestart={onRestartAndApplyUpdate} />}
      {bannedShortcutError && <BannedShortcutDialog t={t} error={bannedShortcutError} mascot={state.themeStyle.startsWith("pet-") ? PET_BLEP_URLS[state.themeStyle as keyof typeof PET_BLEP_URLS] || PET_BLEP_URLS['pet-white-shiba'] : ""} onClose={() => setBannedShortcutError(null)} />}
      {resetShortcutsConfirmOpen && (
        <ResetShortcutsConfirmDialog
          t={t}
          onCancel={() => setResetShortcutsConfirmOpen(false)}
          onConfirm={() => {
            updateSettings({ keybindings: getDefaultKeybindingsForRuntime(state.appRuntime), disabledKeybindings: {} });
            setResetShortcutsConfirmOpen(false);
          }}
        />
      )}
    </div>
  );
}
