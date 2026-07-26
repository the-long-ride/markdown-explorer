// =============================================================================
// components/Settings/SettingsModal.tsx — Settings Modal & Shortcuts Manager
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import type { UpdateCheckState } from "../../hooks/useUpdateCheck";
import type { UpdateState } from "../../types";
import { TooltipButton } from "../shared/TooltipButton";
import { SettingsShortcutsPanel } from "./SettingsShortcutsPanel";
import { SettingsPreferencesPanel } from "./SettingsPreferencesPanel";
import { ThemeRemixModal } from "./ThemeRemixModal";
import { LANGUAGE_OPTIONS, getTranslations, Translations } from "../../contexts/translations";
import { createSettingsExport, parseSettingsImport, restoreLocalUiSettings, SettingsImportError } from "../../settings/settingsImportExport";
import { usePlatform } from "../../contexts/PlatformContext";
import { ExportSettingsIcon, ImportSettingsIcon, LanguageIcon } from "../shared/icons";
import {
  filterKeyboardShortcutActions,
} from "./keyboardShortcutSearch";
import { BannedShortcutDialog, DownloadedUpdateDialog, ResetShortcutsConfirmDialog } from "./SettingsModalDialogs";
import { ACTIONS_LIST } from "./settingsActions";
import { getDefaultKeybindings } from "../../contexts/appStateConstants";

export { ACTIONS_LIST };

import whiteShibaBlep from "../../assets/themes/pets/backgrounds/white-shiba-blep.png";
import kInkSurprise from "../../assets/themes/pets/backgrounds/k-ink-surprise.png";
import catBlep from "../../assets/themes/pets/backgrounds/cat-blep.png";
import hamsterBlep from "../../assets/themes/pets/backgrounds/hamster-blep.png";
import corgiBlep from "../../assets/themes/pets/backgrounds/corgi-blep.png";

const PET_BLEP_URLS = {
  "pet-white-shiba": whiteShibaBlep,
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
    return updateErrorCode === "missing-staged-update"
      ? t.update.stagedMissing
      : updateErrorCode.includes("download")
        ? t.update.downloadFailed
        : t.update.installFailed;
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
      setBannedShortcutError(`\"${shortcutStr}\" is already assigned to another command.`);
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
          <div className="settings-data-actions" role="group" aria-label={t.settingsData.groupLabel}>
            <TooltipButton
              className="settings-data-btn"
              onClick={() => importInputRef.current?.click()}
              tooltip={t.importJsonTooltip}
              tooltipPos="below"
              icon={<ImportSettingsIcon size={13} />}
              label={t.importJson}
              onlyIcon={false}
            />
            <TooltipButton
              className="settings-data-btn"
              onClick={exportSettings}
              tooltip={t.exportJsonTooltip}
              tooltipPos="below"
              icon={<ExportSettingsIcon size={13} />}
              label={t.exportJson}
              onlyIcon={false}
            />
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
              icon={<LanguageIcon size={16} />}
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
          className="settings-card__body settings-card__body--settings"
        >
          <div className="settings-appearance-scroll">
            <SettingsPreferencesPanel
              state={state}
              t={t}
              isDesktop={isDesktop}
              setTheme={setTheme}
              setThemeStyle={setThemeStyle}
              updateSettings={updateSettings}
              onOpenThemeRemix={() => setThemeRemixOpen(true)}
            />
          </div>

          {/* Vertical Divider */}
          <div
            className="settings-card__divider"
            
          />

          <SettingsShortcutsPanel
            state={state}
            t={t}
            isDesktop={isDesktop}
            shortcutSearchQuery={shortcutSearchQuery}
            setShortcutSearchQuery={setShortcutSearchQuery}
            filteredActions={filteredActions}
            recordingAction={recordingAction}
            setRecordingAction={setRecordingAction}
            handleKeyDown={handleKeyDown}
            updateSettings={updateSettings}
            showUpdateCard={showUpdateCard}
            updateVersionLabel={updateVersionLabel}
            updateCheck={updateCheck}
            hostUpdateState={hostUpdateState}
            isUpdateDownloading={isUpdateDownloading}
            isUpdateScheduled={isUpdateScheduled}
            isUpdateApplying={isUpdateApplying}
            isUpdateDownloaded={isUpdateDownloaded}
            updateStatus={updateStatus}
            getUpdateErrorText={getUpdateErrorText}
            onOpenChangelog={onOpenChangelog}
            onDownloadUpdate={onDownloadUpdate}
            onRequestReset={() => setResetShortcutsConfirmOpen(true)}
          />

        </div>
      </div>
      <ThemeRemixModal
        isOpen={themeRemixOpen}
        onClose={() => setThemeRemixOpen(false)}
      />
      {isUpdateDownloaded && <DownloadedUpdateDialog t={t} version={updateVersionLabel || ""} onSchedule={onScheduleUpdateOnExit} onRestart={onRestartAndApplyUpdate} />}
      {bannedShortcutError && <BannedShortcutDialog t={t} error={bannedShortcutError} mascot={state.themeStyle.startsWith("pet-") ? PET_BLEP_URLS[state.themeStyle as keyof typeof PET_BLEP_URLS] || whiteShibaBlep : ""} onClose={() => setBannedShortcutError(null)} />}
      {resetShortcutsConfirmOpen && (
        <ResetShortcutsConfirmDialog
          t={t}
          onCancel={() => setResetShortcutsConfirmOpen(false)}
          onConfirm={() => {
            updateSettings({
              keybindings: getDefaultKeybindings(isDesktop),
              disabledKeybindings: {},
            });
            setResetShortcutsConfirmOpen(false);
          }}
        />
      )}
    </div>
  );
}
