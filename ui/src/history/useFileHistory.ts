import { useCallback, useEffect, useRef, useState } from 'react';
import type { GitComparisonSources, GitRevisionSummary } from './contracts';
import type { HistoryClient } from './historyClient';

export const FILE_HISTORY_PAGE_SIZE = 100;
export const FILE_HISTORY_MAX = 500;

export type FileHistorySelection =
  | { readonly kind: 'commit'; readonly oid: string }
  | { readonly kind: 'range'; readonly olderOid: string; readonly newerOid: string }
  | { readonly kind: 'current'; readonly oid: string };

export interface FileHistoryDiff {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly sources: GitComparisonSources | null;
  readonly error: string | null;
  readonly fileAdded: boolean;
}

export interface FileHistoryState {
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly entries: readonly GitRevisionSummary[];
  readonly hasMore: boolean;
  readonly selection: FileHistorySelection | null;
  readonly diff: FileHistoryDiff;
}

export interface FileHistoryHandle extends FileHistoryState {
  select(selection: FileHistorySelection): void;
  loadMore(): Promise<void>;
  retry(): void;
}

const IDLE_DIFF: FileHistoryDiff = { status: 'idle', sources: null, error: null, fileAdded: false };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'History is unavailable');
}

function labelOf(entry: GitRevisionSummary): string {
  return `${entry.shortOid} · ${entry.subject}`;
}

function revisionSide(entry: GitRevisionSummary) {
  return { kind: 'revision' as const, oid: entry.oid, path: entry.path };
}

function hasMoreAfter(count: number, limit: number): boolean {
  return count === limit && limit < FILE_HISTORY_MAX;
}

/**
 * Loads a file's commit list and the diff for the current selection. "What
 * changed in commit i" compares entry i+1 with entry i, each at its own path,
 * so renames diff correctly without a parent lookup.
 */
export function useFileHistory(
  client: HistoryClient,
  filePath: string,
  currentSource: () => string | null,
  workspacePath?: string,
): FileHistoryHandle {
  const [status, setStatus] = useState<FileHistoryState['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<readonly GitRevisionSummary[]>([]);
  const [limit, setLimit] = useState(FILE_HISTORY_PAGE_SIZE);
  const [selection, setSelection] = useState<FileHistorySelection | null>(null);
  const [diff, setDiff] = useState<FileHistoryDiff>(IDLE_DIFF);
  const [reloadToken, setReloadToken] = useState(0);
  const entriesRef = useRef(entries);
  const limitRef = useRef(limit);
  const selectionToken = useRef(0);
  const cache = useRef(new Map<string, GitComparisonSources>());
  const currentSourceRef = useRef(currentSource);
  currentSourceRef.current = currentSource;

  const applyEntries = useCallback((next: readonly GitRevisionSummary[], nextLimit: number) => {
    entriesRef.current = next;
    limitRef.current = nextLimit;
    setEntries(next);
    setLimit(nextLimit);
  }, []);

  const fetchPage = useCallback(async (nextLimit: number) => {
    const next = await client.listDocumentHistory(filePath, nextLimit);
    applyEntries(next, nextLimit);
    return next;
  }, [applyEntries, client, filePath]);

  const compareRevisions = useCallback(async (older: GitRevisionSummary, newer: GitRevisionSummary) => {
    const key = `${older.oid}:${older.path}|${newer.oid}:${newer.path}`;
    const cached = cache.current.get(key);
    if (cached) return cached;
    const result = await client.compareGitRevisions(revisionSide(older), revisionSide(newer));
    const sources = { ...result, leftLabel: labelOf(older), rightLabel: labelOf(newer) };
    cache.current.set(key, sources);
    return sources;
  }, [client]);

  const resolveDiff = useCallback(async (next: FileHistorySelection): Promise<Omit<FileHistoryDiff, 'status' | 'error'>> => {
    const find = (oid: string) => entriesRef.current.find((item) => item.oid === oid);
    if (next.kind === 'range') {
      const older = find(next.olderOid);
      const newer = find(next.newerOid);
      if (!older || !newer) throw new Error('Commit is no longer in the list');
      return { sources: await compareRevisions(older, newer), fileAdded: false };
    }
    if (next.kind === 'current') {
      const revision = find(next.oid);
      if (!revision) throw new Error('Commit is no longer in the list');
      const editorText = currentSourceRef.current();
      if (editorText !== null) {
        const snapshot = await client.readGitRevision(revision.oid, revision.path);
        return { sources: { leftSource: snapshot.source, rightSource: editorText, leftLabel: labelOf(revision) }, fileAdded: false };
      }
      const result = await client.compareGitRevisions(revisionSide(revision), { kind: 'current', path: filePath });
      return { sources: { ...result, leftLabel: labelOf(revision) }, fileAdded: false };
    }
    let index = entriesRef.current.findIndex((item) => item.oid === next.oid);
    if (index < 0) throw new Error('Commit is no longer in the list');
    if (index === entriesRef.current.length - 1 && hasMoreAfter(entriesRef.current.length, limitRef.current)) {
      await fetchPage(Math.min(FILE_HISTORY_MAX, limitRef.current + FILE_HISTORY_PAGE_SIZE));
      index = entriesRef.current.findIndex((item) => item.oid === next.oid);
    }
    const newer = entriesRef.current[index];
    const older = entriesRef.current[index + 1];
    if (older) return { sources: await compareRevisions(older, newer), fileAdded: false };
    const snapshot = await client.readGitRevision(newer.oid, newer.path);
    return { sources: { leftSource: '', rightSource: snapshot.source, rightLabel: labelOf(newer) }, fileAdded: true };
  }, [client, compareRevisions, fetchPage, filePath]);

  const select = useCallback((next: FileHistorySelection) => {
    const token = ++selectionToken.current;
    setSelection(next);
    setDiff((current) => ({ ...current, status: 'loading', error: null }));
    resolveDiff(next).then(
      (result) => {
        if (selectionToken.current === token) setDiff({ ...result, status: 'ready', error: null });
      },
      (reason: unknown) => {
        if (selectionToken.current === token) setDiff({ status: 'error', sources: null, error: messageOf(reason), fileAdded: false });
      },
    );
  }, [resolveDiff]);

  useEffect(() => {
    let cancelled = false;
    selectionToken.current += 1;
    cache.current.clear();
    applyEntries([], FILE_HISTORY_PAGE_SIZE);
    setStatus('loading');
    setError(null);
    setSelection(null);
    setDiff(IDLE_DIFF);
    void (async () => {
      try {
        const next = await client.listDocumentHistory(filePath, FILE_HISTORY_PAGE_SIZE);
        if (cancelled) return;
        applyEntries(next, FILE_HISTORY_PAGE_SIZE);
        setStatus('ready');
        if (next.length > 0) select({ kind: 'commit', oid: next[0].oid });
      } catch (reason) {
        if (cancelled) return;
        setStatus('error');
        setError(messageOf(reason));
      }
    })();
    return () => { cancelled = true; };
  }, [applyEntries, client, filePath, reloadToken, select, workspacePath]);

  const loadMore = useCallback(async () => {
    if (!hasMoreAfter(entriesRef.current.length, limitRef.current)) return;
    try {
      await fetchPage(Math.min(FILE_HISTORY_MAX, limitRef.current + FILE_HISTORY_PAGE_SIZE));
    } catch (reason) {
      setError(messageOf(reason));
    }
  }, [fetchPage]);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  return {
    status,
    error,
    entries,
    hasMore: hasMoreAfter(entries.length, limit),
    selection,
    diff,
    select,
    loadMore,
    retry,
  };
}
