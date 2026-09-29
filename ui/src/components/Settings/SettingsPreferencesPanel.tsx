import type { AppSettings, ThemeMode, ThemeStyle } from '../../types';
import type { AppState } from '../../contexts/appStateReducer';
import { THEME_MODE_OPTIONS } from '../../contexts/appStateConstants';
import { ThemeStylePicker } from './ThemeStylePicker';
import { getEnabledShortcut, formatShortcutLabel } from '../../utils/shortcuts';
import { parseShortcutText } from '../shared/parseShortcutText';
import { DesktopTypographySettings } from './DesktopTypographySettings';
import { SettingsFeaturesSection } from './SettingsFeaturesSection';

export type SettingsPreferencesSection = 'appearance' | 'typography' | 'theme' | 'features';

type SettingsPreferencesPanelProps = {
  section?: SettingsPreferencesSection;
  state: AppState;
  t: any;
  isDesktop: boolean;
  supportsTypography: boolean;
  setTheme: (theme: ThemeMode) => void;
  setThemeStyle: (themeStyle: ThemeStyle) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  onOpenThemeRemix: () => void;
};

export function SettingsPreferencesPanel({
  section = 'appearance',
  state,
  t,
  isDesktop,
  supportsTypography,
  setTheme,
  setThemeStyle,
  updateSettings,
  onOpenThemeRemix,
}: SettingsPreferencesPanelProps) {
  const toggleDesktopViewMode = formatShortcutLabel(getEnabledShortcut(state.settings, 'toggleDesktopViewMode') || '');
  const withShortcut = (description: string, shortcut: string) =>
    shortcut ? description.replace('{shortcut}', `(${shortcut})`) : description.replace('{shortcut}', '');

  return (
    <div className="settings-card__column settings-card__column--preferences settings-card__column--section">
      {section === 'appearance' && (
        <section className="settings-section-panel settings-appearance-section">
          <div className="settings-section-panel__header">
            <h3>{t.appearance}</h3>
            <p>{t.subtitle}</p>
          </div>
          <div className="settings-field">
            <div className="settings-item__info">
              <div className="settings-item__title">{t.colorMode}</div>
              <div id="settings-color-mode-description" className="settings-item__desc">{t.colorModeDesc}</div>
            </div>
            <div className="segmented-control" role="radiogroup" aria-label={t.colorMode} aria-describedby="settings-color-mode-description">
              {THEME_MODE_OPTIONS.map((option) => {
                const label = option.id === 'auto' ? t.auto : option.id === 'light' ? t.light : t.dark;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`segmented-option${state.theme === option.id ? ' is-active' : ''}`}
                    aria-pressed={state.theme === option.id}
                    onClick={() => setTheme(option.id)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-appearance-controls">
            {isDesktop && (
              <div data-row-id="desktop-view" className="settings-preference-row settings-field settings-item--separated">
                <div className="settings-item__info">
                  <div className="settings-item__title">{t.desktopView}</div>
                  <div id="settings-desktop-view-description" className="settings-item__desc">
                    {parseShortcutText(withShortcut(t.desktopViewDesc, toggleDesktopViewMode))}
                  </div>
                </div>
                <div className="segmented-control segmented-control--two" role="radiogroup" aria-label={t.desktopView} aria-describedby="settings-desktop-view-description">
                  {(['focus', 'tabs'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`segmented-option${(state.settings.desktopViewMode ?? 'focus') === id ? ' is-active' : ''}`}
                      aria-pressed={(state.settings.desktopViewMode ?? 'focus') === id}
                      onClick={() => updateSettings({ desktopViewMode: id })}
                    >
                      {id === 'focus' ? t.focus : t.tabs}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {section === 'features' && (
        <SettingsFeaturesSection state={state} t={t} isDesktop={isDesktop} updateSettings={updateSettings} />
      )}

      {section === 'typography' && supportsTypography && (
        <DesktopTypographySettings state={state} t={t} updateSettings={updateSettings} />
      )}
      {section === 'theme' && (
        <section className="settings-section-panel settings-theme-style-section">
          <div className="settings-section-panel__header">
            <h3>{t.themeStyle}</h3>
            <p>{t.themeStyleDesc}</p>
          </div>
          <ThemeStylePicker
            value={state.themeStyle}
            onChange={setThemeStyle}
            showCustomThemes
            onOpenThemeRemix={onOpenThemeRemix}
          />
        </section>
      )}
    </div>
  );
}
