import { useRef, useState, type ReactNode } from 'react';
import type { AppSettings, ThemeMode, ThemeStyle } from '../../types';
import type { AppState } from '../../contexts/appStateReducer';
import { THEME_MODE_OPTIONS } from '../../contexts/appStateConstants';
import { ThemeStylePicker } from './ThemeStylePicker';
import { PreferenceDescriptionTooltip } from './PreferenceDescriptionTooltip';
import { getEnabledShortcut, formatShortcutLabel } from '../../utils/shortcuts';

type SettingsPreferencesPanelProps = {
  state: AppState;
  t: any;
  isDesktop: boolean;
  setTheme: (theme: ThemeMode) => void;
  setThemeStyle: (themeStyle: ThemeStyle) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  onOpenThemeRemix: () => void;
};

function PreferenceRow({
  id,
  title,
  description,
  children,
  field = false,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  field?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const tooltipId = `${id}-description`;

  return (
    <>
      <div
        ref={rowRef}
        data-row-id={id}
        className={`settings-preference-row ${field ? 'settings-field' : 'settings-item'} settings-item--separated`}
        tabIndex={0}
        aria-describedby={tooltipId}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false);
        }}
      >
        <div className="settings-item__info">
          <div className="settings-item__title">{title}</div>
        </div>
        {children}
      </div>
      <PreferenceDescriptionTooltip
        id={tooltipId}
        description={description}
        anchor={rowRef.current}
        visible={hovered || focused}
      />
    </>
  );
}

export function SettingsPreferencesPanel({
  state,
  t,
  isDesktop,
  setTheme,
  setThemeStyle,
  updateSettings,
  onOpenThemeRemix,
}: SettingsPreferencesPanelProps) {
  const toggleDesktopViewMode = formatShortcutLabel(getEnabledShortcut(state.settings, 'toggleDesktopViewMode') || '');
  const toggleHtmlPreview = formatShortcutLabel(getEnabledShortcut(state.settings, 'toggleHtmlPreview') || '');
  const withShortcut = (description: string, shortcut: string) => description.replace('{shortcut}', shortcut);

  return (
    <div className="settings-card__column settings-card__column--preferences">
      <div className="settings-panel-heading">{t.appearance}</div>
      <div className="settings-field">
        <div className="settings-item__info">
          <div className="settings-item__title">{t.colorMode}</div>
          <div className="settings-item__desc">{t.colorModeDesc}</div>
        </div>
        <div className="segmented-control" role="radiogroup" aria-label={t.colorMode}>
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

      <div className="settings-panel-heading settings-panel-heading--secondary">{t.viewPrefs}</div>

      <div className="settings-appearance-controls">
        {isDesktop && (
        <PreferenceRow
          id="desktop-view"
          title={t.desktopView}
          description={withShortcut(t.desktopViewDesc, toggleDesktopViewMode)}
          field
        >
          <div className="segmented-control segmented-control--two" role="radiogroup" aria-label={t.desktopView}>
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
        </PreferenceRow>
      )}

      <PreferenceRow id="sidebar-labels" title={t.sidebarLabels} description={t.sidebarLabelsDesc}>
        <label className="switch-toggle" aria-label={t.sidebarLabels}>
          <input
            type="checkbox"
            checked={state.settings.showTitle}
            onChange={(event) => updateSettings({ showTitle: event.target.checked })}
          />
          <span className="switch-slider" />
        </label>
      </PreferenceRow>

      <PreferenceRow id="file-tabs" title={t.fileTabs} description={t.fileTabsDesc}>
        <label className="switch-toggle" aria-label={t.fileTabs}>
          <input
            type="checkbox"
            checked={state.settings.fileTabs}
            onChange={(event) => updateSettings({ fileTabs: event.target.checked })}
          />
          <span className="switch-slider" />
        </label>
      </PreferenceRow>

      {isDesktop && (
        <PreferenceRow
          id="document-conversion"
          title={t.documentConversion}
          description={t.documentConversionDesc}
        >
          <label className="switch-toggle" aria-label={t.documentConversion}>
            <input
              type="checkbox"
              checked={state.settings.documentConversion}
              onChange={(event) => updateSettings({ documentConversion: event.target.checked })}
            />
            <span className="switch-slider" />
          </label>
        </PreferenceRow>
      )}

      <PreferenceRow id="html-preview" title={t.htmlPreview} description={withShortcut(t.htmlPreviewDesc, toggleHtmlPreview)}>
        <label className="switch-toggle" aria-label={t.htmlPreview}>
          <input
            type="checkbox"
            checked={state.settings.defaultHtmlPreview}
            onChange={(event) => updateSettings({ defaultHtmlPreview: event.target.checked })}
          />
          <span className="switch-slider" />
        </label>
      </PreferenceRow>

      <PreferenceRow id="html-code-block-preview" title={t.htmlCodeBlockPreview} description={t.htmlCodeBlockPreviewDesc}>
        <label className="switch-toggle" aria-label={t.htmlCodeBlockPreview}>
          <input
            type="checkbox"
            checked={state.settings.defaultHtmlCodeBlockPreview}
            onChange={(event) => updateSettings({ defaultHtmlCodeBlockPreview: event.target.checked })}
          />
          <span className="switch-slider" />
        </label>
      </PreferenceRow>

      <PreferenceRow id="csv-preview" title={t.csvPreview} description={t.csvPreviewDesc}>
        <label className="switch-toggle" aria-label={t.csvPreview}>
          <input
            type="checkbox"
            checked={state.settings.defaultCsvPreview}
            onChange={(event) => updateSettings({ defaultCsvPreview: event.target.checked })}
          />
          <span className="switch-slider" />
        </label>
      </PreferenceRow>

      </div>

      <div className="settings-field settings-field--separated settings-theme-style-section">
        <div className="settings-item__info">
          <div className="settings-item__title">{t.themeStyle}</div>
          <div className="settings-item__desc">{t.themeStyleDesc}</div>
        </div>
        <ThemeStylePicker
          value={state.themeStyle}
          onChange={setThemeStyle}
          showCustomThemes
          onOpenThemeRemix={onOpenThemeRemix}
        />
      </div>
    </div>
  );
}
