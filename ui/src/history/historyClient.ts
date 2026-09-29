import type { PlatformBridge } from '../platform/bridge';
import type { HostMessage, WebviewMessage } from '../types';
import type {
  GitComparisonSources,
  GitCompareSide,
  GitRepositoryCommit,
  GitRevisionFile,
  GitRevisionFileSnapshot,
  GitRevisionSnapshot,
  GitRevisionSummary,
} from './contracts';

type RequestKind =
  | 'history'
  | 'revision'
  | 'comparison'
  | 'repository-history'
  | 'revision-files'
  | 'revision-file';

type PendingRequest = {
  readonly kind: RequestKind;
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason?: unknown) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

export const HISTORY_REQUEST_TIMEOUT_MS = 15000;

export interface RepositoryHistoryQuery {
  readonly limit?: number;
  readonly before?: string;
  /** Commits already loaded; hosts page by offset when the cursor falls outside their overlap window. */
  readonly offset?: number;
  readonly allRefs?: boolean;
}

export interface HistoryClient {
  listDocumentHistory(filePath: string, limit?: number): Promise<readonly GitRevisionSummary[]>;
  readGitRevision(oid: string, path: string): Promise<GitRevisionSnapshot>;
  compareGitRevisions(left: GitCompareSide, right: GitCompareSide): Promise<GitComparisonSources>;
  listRepositoryHistory(query?: RepositoryHistoryQuery): Promise<readonly GitRepositoryCommit[]>;
  listRevisionFiles(oid: string): Promise<readonly GitRevisionFile[]>;
  readRevisionFile(oid: string, path: string): Promise<GitRevisionFileSnapshot>;
  isDisposed(): boolean;
  dispose(): void;
}

function defaultRequestId(): string {
  return `history-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function failure(reason: string | undefined, fallback: string): Error {
  return new Error(reason || fallback);
}

export function createHistoryClient(
  bridge: PlatformBridge,
  nextRequestId: () => string = defaultRequestId,
  timeoutMs: number = HISTORY_REQUEST_TIMEOUT_MS,
): HistoryClient {
  const pending = new Map<string, PendingRequest>();
  let disposed = false;

  function settle(requestId: string): void {
    const entry = pending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(requestId);
  }

  const unsubscribe = bridge.onMessage((message: HostMessage) => {
    const requestId = 'requestId' in message && typeof message.requestId === 'string'
      ? message.requestId
      : null;
    if (!requestId) return;
    const request = pending.get(requestId);
    if (!request) return;

    switch (request.kind) {
      case 'history':
        if (message.command !== 'documentHistoryResult') return;
        settle(requestId);
        if (!message.ok) {
          request.reject(failure(message.reason, 'Unable to read document history'));
          return;
        }
        request.resolve(message.revisions);
        return;
      case 'revision':
        if (message.command !== 'gitRevisionResult') return;
        settle(requestId);
        if (!message.ok || !message.snapshot) {
          request.reject(failure(message.reason, 'Unable to read Git revision'));
          return;
        }
        request.resolve(message.snapshot);
        return;
      case 'comparison':
        if (message.command !== 'gitComparisonResult') return;
        settle(requestId);
        if (!message.ok || typeof message.leftSource !== 'string' || typeof message.rightSource !== 'string') {
          request.reject(failure(message.reason, 'Unable to compare Git revisions'));
          return;
        }
        request.resolve({
          leftSource: message.leftSource,
          rightSource: message.rightSource,
          leftLabel: message.leftLabel,
          rightLabel: message.rightLabel,
        } satisfies GitComparisonSources);
        return;
      case 'repository-history':
        if (message.command !== 'repositoryHistoryResult') return;
        settle(requestId);
        if (!message.ok) {
          request.reject(failure(message.reason, 'Unable to read repository history'));
          return;
        }
        request.resolve(message.commits);
        return;
      case 'revision-files':
        if (message.command !== 'revisionFilesResult') return;
        settle(requestId);
        if (!message.ok) {
          request.reject(failure(message.reason, 'Unable to list revision files'));
          return;
        }
        request.resolve(message.files);
        return;
      case 'revision-file':
        if (message.command !== 'revisionFileResult') return;
        settle(requestId);
        if (!message.ok) {
          request.reject(failure(message.reason, 'Unable to read revision file'));
          return;
        }
        request.resolve(message.snapshot);
    }
  });

  function request<T>(
    kind: RequestKind,
    createMessage: (requestId: string) => WebviewMessage,
  ): Promise<T> {
    if (disposed) return Promise.reject(new Error('History client has been disposed'));
    const requestId = nextRequestId();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!pending.has(requestId)) return;
        pending.delete(requestId);
        reject(new Error('History request timed out'));
      }, timeoutMs);
      pending.set(requestId, {
        kind,
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      bridge.postMessage(createMessage(requestId));
    });
  }

  return {
    listDocumentHistory(filePath, limit) {
      return request<readonly GitRevisionSummary[]>('history', (requestId) => ({
        command: 'listDocumentHistory',
        requestId,
        filePath,
        ...(limit === undefined ? {} : { limit }),
      }));
    },
    readGitRevision(oid, path) {
      return request<GitRevisionSnapshot>('revision', (requestId) => ({
        command: 'readGitRevision',
        requestId,
        oid,
        path,
      }));
    },
    compareGitRevisions(left, right) {
      return request<GitComparisonSources>('comparison', (requestId) => ({
        command: 'compareGitRevisions',
        requestId,
        left,
        right,
      }));
    },
    listRepositoryHistory({ limit, before, offset, allRefs } = {}) {
      return request<readonly GitRepositoryCommit[]>('repository-history', (requestId) => ({
        command: 'listRepositoryHistory',
        requestId,
        ...(limit === undefined ? {} : { limit }),
        ...(before === undefined ? {} : { before }),
        ...(offset === undefined ? {} : { offset }),
        ...(allRefs === undefined ? {} : { allRefs }),
      }));
    },
    listRevisionFiles(oid) {
      return request<readonly GitRevisionFile[]>('revision-files', (requestId) => ({
        command: 'listRevisionFiles',
        requestId,
        oid,
      }));
    },
    readRevisionFile(oid, path) {
      return request<GitRevisionFileSnapshot>('revision-file', (requestId) => ({
        command: 'readRevisionFile',
        requestId,
        oid,
        path,
      }));
    },
    isDisposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      const error = new Error('History client has been disposed');
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(error);
      }
      pending.clear();
    },
  };
}
