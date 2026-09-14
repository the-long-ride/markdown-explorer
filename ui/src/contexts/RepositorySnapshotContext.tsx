import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { GitCapability, GitRepositoryCommit, GitRevisionFile, GitRevisionFileSnapshot } from '../history/contracts';
import type { HistoryClient } from '../history/historyClient';
import {
  readPersistedRevision,
  repositoryWorkspaceKey,
  writePersistedRevision,
  type PersistedRepositoryRevisionSelections,
  type RepositoryView,
} from '../history/repositoryView';
import {
  buildRevisionWorkspaceProjection,
  searchRevisionWorkspace,
  type RevisionWorkspaceProjection,
} from '../history/revisionWorkspace';
import type { PersistedState, WorkspaceSearchResult } from '../types';
import { useAppState } from './AppStateContext';
import { useHistory } from './HistoryContext';
import { usePlatform } from './PlatformContext';

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
  readonly repositoryView: RepositoryView;
  readonly revisionWorkspace: RevisionWorkspaceProjection | null;
  loadHistory(): Promise<void>;
  selectCommit(oid: string): Promise<void>;
  activateWorkspaceRevision(oid: string): Promise<void>;
  openSnapshotFile(path: string): Promise<void>;
  searchRevision(query: string, matchCase: boolean, signal?: AbortSignal): Promise<WorkspaceSearchResult[]>;
  returnToHead(): void;
}

const LIVE_VIEW: RepositoryView = { mode: 'live' };

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
  repositoryView: LIVE_VIEW,
  revisionWorkspace: null,
  loadHistory: async () => undefined,
  selectCommit: async () => undefined,
  activateWorkspaceRevision: async () => undefined,
  openSnapshotFile: async () => undefined,
  searchRevision: async () => [],
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
  persistedSelections,
  onPersistedSelectionsChange,
}: {
  children: React.ReactNode;
  client: HistoryClient;
  workspaceKey: string;
  enabled?: boolean;
  persistedSelections?: PersistedRepositoryRevisionSelections;
  onPersistedSelectionsChange?: (next: PersistedRepositoryRevisionSelections) => void;
}) {
  const [state, setState] = useState<RepositorySnapshotState>(INITIAL_STATE);
  const [commits, setCommits] = useState<readonly GitRepositoryCommit[]>([]);
  const [capability, setCapability] = useState<GitCapability | null>(null);
  const [repositoryView, setRepositoryView] = useState<RepositoryView>(LIVE_VIEW);
  const requestGeneration = useRef(0);

  const persistRevision = useCallback((oid: string | null) => {
    if (!workspaceKey || !onPersistedSelectionsChange) return;
    onPersistedSelectionsChange(writePersistedRevision(persistedSelections, workspaceKey, oid));
  }, [onPersistedSelectionsChange, persistedSelections, workspaceKey]);

  useEffect(() => {
    requestGeneration.current += 1;
    setState(INITIAL_STATE);
    setCommits([]);
    setCapability(null);
    setRepositoryView(LIVE_VIEW);
    if (!enabled || !workspaceKey) return;
    const generation = requestGeneration.current;
    void client.getCapability().then((next) => {
      if (requestGeneration.current === generation) setCapability(next);
    }).catch(() => {
      if (requestGeneration.current === generation) setCapability({ supported: false, reason: 'not-repository' });
    });
  }, [client, enabled, workspaceKey]);

  const returnToHead = useCallback(() => {
    requestGeneration.current += 1;
    setRepositoryView(LIVE_VIEW);
    persistRevision(null);
    setState((current) => ({
      ...current,
      selectedOid: null,
      files: [],
      activePath: null,
      activeFile: null,
      status: commits.length > 0 ? 'ready' : 'idle',
      error: null,
    }));
  }, [commits.length, persistRevision]);

  const loadHistory = useCallback(async () => {
    if (capability?.supported !== true) {
      setRepositoryView(LIVE_VIEW);
      persistRevision(null);
      setState((current) => ({ ...current, status: 'error', error: capability?.reason ?? 'unsupported-runtime' }));
      return;
    }
    const generation = ++requestGeneration.current;
    setState((current) => ({ ...current, status: 'loading-history', error: null }));
    try {
      const nextCommits = await client.listRepositoryHistory(200);
      if (requestGeneration.current !== generation) return;
      const headOid = nextCommits.find((commit) => commit.isHead)?.oid ?? null;
      const storedOid = readPersistedRevision(persistedSelections, workspaceKey);
      setCommits(nextCommits);

      const storedCommitIsValid = Boolean(storedOid && nextCommits.some((commit) => commit.oid === storedOid));
      if (!headOid || !storedOid || storedOid === headOid || !storedCommitIsValid) {
        if (storedOid) persistRevision(null);
        setRepositoryView(LIVE_VIEW);
        setState((current) => ({
          ...current,
          headOid,
          selectedOid: null,
          files: [],
          activePath: null,
          activeFile: null,
          status: 'ready',
          error: null,
        }));
        return;
      }

      setRepositoryView({ mode: 'revision', oid: storedOid, headOid });
      setState((current) => ({
        ...current,
        headOid,
        selectedOid: storedOid,
        files: [],
        activePath: null,
        activeFile: null,
        status: 'loading-files',
        error: null,
      }));
      const files = await client.listRevisionFiles(storedOid);
      if (requestGeneration.current !== generation) return;
      setState((current) => current.selectedOid === storedOid
        ? { ...current, files, status: 'ready', error: null }
        : current);
    } catch (error) {
      if (requestGeneration.current !== generation) return;
      setState((current) => ({ ...current, status: 'error', error: messageOf(error) }));
    }
  }, [capability, client, persistedSelections, persistRevision, workspaceKey]);

  const activateWorkspaceRevision = useCallback(async (oid: string) => {
    const normalizedOid = String(oid ?? '').trim();
    if (!normalizedOid) return;
    const headOid = state.headOid ?? commits.find((commit) => commit.isHead)?.oid ?? null;
    if (!headOid || normalizedOid === headOid) {
      returnToHead();
      return;
    }
    if (!commits.some((commit) => commit.oid === normalizedOid)) return;

    const generation = ++requestGeneration.current;
    setRepositoryView({ mode: 'revision', oid: normalizedOid, headOid });
    persistRevision(normalizedOid);
    setState((current) => ({
      ...current,
      selectedOid: normalizedOid,
      files: [],
      activePath: null,
      activeFile: null,
      status: 'loading-files',
      error: null,
    }));
    try {
      const files = await client.listRevisionFiles(normalizedOid);
      if (requestGeneration.current !== generation) return;
      setState((current) => current.selectedOid === normalizedOid
        ? { ...current, files, status: 'ready', error: null }
        : current);
    } catch (error) {
      if (requestGeneration.current !== generation) return;
      setState((current) => ({ ...current, status: 'error', error: messageOf(error) }));
    }
  }, [client, commits, persistRevision, returnToHead, state.headOid]);

  const selectCommit = activateWorkspaceRevision;

  const openSnapshotFile = useCallback(async (path: string) => {
    const oid = repositoryView.mode === 'revision' ? repositoryView.oid : null;
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
  }, [client, repositoryView]);

  const revisionWorkspace = useMemo<RevisionWorkspaceProjection | null>(() => (
    repositoryView.mode === 'revision'
      ? buildRevisionWorkspaceProjection(repositoryView.oid, state.files)
      : null
  ), [repositoryView, state.files]);

  const searchRevision = useCallback(async (
    query: string,
    matchCase: boolean,
    signal?: AbortSignal,
  ): Promise<WorkspaceSearchResult[]> => {
    if (repositoryView.mode !== 'revision') return [];
    return searchRevisionWorkspace(
      repositoryView.oid,
      state.files,
      (oid, path) => client.readRevisionFile(oid, path),
      query,
      matchCase,
      signal,
    );
  }, [client, repositoryView, state.files]);

  const value = useMemo<RepositorySnapshotContextValue>(() => ({
    state,
    commits,
    capability,
    repositoryView,
    revisionWorkspace,
    loadHistory,
    selectCommit,
    activateWorkspaceRevision,
    openSnapshotFile,
    searchRevision,
    returnToHead,
  }), [activateWorkspaceRevision, capability, commits, loadHistory, openSnapshotFile, repositoryView, returnToHead, revisionWorkspace, searchRevision, selectCommit, state]);

  return <RepositorySnapshotContext.Provider value={value}>{children}</RepositorySnapshotContext.Provider>;
}

export function RepositorySnapshotFromHistoryProvider({ children }: { children: React.ReactNode }) {
  const { client } = useHistory();
  const { state } = useAppState();
  const bridge = usePlatform();
  const workspaceKey = repositoryWorkspaceKey(state.workspacePath, state.workspaceName);
  const persistedSelections = bridge.getState<PersistedState>()?.repositoryRevisionSelections;
  const handlePersistedSelectionsChange = useCallback((next: PersistedRepositoryRevisionSelections) => {
    const current = bridge.getState<PersistedState>() ?? {};
    bridge.setState<PersistedState>({ ...current, repositoryRevisionSelections: next });
  }, [bridge]);

  return (
    <RepositorySnapshotProvider
      client={client}
      workspaceKey={workspaceKey}
      enabled={state.settings.historySidebarEnabled}
      persistedSelections={persistedSelections}
      onPersistedSelectionsChange={handlePersistedSelectionsChange}
    >
      {children}
    </RepositorySnapshotProvider>
  );
}

export function useRepositorySnapshot(): RepositorySnapshotContextValue {
  return useContext(RepositorySnapshotContext);
}
