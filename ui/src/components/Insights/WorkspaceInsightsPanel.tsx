import { useEffect, useMemo, useState } from 'react';
import { useResize } from '../../hooks/useResize';
import { INSIGHTS_PANEL_WIDTH_STORAGE_KEY } from '../../constants/storage';
import { INSIGHTS_TRANSLATIONS, type InsightsTranslations } from '../../contexts/insightsTranslations';
import {
  DEFAULT_INSIGHTS_SETTINGS,
  type InsightsSettings as InsightsSettingsConfig,
  type InsightsSettingsInput,
  type InsightsWorkspaceOverrides,
} from '../../insights/config';
import type { WorkspaceInsightsSessionViewModel } from '../../insights/useWorkspaceInsights';
import { GalleryView } from './GalleryView';
import { LinksView } from './LinksView';
import { LintView } from './LintView';
import { DuplicatesView } from './DuplicatesView';
import { GraphView } from './GraphView';
import { RelatedView } from './RelatedView';
import { InsightsSettings } from './InsightsSettings';
import '../../styles/global/global-workspace-insights.css';

export type InsightsViewKey = 'gallery' | 'links' | 'lint' | 'duplicates' | 'graph' | 'related';

export interface WorkspaceInsightsPanelProps {
  readonly session: WorkspaceInsightsSessionViewModel;
  readonly labels?: InsightsTranslations;
  readonly settings?: InsightsSettingsConfig;
  readonly globalSettings?: InsightsSettingsConfig;
  readonly onGlobalSettingsChange?: (patch: InsightsSettingsInput) => void;
  readonly onSettingsChange?: (patch: InsightsWorkspaceOverrides) => void;
  readonly onResetWorkspaceOverrides?: () => void;
}

function template(value: string, replacements: Readonly<Record<string, string | number>>): string {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, String(replacement)),
    value,
  );
}

function statusText(session: WorkspaceInsightsSessionViewModel, labels: InsightsTranslations): string {
  if (session.status === 'indexing') {
    const total = Math.max(session.progress.total, session.progress.completed);
    const status = template(labels.indexing, { done: session.progress.completed, total });
    return session.progress.provisional ? `${status} · ${labels.provisional}` : status;
  }
  if (session.status === 'ready') return template(labels.ready, { count: session.snapshot.documents.size });
  if (session.status === 'paused') return labels.paused;
  if (session.status === 'error') return labels.errorState;
  return labels.notIndexed;
}

export function WorkspaceInsightsPanel({
  session,
  labels = INSIGHTS_TRANSLATIONS.en,
  settings = DEFAULT_INSIGHTS_SETTINGS,
  globalSettings,
  onGlobalSettingsChange,
  onSettingsChange,
  onResetWorkspaceOverrides,
}: WorkspaceInsightsPanelProps) {
  const [activeView, setActiveView] = useState<InsightsViewKey>('gallery');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useResize('insightsResize', 'workspaceInsightsPanel', session.panelOpen, {
    min: 320,
    max: 760,
    cssVar: '--insights-width',
    storageKey: INSIGHTS_PANEL_WIDTH_STORAGE_KEY,
    direction: 'rtl',
    mode: 'live',
  });

  useEffect(() => {
    const handle = document.getElementById('insightsResize');
    if (!handle) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const panel = document.getElementById('workspaceInsightsPanel');
      const cssValue = Number.parseFloat(document.documentElement.style.getPropertyValue('--insights-width'));
      const current = Number.isFinite(cssValue) && cssValue > 0 ? cssValue : panel?.offsetWidth || 420;
      const delta = event.key === 'ArrowLeft' ? 16 : -16;
      const next = Math.max(320, Math.min(760, current + delta));
      document.documentElement.style.setProperty('--insights-width', `${next}px`);
      try { localStorage.setItem(INSIGHTS_PANEL_WIDTH_STORAGE_KEY, String(next)); } catch { /* ignore storage failure */ }
    };
    handle.addEventListener('keydown', onKeyDown);
    return () => handle.removeEventListener('keydown', onKeyDown);
  }, [session.panelOpen]);

  const viewLabels = useMemo<ReadonlyArray<{ key: InsightsViewKey; label: string }>>(() => [
    { key: 'gallery', label: labels.gallery },
    { key: 'links', label: labels.links },
    { key: 'lint', label: labels.lint },
    { key: 'duplicates', label: labels.duplicates },
    { key: 'graph', label: labels.graph },
    { key: 'related', label: labels.related },
  ], [labels]);
  const activeLabel = useMemo(
    () => viewLabels.find(view => view.key === activeView)?.label ?? labels.gallery,
    [activeView, labels.gallery, viewLabels],
  );
  const documents = useMemo(() => [...session.snapshot.documents.values()], [session.snapshot]);
  const selectedPath = documents[0]?.path;

  let content: React.ReactNode;
  if (activeView === 'gallery') content = <GalleryView documents={documents} labels={labels} />;
  else if (activeView === 'links') content = (
    <LinksView
      snapshot={session.snapshot}
      documents={documents}
      labels={labels}
      externalResults={session.externalResults}
      externalCheckingEnabled={settings.externalLinks.enabled}
      onCheckExternalLinks={session.checkExternalLinks}
      onCancelExternalChecks={session.cancelExternalChecks}
    />
  );
  else if (activeView === 'lint') content = (
    <LintView
      documents={documents}
      labels={labels}
      suppressions={settings.lintSuppressions}
      onSuppressionsChange={next => onSettingsChange?.({ lintSuppressions: next })}
    />
  );
  else if (activeView === 'duplicates') content = (
    <DuplicatesView
      documents={documents}
      labels={labels}
      threshold={settings.nearDuplicateThreshold}
      suppressions={settings.duplicateSuppressions}
      onSuppressionsChange={next => onSettingsChange?.({ duplicateSuppressions: next })}
    />
  );
  else if (activeView === 'graph') content = <GraphView snapshot={session.snapshot} labels={labels} nodeCap={settings.graphNodeCap} centerPath={selectedPath} />;
  else content = (
    <RelatedView
      documents={documents}
      labels={labels}
      selectedPath={selectedPath}
      preset={settings.relationshipPreset === 'custom' ? 'default' : settings.relationshipPreset}
      weights={settings.relationshipPreset === 'custom' ? settings.relationshipWeights : undefined}
    />
  );

  return (
    <aside id="workspaceInsightsPanel" className="workspace-insights" role="region" aria-label={labels.title}>
      <header className="workspace-insights__header">
        <div>
          <h2 className="workspace-insights__title">{labels.title}</h2>
          <div className="workspace-insights__status" role="status" aria-live="polite">
            {statusText(session, labels)}{session.workerMode === 'degraded' ? ` · ${labels.degraded}` : ''}
          </div>
        </div>
        <div className="workspace-insights__actions">
          {session.status === 'indexing' && <button type="button" className="btn btn--sm" onClick={session.pause} aria-label={`${labels.cancel} ${labels.title}`}>{labels.cancel}</button>}
          <button type="button" className="btn btn--sm" onClick={() => void session.refreshLocal()} aria-label={`${labels.refresh} ${labels.entry}`}>{labels.refresh}</button>
          <button type="button" className="btn btn--sm" onClick={() => setSettingsOpen(open => !open)} aria-label={`${labels.entry} ${labels.settings}`}>{labels.settings}</button>
          <button type="button" className="btn btn--sm btn--icon" onClick={session.closePanel} aria-label={labels.close}>×</button>
        </div>
      </header>

      {session.warnings.length > 0 && <div className="workspace-insights__warnings" role="status">{template(labels.indexingWarnings, { count: session.warnings.length })}</div>}

      <div className="workspace-insights__tabs" role="tablist" aria-label={labels.title}>
        {viewLabels.map(view => (
          <button key={view.key} type="button" role="tab" aria-selected={activeView === view.key} className={`workspace-insights__tab${activeView === view.key ? ' is-active' : ''}`} onClick={() => setActiveView(view.key)}>{view.label}</button>
        ))}
      </div>

      {settingsOpen && (
        <InsightsSettings
          session={session}
          labels={labels}
          settings={settings}
          globalSettings={globalSettings}
          onGlobalSettingsChange={onGlobalSettingsChange}
          onSettingsChange={onSettingsChange}
          onResetWorkspaceOverrides={onResetWorkspaceOverrides}
        />
      )}
      <div className="workspace-insights__content" role="tabpanel" aria-label={activeLabel}>{content}</div>
    </aside>
  );
}
