export type PaneId = 'primary' | 'secondary';
export type DocumentViewMode = 'rendered' | 'inline-edit' | 'plain' | 'git-revision' | 'diff';

export interface DocumentPaneState {
  readonly id: PaneId;
  readonly filePath: string | null;
  readonly mode: DocumentViewMode;
  readonly scrollTop: number;
  readonly revision?: string;
  readonly diffKey?: string;
}

export interface SplitViewState {
  readonly enabled: boolean;
  readonly activePane: PaneId;
  readonly ratio: number;
  readonly primary: DocumentPaneState;
  readonly secondary: DocumentPaneState;
}

const MIN_RATIO = 0.25;
const MAX_RATIO = 0.75;

function createPane(id: PaneId, filePath: string | null): DocumentPaneState {
  return { id, filePath, mode: 'rendered', scrollTop: 0 };
}

function paneKey(id: PaneId): 'primary' | 'secondary' {
  return id;
}

export function createSplitViewState(filePath: string | null = null): SplitViewState {
  return {
    enabled: false,
    activePane: 'primary',
    ratio: 0.5,
    primary: createPane('primary', filePath),
    secondary: createPane('secondary', null),
  };
}

export function openSplit(state: SplitViewState, secondaryFilePath: string | null): SplitViewState {
  return {
    ...state,
    enabled: true,
    activePane: 'secondary',
    secondary: { ...state.secondary, id: 'secondary', filePath: secondaryFilePath },
  };
}

export function closeSplit(state: SplitViewState): SplitViewState {
  const promoted = state.activePane === 'secondary' ? state.secondary : state.primary;
  return {
    enabled: false,
    activePane: 'primary',
    ratio: state.ratio,
    primary: { ...promoted, id: 'primary' },
    secondary: createPane('secondary', null),
  };
}

export function setPaneFile(state: SplitViewState, paneId: PaneId, filePath: string | null): SplitViewState {
  const key = paneKey(paneId);
  return { ...state, [key]: { ...state[key], filePath } };
}

export function setPaneMode(state: SplitViewState, paneId: PaneId, mode: DocumentViewMode): SplitViewState {
  const key = paneKey(paneId);
  return { ...state, [key]: { ...state[key], mode } };
}

export function setActivePane(state: SplitViewState, activePane: PaneId): SplitViewState {
  return { ...state, activePane };
}

export function swapPanes(state: SplitViewState): SplitViewState {
  return {
    ...state,
    primary: { ...state.secondary, id: 'primary' },
    secondary: { ...state.primary, id: 'secondary' },
    activePane: state.activePane === 'primary' ? 'secondary' : 'primary',
  };
}

export function setSplitRatio(state: SplitViewState, ratio: number): SplitViewState {
  return { ...state, ratio: Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)) };
}

export function setPaneScrollTop(state: SplitViewState, paneId: PaneId, scrollTop: number): SplitViewState {
  const key = paneKey(paneId);
  return { ...state, [key]: { ...state[key], scrollTop: Math.max(0, scrollTop) } };
}
