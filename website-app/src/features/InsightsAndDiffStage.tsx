// =============================================================================
// website-app/src/features/InsightsAndDiffStage.tsx
// Renders the real WorkspaceInsightsPanel (all 6 views + MediaModal) or
// Git History & Myers Diff (DocumentDiffView, FileHistoryModal, RepositoryHistoryPanel).
// =============================================================================

import { useContext, useMemo, useState } from 'react';
import { DocumentDiffView } from '../../../ui/src/components/History/DocumentDiffView';
import { FileHistoryModal } from '../../../ui/src/components/History/FileHistoryModal';
import { GitRevisionView } from '../../../ui/src/components/History/GitRevisionView';
import { RepositoryHistoryPanel } from '../../../ui/src/components/History/RepositoryHistoryPanel';
import { WorkspaceInsightsPanel } from '../../../ui/src/components/Insights/WorkspaceInsightsPanel';
import { MediaModal } from '../../../ui/src/components/Modal/MediaModal';
import type { MediaGallery } from '../../../ui/src/components/Modal/mediaGallery';
import { AppStateContext } from '../../../ui/src/contexts/AppStateContext';
import { useHistory } from '../../../ui/src/contexts/HistoryContext';
import { usePlatform } from '../../../ui/src/contexts/PlatformContext';
import { useRepositorySnapshot } from '../../../ui/src/contexts/RepositorySnapshotContext';
import { INSIGHTS_UI_TRANSLATIONS } from '../../../ui/src/contexts/insightsUiTranslations';
import { DEFAULT_INSIGHTS_SETTINGS } from '../../../ui/src/insights/config';
import { createDemoInsightsSession, type WorkspaceInsightsTabKey } from './demoInsightsFixture';
import { DEMO_DOCS, DEMO_WORKSPACE_PATH } from './demoMarkdownFixtures';

export interface InsightsAndDiffStageProps {
  readonly mode: 'insights' | 'git-diff';
  readonly onSelectDoc?: (path: string) => void;
  readonly language?: string;
  readonly onOpenDoc?: (path: string) => void;
  readonly onOpenMedia?: (gallery: MediaGallery) => void;
}

type GitSubMode = 'diff' | 'file-history' | 'repo-history';

const INSIGHTS_QUICK_TABS: readonly { key: WorkspaceInsightsTabKey; label: string }[] = [
  { key: 'gallery', label: 'Media Library' },
  { key: 'links', label: 'Links & Backlinks' },
  { key: 'lint', label: 'Link Lint' },
  { key: 'duplicates', label: 'Duplicates' },
  { key: 'graph', label: 'Link Graph' },
  { key: 'related', label: 'Related Docs' },
] as const;

const HISTORY_TARGET_FILES = [
  { path: 'docs/release-playbook.md', label: 'Release Playbook' },
  { path: 'docs/architecture-overview.md', label: 'Architecture' },
  { path: 'docs/metrics-benchmarks.md', label: 'Metrics & Charts' },
  { path: 'docs/design-system-themes.md', label: 'Design System' },
] as const;

function GitDiffAndHistoryStage({
  language,
}: {
  readonly language: string;
}) {
  const appStateCtx = useContext(AppStateContext);
  const bridge = usePlatform();
  const { client } = useHistory();
  const { state: snapshotState, returnToHead } = useRepositorySnapshot();

  const [gitSubMode, setGitSubMode] = useState<GitSubMode>('diff');
  const [historyFilePath, setHistoryFilePath] = useState<string>('docs/release-playbook.md');

  const playbook = DEMO_DOCS['docs/release-playbook.md'];
  const workspacePath = appStateCtx?.state.workspacePath ?? DEMO_WORKSPACE_PATH;

  return (
    <div className="demo-diff-stage" data-testid="demo-git-diff-stage">
      <div className="demo-stage-bar demo-stage-bar--wrap">
        <div className="demo-doc-pills" role="group" aria-label="Git and history views">
          <button
            type="button"
            className={`demo-pill-btn${gitSubMode === 'diff' ? ' is-active' : ''}`}
            aria-pressed={gitSubMode === 'diff'}
            data-testid="git-submode-diff"
            onClick={() => setGitSubMode('diff')}
          >
            Myers Document Diff
          </button>
          <button
            type="button"
            className={`demo-pill-btn${gitSubMode === 'file-history' ? ' is-active' : ''}`}
            aria-pressed={gitSubMode === 'file-history'}
            data-testid="git-submode-file-history"
            onClick={() => setGitSubMode('file-history')}
          >
            Commit Timeline Modal
          </button>
          <button
            type="button"
            className={`demo-pill-btn${gitSubMode === 'repo-history' ? ' is-active' : ''}`}
            aria-pressed={gitSubMode === 'repo-history'}
            data-testid="git-submode-repo-history"
            onClick={() => setGitSubMode('repo-history')}
          >
            Repository Commit Graph
          </button>
        </div>

        <div className="demo-stage-bar__actions">
          {gitSubMode === 'diff' ? (
            <span className="demo-stage-bar__label">
              Comparing <strong>docs/release-playbook.md</strong> — <code>3b18e04</code> vs <code>7f4a92c</code>
            </span>
          ) : (
            <label className="feature-theme-picker">
              <span className="feature-theme-picker__label">File:</span>
              <select
                className="feature-theme-select"
                aria-label="Commit history file"
                value={historyFilePath}
                onChange={(event) => setHistoryFilePath(event.target.value)}
              >
                {HISTORY_TARGET_FILES.map((item) => (
                  <option key={item.path} value={item.path}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="demo-diff-stage__body">
        {gitSubMode === 'repo-history' ? (
          <div className="demo-repo-history-split" data-testid="demo-repo-history-view">
            <div className="demo-repo-history-split__graph">
              <RepositoryHistoryPanel
                visible={true}
                language={language}
                hasWorkspace={true}
              />
            </div>
            <div className="demo-repo-history-split__preview">
              {snapshotState.activeFile ? (
                <GitRevisionView
                  snapshot={snapshotState.activeFile}
                  language={language}
                  onReturnToCurrent={returnToHead}
                />
              ) : (
                <div className="demo-capability-card">
                  <div className="demo-capability-card__head">
                    <div>
                      <span className="demo-capability-card__eyebrow">Revision Snapshot</span>
                      <h3 className="demo-capability-card__title">Browse Any Historical Commit</h3>
                    </div>
                  </div>
                  <div className="demo-capability-card__body">
                    <p className="demo-capability-card__copy">
                      Click any commit row in the Git Commit Graph on the left to inspect its file tree, then select a document to render that exact historical revision here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <DocumentDiffView
            leftSource={playbook.oldMarkdown ?? playbook.markdown}
            rightSource={playbook.newMarkdown ?? playbook.markdown}
            leftLabel="3b18e04 (Previous)"
            rightLabel="7f4a92c (Current)"
            language={language}
            defaultMode="source"
          />
        )}
      </div>

      {gitSubMode === 'file-history' && (
        <FileHistoryModal
          key={historyFilePath}
          filePath={historyFilePath}
          client={client}
          language={language}
          workspacePath={workspacePath}
          bridge={bridge}
          currentSource={() => DEMO_DOCS[historyFilePath]?.markdown ?? null}
          onClose={() => setGitSubMode('diff')}
        />
      )}
    </div>
  );
}

export function InsightsAndDiffStage({
  mode,
  onSelectDoc,
  language,
  onOpenDoc,
  onOpenMedia,
}: InsightsAndDiffStageProps) {
  const appStateCtx = useContext(AppStateContext);
  const activeLanguage = language ?? appStateCtx?.state.settings.language ?? 'en';
  const [activeTab, setActiveTab] = useState<WorkspaceInsightsTabKey>('gallery');
  const [statusNote, setStatusNote] = useState<string>('');
  const [localMediaGallery, setLocalMediaGallery] = useState<MediaGallery | null>(null);

  const handleDocJump = (path: string) => {
    setStatusNote(`Opened ${path} in workspace`);
    onSelectDoc?.(path);
    onOpenDoc?.(path);
  };

  const session = useMemo(
    () => createDemoInsightsSession(activeTab, setActiveTab, handleDocJump),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab],
  );

  if (mode === 'git-diff') {
    return <GitDiffAndHistoryStage language={activeLanguage} />;
  }

  const labels =
    INSIGHTS_UI_TRANSLATIONS[activeLanguage as keyof typeof INSIGHTS_UI_TRANSLATIONS] ??
    INSIGHTS_UI_TRANSLATIONS.en;

  const handleOpenMedia = onOpenMedia ?? setLocalMediaGallery;

  return (
    <div className="demo-insights-stage" data-testid="demo-insights-stage">
      <div className="demo-stage-bar demo-stage-bar--wrap">
        <div className="demo-doc-pills" role="group" aria-label="Workspace insights views">
          {INSIGHTS_QUICK_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={`demo-pill-btn${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <span className="demo-stage-bar__hint">
          {statusNote || 'Switch across all 6 offline workspace insight views'}
        </span>
      </div>

      <div className="demo-insights-stage__panel-host">
        <WorkspaceInsightsPanel
          session={session}
          labels={labels}
          settings={DEFAULT_INSIGHTS_SETTINGS}
          onSelectPath={(path) => {
            setStatusNote(`Jumped to ${path}`);
            onSelectDoc?.(path);
            onOpenDoc?.(path);
          }}
          onOpenMedia={handleOpenMedia}
        />
      </div>

      {!onOpenMedia && (
        <MediaModal gallery={localMediaGallery} onClose={() => setLocalMediaGallery(null)} />
      )}
    </div>
  );
}
