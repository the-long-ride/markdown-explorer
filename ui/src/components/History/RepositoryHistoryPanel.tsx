import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { useRepositorySnapshot } from '../../contexts/RepositorySnapshotContext';
import { filterRepositoryCommits } from '../../history/repositoryView';
import { GitCommitGraph } from './GitCommitGraph';

const SEARCH_LABELS: Record<string, { search: string; noMatches: string; loadingMore: string }> = {
  en: { search: 'Search commits', noMatches: 'No matching commits.', loadingMore: 'Loading older commits…' },
  vi: { search: 'Tìm kiếm commit', noMatches: 'Không có commit phù hợp.', loadingMore: 'Đang tải commit cũ hơn…' },
  fr: { search: 'Rechercher des commits', noMatches: 'Aucun commit correspondant.', loadingMore: 'Chargement d’anciens commits…' },
  es: { search: 'Buscar commits', noMatches: 'No hay commits coincidentes.', loadingMore: 'Cargando commits anteriores…' },
  zh: { search: '搜索提交', noMatches: '没有匹配的提交。', loadingMore: '正在加载更早的提交…' },
  no: { search: 'Søk i commits', noMatches: 'Ingen samsvarende commits.', loadingMore: 'Laster eldre commits…' },
  ja: { search: 'コミットを検索', noMatches: '一致するコミットはありません。', loadingMore: '古いコミットを読み込み中…' },
  ko: { search: '커밋 검색', noMatches: '일치하는 커밋이 없습니다.', loadingMore: '이전 커밋 불러오는 중…' },
  ru: { search: 'Поиск коммитов', noMatches: 'Совпадающие коммиты не найдены.', loadingMore: 'Загрузка более старых коммитов…' },
};

const LOAD_MORE_THRESHOLD = 96;

export function RepositoryHistoryPanel({ visible, language }: { visible: boolean; language?: string }) {
  const t = getHistoryTranslations(language);
  const searchT = SEARCH_LABELS[language || 'en'] ?? SEARCH_LABELS.en;
  const [query, setQuery] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const {
    state,
    commits,
    capability,
    hasMoreHistory,
    isLoadingMoreHistory,
    loadHistory,
    loadMoreHistory,
    activateWorkspaceRevision,
    openSnapshotFile,
    returnToHead,
  } = useRepositorySnapshot();
  const filteredCommits = useMemo(() => filterRepositoryCommits(commits, query), [commits, query]);

  useEffect(() => {
    if (!visible || capability?.supported !== true || state.status !== 'idle') return;
    void loadHistory();
  }, [capability?.supported, loadHistory, state.status, visible]);

  useEffect(() => {
    if (!visible || !query.trim() || filteredCommits.length > 0 || !hasMoreHistory || isLoadingMoreHistory) return;
    void loadMoreHistory();
  }, [filteredCommits.length, hasMoreHistory, isLoadingMoreHistory, loadMoreHistory, query, visible]);

  useEffect(() => {
    if (!visible || !hasMoreHistory || typeof IntersectionObserver === 'undefined') return;
    const root = bodyRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isLoadingMoreHistory) void loadMoreHistory();
    }, { root, rootMargin: `${LOAD_MORE_THRESHOLD}px` });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreHistory, isLoadingMoreHistory, loadMoreHistory, visible]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!hasMoreHistory || isLoadingMoreHistory) return;
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight <= LOAD_MORE_THRESHOLD) {
      void loadMoreHistory();
    }
  }, [hasMoreHistory, isLoadingMoreHistory, loadMoreHistory]);

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

      {commits.length > 0 && (
        <div className="repository-history__search">
          <input
            type="search"
            aria-label={searchT.search}
            placeholder={searchT.search}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}

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
        <div
          ref={bodyRef}
          className="repository-history__body"
          data-testid="repository-history-body"
          onScroll={handleScroll}
        >
          {filteredCommits.length > 0 ? (
            <GitCommitGraph
              commits={filteredCommits}
              selectedOid={state.selectedOid}
              headLabel={t.head}
              browseLabel={t.browseCommit}
              onActivateRevision={(oid) => { void activateWorkspaceRevision(oid); }}
              onReturnToHead={returnToHead}
            />
          ) : query.trim() && !hasMoreHistory && !isLoadingMoreHistory ? (
            <div className="repository-history__status" role="status">{searchT.noMatches}</div>
          ) : null}

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

          <div ref={sentinelRef} className="repository-history__sentinel" aria-hidden="true" />
          {isLoadingMoreHistory && (
            <div className="repository-history__status repository-history__loading-more" role="status">
              {searchT.loadingMore}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
