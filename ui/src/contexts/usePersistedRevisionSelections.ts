import { useCallback, useMemo, useState } from 'react';
import type { PersistedRepositoryRevisionSelections } from '../history/repositoryView';
import type { PlatformBridge } from '../platform/bridge';
import type { PersistedState } from '../types';

export interface PersistedRevisionSelectionsHandle {
  readonly selections: PersistedRepositoryRevisionSelections | undefined;
  update(next: PersistedRepositoryRevisionSelections): void;
}

/**
 * Reads the saved revision selections once per workspace. Electron's bridge
 * parses localStorage on every getState call, so reading it during render gave
 * the history callbacks a new identity on every render.
 */
export function usePersistedRevisionSelections(bridge: PlatformBridge, workspaceKey: string): PersistedRevisionSelectionsHandle {
  const stored = useMemo(
    () => bridge.getState<PersistedState>()?.repositoryRevisionSelections,
    [bridge, workspaceKey],
  );
  const [written, setWritten] = useState<{ workspaceKey: string; selections: PersistedRepositoryRevisionSelections } | null>(null);
  const selections = written?.workspaceKey === workspaceKey ? written.selections : stored;

  const update = useCallback((next: PersistedRepositoryRevisionSelections) => {
    const state = bridge.getState<PersistedState>() ?? {};
    bridge.setState<PersistedState>({ ...state, repositoryRevisionSelections: next });
    setWritten({ workspaceKey, selections: next });
  }, [bridge, workspaceKey]);

  return useMemo(() => ({ selections, update }), [selections, update]);
}
