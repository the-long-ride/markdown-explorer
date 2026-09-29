import type { ReactNode } from 'react';
import type { AppSettings } from '../../types';
import type { AppState } from '../../contexts/appStateReducer';
import { getFeatureSettingsTranslations } from '../../contexts/featureSettingsTranslations';
import { getEnabledShortcut, formatShortcutLabel } from '../../utils/shortcuts';
import { normalizeMaxPinnedItems } from '../Sidebar/sidebarWorkspacePreferences';
import { supportsWorkspaceInsights } from '../../insights/runtimeCapabilities';
import { FeatureSettingRow, FeatureSwitch } from './FeatureSettingRow';

type SettingsFeaturesSectionProps = {
  state: AppState;
  t: any;
  isDesktop: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
};

export type FeatureSettingGroup = {
  id: string;
  title: string;
  /** Unavailable rows for the current host/runtime are `false`/`null`. */
  rows: ReadonlyArray<ReactNode | false | null | undefined>;
};

export type VisibleFeatureSettingGroup = {
  id: string;
  title: string;
  rows: ReactNode[];
};

/** Drops unavailable rows and any group left without rows, so no empty section renders. */
export function getVisibleFeatureGroups(groups: ReadonlyArray<FeatureSettingGroup>): VisibleFeatureSettingGroup[] {
  return groups
    .map((group) => ({ id: group.id, title: group.title, rows: group.rows.filter(Boolean) as ReactNode[] }))
    .filter((group) => group.rows.length > 0);
}

export function SettingsFeaturesSection({ state, t, isDesktop, updateSettings }: SettingsFeaturesSectionProps) {
  const featureT = getFeatureSettingsTranslations(state.settings.language);
  const toggleHtmlPreview = formatShortcutLabel(getEnabledShortcut(state.settings, 'toggleHtmlPreview') || '');
  const htmlPreviewDescription = toggleHtmlPreview
    ? t.htmlPreviewDesc.replace('{shortcut}', `(${toggleHtmlPreview})`)
    : t.htmlPreviewDesc.replace('{shortcut}', '');

  const groups: FeatureSettingGroup[] = [
    {
      id: 'navigation',
      title: featureT.groupNavigation,
      rows: [
        <FeatureSettingRow key="sidebar-labels" id="sidebar-labels" title={t.sidebarLabels} description={t.sidebarLabelsDesc}>
          {(ids) => (
            <FeatureSwitch
              ids={ids}
              checked={state.settings.showTitle}
              onChange={(event) => updateSettings({ showTitle: event.target.checked })}
            />
          )}
        </FeatureSettingRow>,
        <FeatureSettingRow key="file-tabs" id="file-tabs" title={t.fileTabs} description={t.fileTabsDesc}>
          {(ids) => (
            <FeatureSwitch
              ids={ids}
              checked={state.settings.fileTabs}
              onChange={(event) => updateSettings({ fileTabs: event.target.checked })}
            />
          )}
        </FeatureSettingRow>,
        <FeatureSettingRow
          key="history-sidebar-enabled"
          id="history-sidebar-enabled"
          title={featureT.historySidebarEnabled}
          description={featureT.historySidebarEnabledDesc}
        >
          {(ids) => (
            <FeatureSwitch
              ids={ids}
              checked={state.settings.historySidebarEnabled}
              onChange={(event) => updateSettings({ historySidebarEnabled: event.target.checked })}
            />
          )}
        </FeatureSettingRow>,
        <FeatureSettingRow key="max-pinned-items" id="max-pinned-items" title={t.maxPinnedItems} description={t.maxPinnedItemsDesc}>
          {(ids) => (
            <input
              id={ids.controlId}
              type="number"
              className="settings-number-input"
              min={1}
              max={15}
              step={1}
              value={normalizeMaxPinnedItems(state.settings.maxPinnedItems)}
              aria-labelledby={ids.titleId}
              aria-describedby={ids.descriptionId}
              onChange={(event) => updateSettings({
                maxPinnedItems: normalizeMaxPinnedItems(event.target.value),
              })}
            />
          )}
        </FeatureSettingRow>,
      ],
    },
    {
      id: 'tools',
      title: featureT.groupTools,
      rows: [
        <FeatureSettingRow key="bookmarks-enabled" id="bookmarks-enabled" title={t.bookmarksEnabled} description={t.bookmarksEnabledDesc}>
          {(ids) => (
            <FeatureSwitch
              ids={ids}
              checked={state.settings.bookmarksEnabled}
              onChange={(event) => updateSettings({ bookmarksEnabled: event.target.checked })}
            />
          )}
        </FeatureSettingRow>,
        supportsWorkspaceInsights(state.appRuntime) && (
          <FeatureSettingRow key="insights-enabled" id="insights-enabled" title={t.insightsEnabled} description={t.insightsEnabledDesc}>
            {(ids) => (
              <FeatureSwitch
                ids={ids}
                checked={state.settings.insightsEnabled}
                onChange={(event) => updateSettings({ insightsEnabled: event.target.checked })}
              />
            )}
          </FeatureSettingRow>
        ),
        <FeatureSettingRow
          key="markdown-editing-enabled"
          id="markdown-editing-enabled"
          title={featureT.markdownEditingEnabled}
          description={featureT.markdownEditingEnabledDesc}
        >
          {(ids) => (
            <FeatureSwitch
              ids={ids}
              checked={state.settings.markdownEditingEnabled}
              onChange={(event) => updateSettings({ markdownEditingEnabled: event.target.checked })}
            />
          )}
        </FeatureSettingRow>,
        isDesktop && (
          <FeatureSettingRow
            key="document-conversion"
            id="document-conversion"
            title={t.documentConversion}
            description={t.documentConversionDesc}
          >
            {(ids) => (
              <FeatureSwitch
                ids={ids}
                checked={state.settings.documentConversion}
                onChange={(event) => updateSettings({ documentConversion: event.target.checked })}
              />
            )}
          </FeatureSettingRow>
        ),
      ],
    },
    {
      id: 'previews',
      title: featureT.groupPreviews,
      rows: [
        <FeatureSettingRow key="html-preview" id="html-preview" title={t.htmlPreview} description={htmlPreviewDescription}>
          {(ids) => (
            <FeatureSwitch
              ids={ids}
              checked={state.settings.defaultHtmlPreview}
              onChange={(event) => updateSettings({ defaultHtmlPreview: event.target.checked })}
            />
          )}
        </FeatureSettingRow>,
        <FeatureSettingRow
          key="allow-upstream-html-preview"
          id="allow-upstream-html-preview"
          title={t.allowUpstreamHtmlPreview}
          description={t.allowUpstreamHtmlPreviewDesc}
        >
          {(ids) => (
            <FeatureSwitch
              ids={ids}
              checked={state.settings.allowUpstreamHtmlPreview}
              onChange={(event) => updateSettings({ allowUpstreamHtmlPreview: event.target.checked })}
            />
          )}
        </FeatureSettingRow>,
        <FeatureSettingRow
          key="html-code-block-preview"
          id="html-code-block-preview"
          title={t.htmlCodeBlockPreview}
          description={t.htmlCodeBlockPreviewDesc}
        >
          {(ids) => (
            <FeatureSwitch
              ids={ids}
              checked={state.settings.defaultHtmlCodeBlockPreview}
              onChange={(event) => updateSettings({ defaultHtmlCodeBlockPreview: event.target.checked })}
            />
          )}
        </FeatureSettingRow>,
        <FeatureSettingRow key="csv-preview" id="csv-preview" title={t.csvPreview} description={t.csvPreviewDesc}>
          {(ids) => (
            <FeatureSwitch
              ids={ids}
              checked={state.settings.defaultCsvPreview}
              onChange={(event) => updateSettings({ defaultCsvPreview: event.target.checked })}
            />
          )}
        </FeatureSettingRow>,
      ],
    },
  ];

  return (
    <section className="settings-section-panel settings-features-section" aria-labelledby="settings-features-heading">
      <div className="settings-section-panel__header">
        <h3 id="settings-features-heading">{featureT.features}</h3>
        <p>{featureT.featuresDesc}</p>
      </div>
      <div className="settings-feature-groups">
        {getVisibleFeatureGroups(groups).map((group) => (
          <section
            key={group.id}
            className="settings-feature-group"
            data-group-id={group.id}
            aria-labelledby={`settings-feature-group-${group.id}`}
          >
            <h4 id={`settings-feature-group-${group.id}`} className="settings-feature-group__title">
              {group.title}
            </h4>
            <div className="settings-feature-group__card">{group.rows}</div>
          </section>
        ))}
      </div>
    </section>
  );
}
