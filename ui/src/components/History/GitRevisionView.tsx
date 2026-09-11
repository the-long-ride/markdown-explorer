import { useMemo } from 'react';
import { renderMarkdownClientSide } from '../../contexts/contentTabState';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import type { GitRevisionSnapshot } from '../../history/contracts';

interface GitRevisionViewProps {
  snapshot: GitRevisionSnapshot;
  language?: string;
  onReturnToCurrent?: () => void;
}

export function GitRevisionView({ snapshot, language, onReturnToCurrent }: GitRevisionViewProps) {
  const t = getHistoryTranslations(language);
  const rendered = useMemo(() => renderMarkdownClientSide(snapshot.source, snapshot.path, /\.mdx$/i.test(snapshot.path)), [snapshot]);
  return (
    <section className="git-revision-view" data-git-revision={snapshot.oid} data-testid="git-revision-view">
      <header className="git-revision-view__header">
        <div><strong>{snapshot.oid.slice(0, 7)}</strong><span className="git-revision-view__path">{snapshot.path}</span></div>
        {onReturnToCurrent && <button type="button" className="btn git-revision-view__return" onClick={onReturnToCurrent}>{t.returnCurrent}</button>}
      </header>
      <div className="mdn-body git-revision-view__body" data-mdn-source-document-path={snapshot.path} dangerouslySetInnerHTML={{ __html: rendered.html }} />
    </section>
  );
}
