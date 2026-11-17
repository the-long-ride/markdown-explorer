import { useState } from 'react';
import type { AppSettings, ThemeMode, ThemeStyle } from '../../types';
import type { AppState } from '../../contexts/appStateReducer';
import { THEME_MODE_OPTIONS } from '../../contexts/appStateConstants';
import { ThemeStylePicker } from './ThemeStylePicker';
import { executeThemeTransition } from '../../utils/themeTransition';
import { getEnabledShortcut, formatShortcutLabel } from '../../utils/shortcuts';
import { parseShortcutText } from '../shared/parseShortcutText';
import { DesktopTypographySettings } from './DesktopTypographySettings';
import { SettingsFeaturesSection } from './SettingsFeaturesSection';
import { AppearanceRowIcon } from './settingsRowIcons';
import { TableAlignmentInfoDialog } from './TableAlignmentInfoDialog';

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
  const [showTableAlignInfo, setShowTableAlignInfo] = useState(false);
  const toggleDesktopViewMode = formatShortcutLabel(getEnabledShortcut(state.settings, 'toggleDesktopViewMode') || '');
  const withShortcut = (description: string, shortcut: string) => {
    if (shortcut) return description.replace('{shortcut}', '(' + shortcut + ')');
    const cleaned = description.replace(/\s*[^.!?\n]*\{shortcut\}[^.!?\n]*\.?/i, '').trim();
    return cleaned || description.replace('{shortcut}', '').trim();
  };

  return (
    <div className="settings-card__column settings-card__column--preferences settings-card__column--section">
      {section === 'appearance' && (
        <section className="settings-section-panel settings-appearance-section">
          <div className="settings-section-panel__header">
            <h3>{t.appearance}</h3>
            <p>{t.subtitle}</p>
          </div>
          <div className="settings-field">
            <div className="settings-item__header">
              <span className="settings-item__icon" aria-hidden="true"><AppearanceRowIcon id="colorMode" /></span>
              <div className="settings-item__info">
                <div className="settings-item__title">{t.colorMode}</div>
                <div id="settings-color-mode-description" className="settings-item__desc">{t.colorModeDesc}</div>
              </div>
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
                    onClick={(e) => {
                      executeThemeTransition(() => setTheme(option.id), {
                        originElement: e.currentTarget,
                        event: e,
                        nextTheme: option.id,
                        themeStyle: state.themeStyle,
                      });
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-appearance-controls">
            {(isDesktop || typeof (window as any).__webBus !== 'undefined' || state.appRuntime === 'web') && (
              <div data-row-id="desktop-view" className="settings-preference-row settings-field settings-item--separated">
                <div className="settings-item__header">
                  <span className="settings-item__icon" aria-hidden="true"><AppearanceRowIcon id="desktopView" /></span>
                  <div className="settings-item__info">
                    <div className="settings-item__title">{t.desktopView}</div>
                    <div id="settings-desktop-view-description" className="settings-item__desc">
                      {parseShortcutText(withShortcut(t.desktopViewDesc, toggleDesktopViewMode))}
                    </div>
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
            <div data-row-id="table-alignment" className="settings-preference-row settings-field settings-item--separated">
              <div className="settings-item__header settings-item__header--with-action">
                <span className="settings-item__icon" aria-hidden="true"><AppearanceRowIcon id="tableAlignment" /></span>
                <div className="settings-item__info">
                  <div className="settings-item__title">{t.tableAlignment ?? 'Data Table Alignment'}</div>
                  <div id="settings-table-alignment-description" className="settings-item__desc">
                    {t.tableAlignmentDesc ?? 'Default cell alignment for rendered Markdown and CSV data tables.'}
                  </div>
                </div>
                <button
                  type="button"
                  className="settings-info-icon-btn"
                  aria-label={t.tableAlignmentInfoLabel ?? 'Data Table Alignment information'}
                  onClick={() => setShowTableAlignInfo(true)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </button>
              </div>
              <div
                className="segmented-control segmented-control--quad settings-table-align-switch"
                role="radiogroup"
                aria-label={t.tableAlignment ?? 'Data Table Alignment'}
                aria-describedby="settings-table-alignment-description"
              >
                {(['left', 'center', 'right', 'intelligent'] as const).map((alignId) => {
                  const currentAlign = state.settings.tableColumnAlignment ?? 'intelligent';
                  const label =
                    alignId === 'left'
                      ? (t.alignLeft ?? 'Left')
                      : alignId === 'center'
                        ? (t.alignMiddle ?? 'Middle')
                        : alignId === 'right'
                          ? (t.alignRight ?? 'Right')
                          : t.alignIntelligent;
                  return (
                    <button
                      key={alignId}
                      type="button"
                      className={`segmented-option${currentAlign === alignId ? ' is-active' : ''}`}
                      aria-pressed={currentAlign === alignId}
                      onClick={() => updateSettings({ tableColumnAlignment: alignId })}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
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
      {showTableAlignInfo && (
        <TableAlignmentInfoDialog
          onClose={() => setShowTableAlignInfo(false)}
          closeLabel={t.close ?? 'Close'}
        />
      )}
    </div>
  );
}
