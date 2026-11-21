import { useEffect, useRef, type RefObject } from 'react';
import type { RepositoryView } from '../history/repositoryView';
import type { WorkspaceSearchResult } from '../types';
import { scrollToRenderedSearchMatchInRoot } from './searchJump';

export const REPOSITORY_SNAPSHOT_SEARCH_JUMP_EVENT = 'repository-snapshot-search-jump';

export interface SnapshotSearchJumpRequest {
  readonly oid: string;
  readonly relativePath: string;
  readonly query: string;
  readonly matchOrdinal?: number;
  readonly matchIndex?: number;
  readonly lineNumber?: number;
  readonly excerpt?: string;
  readonly matchCase?: boolean;
  readonly token: number;
}

export interface RevisionSidebarSearchConfig {
  readonly oid: string;
  run(query: string, matchCase: boolean, signal: AbortSignal): Promise<WorkspaceSearchResult[]>;
  openPath?(path: string): void;
  openResult?(match: WorkspaceSearchResult, query: string, matchCase: boolean): void;
}

let pendingSnapshotJump: SnapshotSearchJumpRequest | null = null;

function normalizeSnapshotPath(path: string | null | undefined): string {
  return String(path ?? '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
}

export function queueSnapshotSearchJump(
  detail: Omit<SnapshotSearchJumpRequest, 'token'>,
): SnapshotSearchJumpRequest | null {
  const trimmedQuery = detail.query.trim();
  const normalizedPath = normalizeSnapshotPath(detail.relativePath);
  if (!detail.oid || !normalizedPath || !trimmedQuery) return null;
  const request: SnapshotSearchJumpRequest = {
    ...detail,
    relativePath: normalizedPath,
    query: trimmedQuery,
    token: Date.now() + Math.random(),
  };
  pendingSnapshotJump = request;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REPOSITORY_SNAPSHOT_SEARCH_JUMP_EVENT, { detail: request }));
  }
  return request;
}

export function getPendingSnapshotSearchJump(): SnapshotSearchJumpRequest | null {
  return pendingSnapshotJump;
}

export function clearPendingSnapshotSearchJump(token?: number): void {
  if (token === undefined || pendingSnapshotJump?.token === token) {
    pendingSnapshotJump = null;
  }
}

export function createRevisionSidebarSearch(
  repositoryView: RepositoryView,
  activeSnapshotPath: string | null | undefined | (() => string | null | undefined),
  searchRevision: (query: string, matchCase: boolean, signal?: AbortSignal) => Promise<WorkspaceSearchResult[]>,
  openSnapshotFile: (path: string) => Promise<void> | void,
): RevisionSidebarSearchConfig | undefined {
  if (repositoryView.mode !== 'revision') return undefined;
  const oid = repositoryView.oid;
  return {
    oid,
    run: (query, matchCase, signal) => searchRevision(query, matchCase, signal),
    openPath: (path) => {
      clearPendingSnapshotSearchJump();
      void openSnapshotFile(path);
    },
    openResult: (match, query, matchCase) => {
      const normalizedPath = normalizeSnapshotPath(match.relativePath);
      if (!normalizedPath) return;
      queueSnapshotSearchJump({
        oid,
        relativePath: normalizedPath,
        query,
        matchOrdinal: match.matchOrdinal !== undefined ? Math.max(0, match.matchOrdinal - 1) : undefined,
        matchIndex: match.matchIndex,
        lineNumber: match.lineNumber,
        excerpt: match.excerpt,
        matchCase,
      });
      const currentActivePath = typeof activeSnapshotPath === 'function'
        ? activeSnapshotPath()
        : activeSnapshotPath;
      const alreadyLoaded = Boolean(
        currentActivePath && normalizeSnapshotPath(currentActivePath) === normalizedPath,
      );
      if (!alreadyLoaded) {
        void openSnapshotFile(match.relativePath);
      }
    },
  };
}

// Imperative ref-driven hook (zero useState) so completing a jump never triggers
// a host re-render that would reset `dangerouslySetInnerHTML` and wipe <mark>s.
export function useSnapshotSearchJump(args: {
  oid: string | null;
  activePath: string | null;
  source: string | null;
  containerRef: RefObject<HTMLElement | null>;
  renderKey?: unknown;
}): void {
  const { oid, activePath, source, containerRef, renderKey } = args;
  const latestRef = useRef(args);
  latestRef.current = args;
  const timerRef = useRef<number>(0);

  const scheduleJump = useRef(() => {
    window.clearTimeout(timerRef.current);
    const pending = getPendingSnapshotSearchJump();
    const { oid: currentOid, activePath: currentPath, source: currentSource } = latestRef.current;
    if (!pending || !currentOid || !currentPath || currentSource === null) return;
    if (pending.oid !== currentOid) return;
    if (normalizeSnapshotPath(currentPath) !== normalizeSnapshotPath(pending.relativePath)) return;

    let retries = 0;
    const token = pending.token;

    const tryJump = () => {
      const latestPending = getPendingSnapshotSearchJump();
      if (!latestPending || latestPending.token !== token) return;
      const latest = latestRef.current;
      if (latest.oid !== tokenOid || !latest.activePath || latest.source === null) return;
      if (normalizeSnapshotPath(latest.activePath) !== normalizeSnapshotPath(latestPending.relativePath)) return;

      const container = latest.containerRef.current;
      const root = container?.querySelector<HTMLElement>(
        '.repository-snapshot-content__body, .repository-snapshot-content__source',
      ) ?? container;
      const success = Boolean(
        root && scrollToRenderedSearchMatchInRoot(
          root,
          latestPending.query,
          latestPending.matchOrdinal,
          latestPending.matchIndex,
          latest.source,
          latestPending.matchCase === true,
          { lineNumber: latestPending.lineNumber, excerpt: latestPending.excerpt },
        ),
      );
      if (!success && retries < 8) {
        retries += 1;
        timerRef.current = window.setTimeout(tryJump, 100);
        return;
      }
      clearPendingSnapshotSearchJump(token);
    };

    const tokenOid = currentOid;
    timerRef.current = window.setTimeout(tryJump, 40);
  });

  useEffect(() => {
    const onJump = () => scheduleJump.current();
    window.addEventListener(REPOSITORY_SNAPSHOT_SEARCH_JUMP_EVENT, onJump);
    return () => {
      window.removeEventListener(REPOSITORY_SNAPSHOT_SEARCH_JUMP_EVENT, onJump);
      window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!oid) {
      window.clearTimeout(timerRef.current);
      clearPendingSnapshotSearchJump();
      return;
    }
    scheduleJump.current();
    return () => window.clearTimeout(timerRef.current);
  }, [oid, activePath, source, renderKey, containerRef]);
}
