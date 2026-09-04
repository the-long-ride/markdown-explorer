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
import { TooltipButton } from '../shared/TooltipButton';

import type { JumpLocation } from '../../insights/jumpToLocation';
import type { MediaGallery } from '../Modal/mediaGallery';

export type InsightsViewKey = 'gallery' | 'links' | 'lint' | 'duplicates' | 'graph' | 'related';

export interface WorkspaceInsightsPanelProps {
  readonly session: WorkspaceInsightsSessionViewModel;
  readonly labels?: InsightsTranslations;
  readonly settings?: InsightsSettingsConfig;
  readonly globalSettings?: InsightsSettingsConfig;
  readonly onGlobalSettingsChange?: (patch: InsightsSettingsInput) => void;
  readonly onSettingsChange?: (patch: InsightsWorkspaceOverrides) => void;
  readonly onResetWorkspaceOverrides?: () => void;
  readonly onSelectPath?: (path: string, location?: JumpLocation) => void;
  readonly onOpenMedia?: (gallery: MediaGallery) => void;
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
  onSelectPath,
  onOpenMedia,
}: WorkspaceInsightsPanelProps) {
  const [activeView, setActiveView] = useState<InsightsViewKey>('gallery');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useResize('insightsResize', 'workspaceInsightsPanel', session.panelOpen, {
    min: 390,
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
      const next = Math.max(390, Math.min(760, current + delta));
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
  const tabCounts = useMemo<Partial<Record<InsightsViewKey, number>>>(() => {
    const lintCount = documents.reduce((acc, doc) => acc + doc.lint.length, 0);
    const brokenLinksCount = session.snapshot.brokenLinks.length;
    return { links: brokenLinksCount, lint: lintCount };
  }, [documents, session.snapshot.brokenLinks.length]);

  let content: React.ReactNode;
  if (activeView === 'gallery') content = <GalleryView documents={documents} labels={labels} onSelectPath={onSelectPath} onOpenMedia={onOpenMedia} />;
  else if (activeView === 'links') content = (
    <LinksView
      snapshot={session.snapshot}
      documents={documents}
      labels={labels}
      externalResults={session.externalResults}
      externalCheckingEnabled={settings.externalLinks.enabled}
      onCheckExternalLinks={session.checkExternalLinks}
      onCancelExternalChecks={session.cancelExternalChecks}
      onSelectPath={onSelectPath}
    />
  );
  else if (activeView === 'lint') content = (
    <LintView
      documents={documents}
      labels={labels}
      suppressions={settings.lintSuppressions}
      onSuppressionsChange={next => onSettingsChange?.({ lintSuppressions: next })}
      onSelectFinding={finding => onSelectPath?.(finding.path, {
        line: finding.line,
        sourceStart: finding.sourceStart,
        sourceEnd: finding.sourceEnd,
      })}
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
  else if (activeView === 'graph') content = <GraphView snapshot={session.snapshot} labels={labels} nodeCap={settings.graphNodeCap} centerPath={selectedPath} onSelectPath={onSelectPath} />;
  else content = (
    <RelatedView
      documents={documents}
      labels={labels}
      selectedPath={selectedPath}
      preset={settings.relationshipPreset === 'custom' ? 'default' : settings.relationshipPreset}
      weights={settings.relationshipPreset === 'custom' ? settings.relationshipWeights : undefined}
    />
  );

  const statusLabel = `${statusText(session, labels)}${session.workerMode === 'degraded' ? ` · ${labels.degraded}` : ''}`;

  return (
    <aside id="workspaceInsightsPanel" className="workspace-insights" role="region" aria-label={labels.title}>
      <header className="workspace-insights__header">
        <div className="workspace-insights__title-wrap">
          <h2 className="workspace-insights__title">{labels.title}</h2>
          <span className="workspace-insights__status" role="status" aria-live="polite" title={statusLabel}>
            {statusLabel}
          </span>
        </div>
        <div className="workspace-insights__actions">
          {session.status === 'indexing' && (
            <TooltipButton
              className="workspace-insights__action-btn"
              onClick={session.pause}
              tooltip={labels.cancel}
              tooltipPos="below"
              tooltipAlign="right"
              aria-label={`${labels.cancel} ${labels.title}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            </TooltipButton>
          )}
          <TooltipButton
            className="workspace-insights__action-btn"
            onClick={() => void session.refreshLocal()}
            tooltip={labels.refresh}
            tooltipPos="below"
            tooltipAlign="right"
            aria-label={`${labels.refresh} ${labels.entry}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.87" /></svg>
          </TooltipButton>
          <TooltipButton
            className={`workspace-insights__action-btn${settingsOpen ? ' is-active' : ''}`}
            onClick={() => setSettingsOpen(open => !open)}
            tooltip={labels.settings}
            tooltipPos="below"
            tooltipAlign="right"
            aria-label={`${labels.entry} ${labels.settings}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </TooltipButton>
          <TooltipButton
            className="workspace-insights__close"
            onClick={session.closePanel}
            tooltip={labels.close}
            shortcut="Esc"
            tooltipPos="below"
            tooltipAlign="right"
          >
            &times;
          </TooltipButton>
        </div>
      </header>

      {session.warnings.length > 0 && <div className="workspace-insights__warnings" role="status">{template(labels.indexingWarnings, { count: session.warnings.length })}</div>}

      <div className="workspace-insights__tabs" role="tablist" aria-label={labels.title}>
        {viewLabels.map(view => {
          const count = tabCounts[view.key];
          return (
            <button
              key={view.key}
              type="button"
              role="tab"
              aria-label={view.label}
              aria-selected={!settingsOpen && activeView === view.key}
              className={`workspace-insights__tab${!settingsOpen && activeView === view.key ? ' is-active' : ''}`}
              onClick={() => { setActiveView(view.key); setSettingsOpen(false); }}
            >
              <span>{view.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span className="workspace-insights__tab-badge">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {settingsOpen ? (
        <InsightsSettings
          session={session}
          labels={labels}
          settings={settings}
          globalSettings={globalSettings}
          onGlobalSettingsChange={onGlobalSettingsChange}
          onSettingsChange={onSettingsChange}
          onResetWorkspaceOverrides={onResetWorkspaceOverrides}
        />
      ) : (
        <div className="workspace-insights__content" role="tabpanel" aria-label={activeLabel}>{content}</div>
      )}
    </aside>
  );
}
