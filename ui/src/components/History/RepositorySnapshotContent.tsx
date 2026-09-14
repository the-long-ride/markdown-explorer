import { useMemo } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { useRepositorySnapshot } from '../../contexts/RepositorySnapshotContext';
import { renderMarkdownClientSide } from '../../contexts/contentTabState';

export function RepositorySnapshotContent() {
  const { state: appState } = useAppState();
  const { state, repositoryView, returnToHead } = useRepositorySnapshot();
  const t = getHistoryTranslations(appState.settings.language);
  const snapshot = state.activeFile;
  const revisionOid = repositoryView.mode === 'revision' ? repositoryView.oid : null;
  const isMarkdown = Boolean(snapshot && /\.mdx?$/i.test(snapshot.path));
  const rendered = useMemo(() => {
    if (!snapshot || !isMarkdown) return null;
    return renderMarkdownClientSide(snapshot.source, snapshot.path, /\.mdx$/i.test(snapshot.path), appState.settings);
  }, [appState.settings, isMarkdown, snapshot]);

  if (!revisionOid) return null;

  return (
    <main className="content repository-snapshot-content" id="mainContent" data-testid="repository-snapshot-content">
      <header className="repository-snapshot-content__header">
        <div className="repository-snapshot-content__identity">
          <span className="repository-snapshot-content__readonly">{t.snapshotReadOnly}</span>
          {snapshot && <strong title={snapshot.path}>{snapshot.path}</strong>}
          <code>{revisionOid.slice(0, 7)}</code>
        </div>
        <button type="button" className="btn" onClick={returnToHead}>{t.backToHead}</button>
      </header>
      <div className="content__scroll repository-snapshot-content__scroll">
        {!snapshot ? (
          <div className="repository-history__status" role="status">{t.openSnapshotFile}</div>
        ) : isMarkdown && rendered ? (
          <article
            className="mdn-body repository-snapshot-content__body"
            data-mdn-source-document-path={snapshot.path}
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
        ) : (
          <pre className="repository-snapshot-content__source"><code>{snapshot.source}</code></pre>
        )}
      </div>
    </main>
  );
}
