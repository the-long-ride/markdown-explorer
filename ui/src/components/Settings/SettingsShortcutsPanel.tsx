import type { AppState } from '../../contexts/appStateReducer';
import { formatShortcutLabel } from '../../utils/shortcuts';
import { ShortcutKeycaps } from '../shared/ShortcutKeycaps';
import { SwitchButton } from '../shared/SwitchButton';

type SettingsShortcutsPanelProps = {
  state: AppState;
  t: any;
  isDesktop: boolean;
  shortcutSearchQuery: string;
  setShortcutSearchQuery: (query: string) => void;
  filteredActions: any[];
  actionLabels: Record<string, string>;
  recordingAction: string | null;
  setRecordingAction: React.Dispatch<React.SetStateAction<string | null>>;
  handleKeyDown: (actionId: string, event: React.KeyboardEvent<HTMLInputElement>) => void;
  updateSettings: (patch: any) => void;
  onRequestReset: () => void;
};

export function SettingsShortcutsPanel(props: SettingsShortcutsPanelProps) {
  const {
    state, t, shortcutSearchQuery, setShortcutSearchQuery,
    filteredActions, actionLabels, recordingAction, setRecordingAction, handleKeyDown,
    updateSettings, onRequestReset,
  } = props;
  return (
    <>
      {/* Right Column: Shortcuts Customizer */}
      <div className="settings-card__column settings-card__column--shortcuts">
        <div className="settings-section-panel__header">
          <h3>{t.shortcuts}</h3>
          <p>{t.shortcutsHint}</p>
        </div>
        <div className={`settings-shortcuts-search${shortcutSearchQuery ? " has-value" : ""}`}>
          <span className="settings-shortcuts-search-icon" aria-hidden="true" />
          <input
            className="settings-shortcuts-search-input"
            type="text"
            value={shortcutSearchQuery}
            onChange={(event) => setShortcutSearchQuery(event.target.value)}
            placeholder={t.ui.shortcutSearchPlaceholder}
            aria-label={t.ui.shortcutSearchLabel}
          />
          <button
            className={`settings-shortcuts-search-clear${shortcutSearchQuery ? " is-visible" : ""}`}
            type="button"
            onClick={() => setShortcutSearchQuery("")}
            aria-label={t.ui.shortcutSearchClear}
            disabled={!shortcutSearchQuery}
          >
            &times;
          </button>
        </div>
        <div className="settings-shortcuts-list">
          {filteredActions.map((act) => {
            const isRecording = recordingAction === act.id;
            const val = state.settings.keybindings?.[act.id] || "";
            const isEnabled = !state.settings.disabledKeybindings?.[act.id];
            const hasKeycaps = isEnabled && !isRecording && Boolean(val);
            return (
              <div className="settings-shortcut-row" key={act.id}>
                <div className="settings-shortcut-label">
                  <span>{actionLabels[act.id]}</span>
                </div>
                <SwitchButton
                  checked={isEnabled}
                  className="settings-shortcut-toggle"
                  label={(isEnabled ? t.ui.shortcutDisable : t.ui.shortcutEnable).replace('{action}', actionLabels[act.id])}
                  onClick={() => updateSettings({
                    disabledKeybindings: {
                      ...state.settings.disabledKeybindings,
                      [act.id]: isEnabled,
                    },
                  })}
                />
                <div className="settings-shortcut-field">
                  <input
                    type="text"
                    readOnly
                    placeholder={t.ui.shortcutRecordPlaceholder}
                    disabled={!isEnabled}
                    value={
                      isRecording
                        ? t.ui.shortcutPressKeys
                        : formatShortcutLabel(val, " + ")
                    }
                    onFocus={() => setRecordingAction(act.id)}
                    onBlur={() => {
                      setTimeout(
                        () =>
                          setRecordingAction((prev) =>
                            prev === act.id ? null : prev,
                          ),
                        250,
                      );
                    }}
                    onKeyDown={(e) => handleKeyDown(act.id, e)}
                    className={`settings-shortcut-input${isRecording ? " is-recording" : ""}${hasKeycaps ? " has-keycaps" : ""}`}
                  />
                  {hasKeycaps && (
                    <div className="settings-shortcut-keycaps-overlay" aria-hidden="true">
                      <ShortcutKeycaps shortcut={val} size="sm" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="settings-shortcuts-footer">
          <button
            type="button"
            className="settings-reset-shortcuts-btn"
            onClick={onRequestReset}
          >
            {t.resetShortcuts}
          </button>
        </div>
      </div>
    </>
  );
}
