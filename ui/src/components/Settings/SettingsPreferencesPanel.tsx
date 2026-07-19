import type { AppSettings, ThemeMode, ThemeStyle } from '../../types';
import type { AppState } from '../../contexts/appStateReducer';
import { THEME_MODE_OPTIONS } from '../../contexts/appStateConstants';
import { ThemeStylePicker } from './ThemeStylePicker';

type SettingsPreferencesPanelProps = {
  state: AppState;
  t: any;
  isDesktop: boolean;
  setTheme: (theme: ThemeMode) => void;
  setThemeStyle: (themeStyle: ThemeStyle) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  onOpenThemeRemix: () => void;
};

export function SettingsPreferencesPanel({
  state,
  t,
  isDesktop,
  setTheme,
  setThemeStyle,
  updateSettings,
  onOpenThemeRemix,
}: SettingsPreferencesPanelProps) {
  return (
<>
{/* Left Column: Preferences */}
<div
  className="settings-card__column settings-card__column--preferences"
  
>
  <div
    className="settings-panel-heading">
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
    className="settings-field settings-field--separated"
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
      onOpenThemeRemix={onOpenThemeRemix}
    />
  </div>

  <div
    className="settings-panel-heading settings-panel-heading--secondary"
  >
    {t.viewPrefs}
  </div>
  {isDesktop && (
    <div
      className="settings-field settings-field--separated"
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
    className="settings-item settings-item--separated"
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
    className="settings-item settings-item--separated"
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
      className="settings-item settings-item--document-conversion settings-item--separated"
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
    className="settings-item settings-item--separated"
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
</>
  );
}
