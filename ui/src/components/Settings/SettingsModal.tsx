// =============================================================================
// components/Settings/SettingsModal.tsx — Settings Modal & Shortcuts Manager
// =============================================================================

import { useState } from "react";
import {
  useAppState,
  DEFAULT_KEYBINDINGS,
  THEME_MODE_OPTIONS,
} from "../../contexts/AppStateContext";
import { TooltipButton } from "../shared/TooltipButton";
import { ThemeStylePicker } from "./ThemeStylePicker";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTIONS_LIST = [
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
  { id: "zoomIn", label: "Zoom in", scope: "desktop" },
  { id: "zoomOut", label: "Zoom out", scope: "desktop" },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { state, setTheme, setThemeStyle, updateSettings } = useAppState();
  const [recordingAction, setRecordingAction] = useState<string | null>(null);

  if (!isOpen) return null;

  const isElectron = typeof (window as any).electronAPI !== "undefined";
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
        <TooltipButton
          className="settings-card__close"
          onClick={onClose}
          tooltip="Close Settings [Esc]"
          tooltipPos="below"
          tooltipAlign="right"
        >
          &times;
        </TooltipButton>
        <div className="settings-card__header">
          <h2>Settings</h2>
          <p>Customize your Markdown Explorer view preferences</p>
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
              Appearance
            </div>
            <div className="settings-field">
              <div className="settings-item__info">
                <div className="settings-item__title">Color Mode</div>
                <div className="settings-item__desc">
                  Choose automatic, light, or dark rendering.
                </div>
              </div>
              <div
                className="segmented-control"
                role="radiogroup"
                aria-label="Color mode"
              >
                {THEME_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`segmented-option${
                      state.theme === option.id ? " is-active" : ""
                    }`}
                    aria-pressed={state.theme === option.id}
                    onClick={() => setTheme(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="settings-field"
              style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
            >
              <div className="settings-item__info">
                <div className="settings-item__title">Theme Style</div>
                <div className="settings-item__desc">
                  Pick the surface language for panels, spacing, and strokes.
                </div>
              </div>
              <ThemeStylePicker
                value={state.themeStyle}
                onChange={setThemeStyle}
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
              View Preferences
            </div>
            {/* Show Title */}
            <div
              className="settings-item"
              style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
            >
              <div className="settings-item__info">
                <div className="settings-item__title">Sidebar File Labels</div>
                <div className="settings-item__desc">
                  Show document titles/H1 headers instead of raw filenames in
                  the sidebar tree.
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

            {/* Default HTML Preview */}
            <div
              className="settings-item"
              style={{ borderTop: "1px solid var(--bd)", paddingTop: "16px" }}
            >
              <div className="settings-item__info">
                <div className="settings-item__title">
                  Default HTML Code Block View
                </div>
                <div className="settings-item__desc">
                  Show HTML code blocks as interactive previews by default.
                  Otherwise, shows the raw HTML code.
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
                Keyboard Shortcuts
              </div>
              <div className="settings-shortcuts-hint">
                Click a field and press your new keys.
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
                    key={act.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--tx2)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{act.label}</span>
                    </div>
                    <input
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
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "16px",
              }}
            >
              <button
                type="button"
                className="settings-reset-shortcuts-btn"
                onClick={() =>
                  updateSettings({ keybindings: DEFAULT_KEYBINDINGS })
                }
              >
                Reset to Default Shortcuts
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
