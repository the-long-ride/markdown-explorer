import { useEffect } from 'react';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { useRepositorySnapshot } from '../../contexts/RepositorySnapshotContext';
import { GitCommitGraph } from './GitCommitGraph';

export function RepositoryHistoryPanel({ visible, language }: { visible: boolean; language?: string }) {
  const t = getHistoryTranslations(language);
  const {
    state,
    commits,
    capability,
    loadHistory,
    activateWorkspaceRevision,
    openSnapshotFile,
    returnToHead,
  } = useRepositorySnapshot();

  useEffect(() => {
    if (!visible || capability?.supported !== true || state.status !== 'idle') return;
    void loadHistory();
  }, [capability?.supported, loadHistory, state.status, visible]);

  if (!visible) return null;

  return (
    <section className="repository-history" aria-label={t.repositoryHistory}>
      <header className="repository-history__header">
        <div>
          <h3>{t.repositoryHistory}</h3>
          <p>{t.repositoryHistoryTooltip}</p>
        </div>
        {(state.selectedOid || state.activeFile) && (
          <button type="button" className="btn repository-history__head-action" onClick={returnToHead}>
            {t.backToHead}
          </button>
        )}
      </header>

      {state.status === 'loading-history' && <div className="repository-history__status" role="status">{t.loadingRepositoryHistory}</div>}
      {state.status === 'error' && (
        <div className="repository-history__status repository-history__status--error" role="status">
          <span>{state.error || t.repositoryHistoryUnavailable}</span>
          <button type="button" className="btn" onClick={() => { void loadHistory(); }}>{t.retry}</button>
        </div>
      )}
      {state.status !== 'loading-history' && state.status !== 'error' && commits.length === 0 && (
        <div className="repository-history__status" role="status">{t.noRepositoryHistory}</div>
      )}

      {commits.length > 0 && (
        <div className="repository-history__body">
          <GitCommitGraph
            commits={commits}
            selectedOid={state.selectedOid}
            headLabel={t.head}
            browseLabel={t.browseCommit}
            onActivateRevision={(oid) => { void activateWorkspaceRevision(oid); }}
            onReturnToHead={returnToHead}
          />

          {state.selectedOid && (
            <div className="repository-history__files">
              <h4>{t.commitFiles}</h4>
              {state.status === 'loading-files' && <div role="status">{t.loadingRevisionFiles}</div>}
              {state.status !== 'loading-files' && state.files.length === 0 && <div role="status">{t.noRevisionFiles}</div>}
              {state.files.length > 0 && (
                <ul className="repository-history__file-list">
                  {state.files.map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        className={`repository-history__file${state.activePath === file.path ? ' is-active' : ''}`}
                        title={t.openSnapshotFile}
                        onClick={() => { void openSnapshotFile(file.path); }}
                      >
                        <span>{file.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
