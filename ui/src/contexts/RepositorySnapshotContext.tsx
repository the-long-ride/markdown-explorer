import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { GitCapability, GitRepositoryCommit, GitRevisionFile, GitRevisionFileSnapshot } from '../history/contracts';
import type { HistoryClient } from '../history/historyClient';
import { useAppState } from './AppStateContext';
import { useHistory } from './HistoryContext';

export interface RepositorySnapshotState {
  readonly selectedOid: string | null;
  readonly headOid: string | null;
  readonly files: readonly GitRevisionFile[];
  readonly activePath: string | null;
  readonly activeFile: GitRevisionFileSnapshot | null;
  readonly status: 'idle' | 'loading-history' | 'loading-files' | 'loading-file' | 'ready' | 'error';
  readonly error: string | null;
}

export interface RepositorySnapshotContextValue {
  readonly state: RepositorySnapshotState;
  readonly commits: readonly GitRepositoryCommit[];
  readonly capability: GitCapability | null;
  loadHistory(): Promise<void>;
  selectCommit(oid: string): Promise<void>;
  openSnapshotFile(path: string): Promise<void>;
  returnToHead(): void;
}

const INITIAL_STATE: RepositorySnapshotState = {
  selectedOid: null,
  headOid: null,
  files: [],
  activePath: null,
  activeFile: null,
  status: 'idle',
  error: null,
};

const EMPTY_CONTEXT: RepositorySnapshotContextValue = {
  state: INITIAL_STATE,
  commits: [],
  capability: null,
  loadHistory: async () => undefined,
  selectCommit: async () => undefined,
  openSnapshotFile: async () => undefined,
  returnToHead: () => undefined,
};

const RepositorySnapshotContext = createContext<RepositorySnapshotContextValue>(EMPTY_CONTEXT);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Repository history is unavailable');
}

export function RepositorySnapshotProvider({
  children,
  client,
  workspaceKey,
  enabled = true,
}: {
  children: React.ReactNode;
  client: HistoryClient;
  workspaceKey: string;
  enabled?: boolean;
}) {
  const [state, setState] = useState<RepositorySnapshotState>(INITIAL_STATE);
  const [commits, setCommits] = useState<readonly GitRepositoryCommit[]>([]);
  const [capability, setCapability] = useState<GitCapability | null>(null);
  const requestGeneration = useRef(0);

  useEffect(() => {
    requestGeneration.current += 1;
    setState(INITIAL_STATE);
    setCommits([]);
    setCapability(null);
    if (!enabled || !workspaceKey) return;
    const generation = requestGeneration.current;
    void client.getCapability().then((next) => {
      if (requestGeneration.current === generation) setCapability(next);
    }).catch(() => {
      if (requestGeneration.current === generation) setCapability({ supported: false, reason: 'not-repository' });
    });
  }, [client, enabled, workspaceKey]);

  const loadHistory = useCallback(async () => {
    if (capability?.supported !== true) {
      setState((current) => ({ ...current, status: 'error', error: capability?.reason ?? 'unsupported-runtime' }));
      return;
    }
    const generation = ++requestGeneration.current;
    setState((current) => ({ ...current, status: 'loading-history', error: null }));
    try {
      const nextCommits = await client.listRepositoryHistory(200);
      if (requestGeneration.current !== generation) return;
      const headOid = nextCommits.find((commit) => commit.isHead)?.oid ?? null;
      setCommits(nextCommits);
      setState((current) => ({ ...current, headOid, status: 'ready', error: null }));
    } catch (error) {
      if (requestGeneration.current !== generation) return;
      setState((current) => ({ ...current, status: 'error', error: messageOf(error) }));
    }
  }, [capability, client]);

  const selectCommit = useCallback(async (oid: string) => {
    if (!oid) return;
    const generation = ++requestGeneration.current;
    setState((current) => ({
      ...current,
      selectedOid: oid,
      files: [],
      activePath: null,
      activeFile: null,
      status: 'loading-files',
      error: null,
    }));
    try {
      const files = await client.listRevisionFiles(oid);
      if (requestGeneration.current !== generation) return;
      setState((current) => current.selectedOid === oid
        ? { ...current, files, status: 'ready', error: null }
        : current);
    } catch (error) {
      if (requestGeneration.current !== generation) return;
      setState((current) => ({ ...current, status: 'error', error: messageOf(error) }));
    }
  }, [client]);

  const openSnapshotFile = useCallback(async (path: string) => {
    const oid = state.selectedOid;
    if (!oid || !path) return;
    const generation = ++requestGeneration.current;
    setState((current) => ({ ...current, activePath: path, activeFile: null, status: 'loading-file', error: null }));
    try {
      const activeFile = await client.readRevisionFile(oid, path);
      if (requestGeneration.current !== generation) return;
      setState((current) => current.selectedOid === oid && current.activePath === path
        ? { ...current, activeFile, status: 'ready', error: null }
        : current);
    } catch (error) {
      if (requestGeneration.current !== generation) return;
      setState((current) => ({ ...current, activeFile: null, status: 'error', error: messageOf(error) }));
    }
  }, [client, state.selectedOid]);

  const returnToHead = useCallback(() => {
    requestGeneration.current += 1;
    setState((current) => ({
      ...current,
      selectedOid: null,
      files: [],
      activePath: null,
      activeFile: null,
      status: commits.length > 0 ? 'ready' : 'idle',
      error: null,
    }));
  }, [commits.length]);

  const value = useMemo<RepositorySnapshotContextValue>(() => ({
    state,
    commits,
    capability,
    loadHistory,
    selectCommit,
    openSnapshotFile,
    returnToHead,
  }), [capability, commits, loadHistory, openSnapshotFile, returnToHead, selectCommit, state]);

  return <RepositorySnapshotContext.Provider value={value}>{children}</RepositorySnapshotContext.Provider>;
}

export function RepositorySnapshotFromHistoryProvider({ children }: { children: React.ReactNode }) {
  const { client } = useHistory();
  const { state } = useAppState();
  const workspaceKey = state.workspacePath || state.workspaceName || '';
  return (
    <RepositorySnapshotProvider
      client={client}
      workspaceKey={workspaceKey}
      enabled={state.settings.historySidebarEnabled}
    >
      {children}
    </RepositorySnapshotProvider>
  );
}

export function useRepositorySnapshot(): RepositorySnapshotContextValue {
  return useContext(RepositorySnapshotContext);
}
