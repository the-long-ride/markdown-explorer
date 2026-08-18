import type { MdFile } from '../../types/files';
import type { DocumentSnapshot } from '../../export/documentSnapshot';

export const MAX_SCOPE_DEPTH = 10;

export interface ScopeEntry {
  file: MdFile;
  snapshot: DocumentSnapshot;
}

export interface ScopeHistoryState {
  entries: ScopeEntry[];
  index: number;
}

export function createScopeHistory(entry: ScopeEntry): ScopeHistoryState {
  return { entries: [entry], index: 0 };
}

export function pushScope(
  state: ScopeHistoryState,
  entry: ScopeEntry,
): { state: ScopeHistoryState; blocked: boolean } {
  const entries = state.entries.slice(0, state.index + 1);
  if (entries.length >= MAX_SCOPE_DEPTH) return { state, blocked: true };
  const nextEntries = [...entries, entry];
  return {
    state: { entries: nextEntries, index: nextEntries.length - 1 },
    blocked: false,
  };
}

export function previousScope(state: ScopeHistoryState): ScopeHistoryState {
  return state.index <= 0 ? state : { ...state, index: state.index - 1 };
}

export function nextScope(state: ScopeHistoryState): ScopeHistoryState {
  return state.index >= state.entries.length - 1 ? state : { ...state, index: state.index + 1 };
}
