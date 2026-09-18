export type PaneId = 'primary' | 'secondary';
export type DocumentViewMode = 'rendered' | 'inline-edit' | 'plain' | 'git-revision' | 'diff';

export interface DocumentPaneState {
  readonly id: PaneId;
  readonly filePath: string | null;
  readonly tabs: readonly string[];
  readonly activeTabPath: string | null;
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
  return {
    id,
    filePath,
    tabs: filePath ? [filePath] : [],
    activeTabPath: filePath,
    mode: 'rendered',
    scrollTop: 0,
  };
}

function paneKey(id: PaneId): 'primary' | 'secondary' {
  return id;
}

function samePath(left: string | null | undefined, right: string | null | undefined): boolean {
  return String(left ?? '').replace(/\\/g, '/').toLocaleLowerCase()
    === String(right ?? '').replace(/\\/g, '/').toLocaleLowerCase();
}

function dedupePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of paths) {
    if (!path) continue;
    const key = path.replace(/\\/g, '/').toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(path);
  }
  return result;
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

export function setPaneTabs(
  state: SplitViewState,
  paneId: PaneId,
  tabs: readonly string[],
  activeTabPath?: string | null,
): SplitViewState {
  const key = paneKey(paneId);
  const nextTabs = dedupePaths(tabs);
  const requestedActive = activeTabPath && nextTabs.some((path) => samePath(path, activeTabPath))
    ? nextTabs.find((path) => samePath(path, activeTabPath)) ?? null
    : null;
  const fallback = requestedActive
    ?? nextTabs.find((path) => samePath(path, state[key].activeTabPath))
    ?? nextTabs[0]
    ?? null;
  return {
    ...state,
    [key]: {
      ...state[key],
      tabs: nextTabs,
      activeTabPath: fallback,
      filePath: fallback,
    },
  };
}

export function openPaneDocument(
  state: SplitViewState,
  paneId: PaneId,
  filePath: string | null,
  useTabs: boolean,
): SplitViewState {
  const key = paneKey(paneId);
  if (!filePath) {
    return {
      ...state,
      [key]: { ...state[key], filePath: null, activeTabPath: null, tabs: useTabs ? state[key].tabs : [], scrollTop: 0 },
    };
  }
  const nextTabs = useTabs ? dedupePaths([...state[key].tabs, filePath]) : [filePath];
  const resolved = nextTabs.find((path) => samePath(path, filePath)) ?? filePath;
  return {
    ...state,
    [key]: {
      ...state[key],
      filePath: resolved,
      tabs: nextTabs,
      activeTabPath: resolved,
      mode: 'rendered',
      scrollTop: 0,
    },
  };
}

export function activatePaneTab(state: SplitViewState, paneId: PaneId, filePath: string): SplitViewState {
  const key = paneKey(paneId);
  const resolved = state[key].tabs.find((path) => samePath(path, filePath));
  if (!resolved) return state;
  return {
    ...state,
    activePane: paneId,
    [key]: { ...state[key], filePath: resolved, activeTabPath: resolved, scrollTop: 0 },
  };
}

export function closePaneTab(state: SplitViewState, paneId: PaneId, filePath: string): SplitViewState {
  const key = paneKey(paneId);
  const pane = state[key];
  const index = pane.tabs.findIndex((path) => samePath(path, filePath));
  if (index < 0) return state;
  const tabs = pane.tabs.filter((_, tabIndex) => tabIndex !== index);
  const closingActive = samePath(pane.activeTabPath, filePath);
  const fallback = closingActive
    ? tabs[index - 1] ?? tabs[index] ?? null
    : pane.activeTabPath;
  return {
    ...state,
    [key]: {
      ...pane,
      tabs,
      activeTabPath: fallback,
      filePath: fallback,
      mode: closingActive ? 'rendered' : pane.mode,
      scrollTop: closingActive ? 0 : pane.scrollTop,
    },
  };
}

export function openSplit(state: SplitViewState, secondaryFilePath: string | null): SplitViewState {
  const next = openPaneDocument(state, 'secondary', secondaryFilePath, false);
  return { ...next, enabled: true, activePane: 'secondary' };
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
  if (!filePath) return { ...state, [key]: { ...state[key], filePath: null, activeTabPath: null } };
  const tabs = dedupePaths([...state[key].tabs, filePath]);
  const resolved = tabs.find((path) => samePath(path, filePath)) ?? filePath;
  return { ...state, [key]: { ...state[key], filePath: resolved, activeTabPath: resolved, tabs } };
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
