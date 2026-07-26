import type { AppState } from '../../contexts/appStateReducer';
import { formatShortcutLabel } from '../../utils/shortcuts';

type SettingsShortcutsPanelProps = {
  state: AppState;
  t: any;
  isDesktop: boolean;
  shortcutSearchQuery: string;
  setShortcutSearchQuery: (query: string) => void;
  filteredActions: any[];
  recordingAction: string | null;
  setRecordingAction: React.Dispatch<React.SetStateAction<string | null>>;
  handleKeyDown: (actionId: string, event: React.KeyboardEvent<HTMLInputElement>) => void;
  updateSettings: (patch: any) => void;
  showUpdateCard: boolean;
  updateVersionLabel: string;
  updateCheck: any;
  hostUpdateState: any;
  isUpdateDownloading: boolean;
  isUpdateScheduled: boolean;
  isUpdateApplying: boolean;
  isUpdateDownloaded: boolean;
  updateStatus: string;
  getUpdateErrorText: () => string;
  onOpenChangelog: () => void;
  onDownloadUpdate: () => void;
  onRequestReset: () => void;
};

export function SettingsShortcutsPanel(props: SettingsShortcutsPanelProps) {
  const {
    state, t, isDesktop, shortcutSearchQuery, setShortcutSearchQuery,
    filteredActions, recordingAction, setRecordingAction, handleKeyDown,
    updateSettings, showUpdateCard, updateVersionLabel, updateCheck,
    hostUpdateState, isUpdateDownloading, isUpdateScheduled, isUpdateApplying,
    isUpdateDownloaded, updateStatus, getUpdateErrorText, onOpenChangelog,
    onDownloadUpdate, onRequestReset,
  } = props;
  return (
<>
{/* Right Column: Shortcuts Customizer */}
<div
  className="settings-card__column settings-card__column--shortcuts"
  
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
  >
    {filteredActions.map((act) => {
      const isRecording = recordingAction === act.id;
      const val = state.settings.keybindings?.[act.id] || "";
      const isEnabled = !state.settings.disabledKeybindings?.[act.id];
      return (
        <div
          className="settings-shortcut-row"
          key={act.id}
        >
          <div
            className="settings-shortcut-label"
          >
            <span>{t.actions[act.id as keyof typeof t.actions] || act.label}</span>
          </div>
          <button
            type="button"
            className={`settings-shortcut-toggle${isEnabled ? " is-enabled" : ""}`}
            role="switch"
            aria-checked={isEnabled}
            aria-label={`${isEnabled ? "Disable" : "Enable"} ${act.label}`}
            onClick={() => updateSettings({
              disabledKeybindings: {
                ...state.settings.disabledKeybindings,
                [act.id]: isEnabled,
              },
            })}
          >
            <span aria-hidden="true" />
          </button>
          <input
            type="text"
            readOnly
            placeholder="Click to record..."
            disabled={!isEnabled}
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
            className={`settings-shortcut-input${isRecording ? " is-recording" : ""}`}
          />
        </div>
      );
    })}
  </div>
  <div
    className="settings-shortcuts-footer"
  >
    <button
      type="button"
      className="settings-reset-shortcuts-btn"
      onClick={onRequestReset}
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
  </>
  );
}
