import { useMemo, useState } from 'react';
import type { FileHistoryTranslations } from '../../contexts/fileHistoryTranslations';
import { getHistoryMetaTranslations } from '../../contexts/historyMetaTranslations';
import type { GitRevisionSummary } from '../../history/contracts';
import type { FileHistorySelection } from '../../history/useFileHistory';
import { CopyableHistoryMeta } from './CopyableHistoryMeta';
import { HistoryWorkingCopyIcon } from './HistoryActionIcons';
import { HistorySelectionCheckbox } from './HistorySelectionCheckbox';

interface FileHistoryCommitListProps {
  readonly entries: readonly GitRevisionSummary[];
  readonly selection: FileHistorySelection | null;
  readonly compareMode: boolean;
  readonly picks: readonly string[];
  readonly hasMore: boolean;
  readonly language?: string;
  readonly t: FileHistoryTranslations;
  readonly hint?: string | null;
  onSelectCommit(oid: string): void;
  onTogglePick(oid: string): void;
  onSelectCurrent(): void;
  onLoadMore(): void;
}

const LOAD_MORE_THRESHOLD = 120;

function formatDate(value: string, language?: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(language || undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function matches(entry: GitRevisionSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [entry.subject, entry.author, entry.oid, entry.shortOid].some((value) => value.toLowerCase().includes(needle));
}

export function FileHistoryCommitList({
  entries, selection, compareMode, picks, hasMore, language, t, hint,
  onSelectCommit, onTogglePick, onSelectCurrent, onLoadMore,
}: FileHistoryCommitListProps) {
  const metaT = getHistoryMetaTranslations(language);
  const [query, setQuery] = useState('');
  const visible = useMemo(() => entries
    .map((entry, index) => ({ entry, renamedFrom: entries[index + 1] && entries[index + 1].path !== entry.path ? entries[index + 1].path : null }))
    .filter(({ entry }) => matches(entry, query)), [entries, query]);
  const selectedOid = selection?.kind === 'commit' ? selection.oid : null;

  return (
    <div className="file-history__list">
      <div className="file-history__filter">
        <input type="search" aria-label={t.filterCommits} placeholder={t.filterCommits} autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {hint && <p className="file-history__hint">{hint}</p>}
      <ol
        className="file-history__commits"
        onScroll={(event) => {
          const target = event.currentTarget;
          if (hasMore && target.scrollHeight - target.scrollTop - target.clientHeight <= LOAD_MORE_THRESHOLD) onLoadMore();
        }}
      >
        <li className="file-history__commit file-history__commit--current">
          <button type="button" className="file-history__commit-button" aria-pressed={selection?.kind === 'current'} onClick={onSelectCurrent} disabled={entries.length === 0}>
            <span className="file-history__commit-subject"><HistoryWorkingCopyIcon size={13} /> {t.currentFile}</span>
            <span className="file-history__commit-meta">{t.currentFileHint}</span>
          </button>
        </li>
        {visible.map(({ entry, renamedFrom }) => (
          <li key={entry.oid} className={`file-history__commit${picks.includes(entry.oid) ? ' is-picked' : ''}`}>
            {compareMode && (
              <span className="file-history__pick">
                <HistorySelectionCheckbox checked={picks.includes(entry.oid)} label={`${t.compare}: ${entry.subject}`} onToggle={() => onTogglePick(entry.oid)} />
              </span>
            )}
            <button
              type="button"
              className="file-history__commit-button"
              aria-pressed={selectedOid === entry.oid}
              onClick={() => (compareMode ? onTogglePick(entry.oid) : onSelectCommit(entry.oid))}
            >
              <span className="file-history__commit-subject">{entry.subject || entry.shortOid}</span>
              <span className="file-history__commit-meta">
                <span>{entry.author}</span>
                <span>{formatDate(entry.authoredAt, language)}</span>
              </span>
              {renamedFrom && <span className="file-history__rename">{t.renamedFrom.replace('{path}', renamedFrom)}</span>}
            </button>
            <span className="file-history__sha">
              <CopyableHistoryMeta display={entry.shortOid} copyValue={entry.oid} tooltip={metaT.copyCommitSha} copiedLabel={metaT.copied} monospace />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
