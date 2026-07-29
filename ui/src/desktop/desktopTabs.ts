import {
  DESKTOP_TABS_STORAGE_KEY,
  FALLBACK_FLOATING_TOOLBAR_SIZE,
  FLOATING_TOOLBAR_STORAGE_KEY,
  FLOATING_TOOLBAR_VIEWPORT_MARGIN,
  WORKSPACE_ALIASES_STORAGE_KEY,
} from './constants';
import type {
  DesktopTab,
  DesktopTabKind,
  FloatingToolbarPosition,
  FloatingToolbarSize,
  InitialDesktopState,
  PersistedDesktopTabsState,
  WorkspaceAliasMap,
} from './types';

export function createEmptyTab(id: string, kind: DesktopTabKind): DesktopTab {
  return {
    id,
    kind,
    fileList: [],
    tree: null,
    currentFile: null,
    contentHtml: '',
    markdownSource: null,
    sourceDocumentText: null,
    frontmatter: {},
    toc: [],
    previewInfo: null,
    relativePath: '',
    isLoading: false,
    notFoundHref: null,
    workspaceUnavailablePath: null,
    workspaceUnavailableReason: null,
    contentTabs: [],
    activeContentTabPath: null,
    workspaceLoadState: kind === 'workspace' ? 'ready' : 'idle',
  };
}

export function getWorkspaceNameFromPath(workspacePath: string): string {
  const parts = workspacePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || workspacePath;
}

export function getTabLabel(tab: DesktopTab): string {
  const alias = tab.alias?.trim();
  if (alias) return alias;
  if (tab.workspaceName) return tab.workspaceName;
  return tab.kind === 'home' ? 'Home' : 'New workspace';
}

export function createTabId() {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function reorderDesktopTabs(tabs: readonly DesktopTab[], sourceId: string, targetId: string): DesktopTab[] {
  const sourceIndex = tabs.findIndex((tab) => tab.id === sourceId && tab.kind !== 'home');
  const targetIndex = tabs.findIndex((tab) => tab.id === targetId && tab.kind !== 'home');
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return tabs as DesktopTab[];
  const nextTabs = [...tabs];
  const [source] = nextTabs.splice(sourceIndex, 1);
  nextTabs.splice(nextTabs.findIndex((tab) => tab.id === targetId), 0, source);
  return nextTabs;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampFloatingToolbarPosition(
  position: FloatingToolbarPosition,
  size: FloatingToolbarSize = FALLBACK_FLOATING_TOOLBAR_SIZE,
): FloatingToolbarPosition {
  if (typeof window === 'undefined') return position;

  const margin = FLOATING_TOOLBAR_VIEWPORT_MARGIN;
  const viewportWidth = Math.max(window.innerWidth, margin * 2);
  const viewportHeight = Math.max(window.innerHeight, margin * 2);
  const safeWidth = Math.min(Math.max(size.width, 1), viewportWidth - margin * 2);
  const safeHeight = Math.min(Math.max(size.height, 1), viewportHeight - margin * 2);

  return {
    x: clamp(position.x, margin, Math.max(margin, viewportWidth - safeWidth - margin)),
    y: clamp(position.y, margin, Math.max(margin, viewportHeight - safeHeight - margin)),
  };
}

export function readToolbarPosition(): FloatingToolbarPosition {
  try {
    const stored = localStorage.getItem(FLOATING_TOOLBAR_STORAGE_KEY);
    if (!stored) return { x: 36, y: 36 };
    const parsed = JSON.parse(stored);
    const position = {
      x: Number(parsed?.x) || 36,
      y: Number(parsed?.y) || 36,
    };
    return clampFloatingToolbarPosition(position);
  } catch {
    return { x: 36, y: 36 };
  }
}

export function readWorkspaceAliases(): WorkspaceAliasMap {
  try {
    const stored = localStorage.getItem(WORKSPACE_ALIASES_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key, value]) => typeof key === 'string' && typeof value === 'string'),
    ) as WorkspaceAliasMap;
  } catch {
    return {};
  }
}

export function writeWorkspaceAliases(aliases: WorkspaceAliasMap) {
  try {
    localStorage.setItem(WORKSPACE_ALIASES_STORAGE_KEY, JSON.stringify(aliases));
  } catch {
    // Ignore storage quota or privacy-mode failures.
  }
}

export function readPersistedDesktopTabs(workspaceAliases: WorkspaceAliasMap): {
  tabs: DesktopTab[];
  activeTabId: string;
} {
  try {
    const stored = localStorage.getItem(DESKTOP_TABS_STORAGE_KEY);
    if (!stored) throw new Error('No persisted tab state');
    const parsed = JSON.parse(stored) as PersistedDesktopTabsState;
    const persistedTabs = Array.isArray(parsed.tabs) ? parsed.tabs : [];
    const tabs = persistedTabs.map((tab) => {
      const restored = createEmptyTab(tab.id, tab.kind);
      restored.alias = tab.alias;
      restored.workspaceName = tab.workspaceName;
      restored.workspacePath = tab.workspacePath;
      restored.currentFile = tab.currentFile ?? null;
      restored.workspaceLoadState = tab.kind === 'workspace' ? 'ready' : 'idle';
      if (restored.workspacePath) {
        restored.alias = workspaceAliases[restored.workspacePath] ?? restored.alias;
      }
      return restored;
    });
    if (!tabs.some((tab) => tab.id === 'home')) {
      tabs.unshift(createEmptyTab('home', 'home'));
    }
    return {
      tabs,
      activeTabId: tabs.some((tab) => tab.id === parsed.activeTabId)
        ? (parsed.activeTabId as string)
        : 'home',
    };
  } catch {
    return {
      tabs: [createEmptyTab('home', 'home')],
      activeTabId: 'home',
    };
  }
}

export function writePersistedDesktopTabs(tabs: DesktopTab[], activeTabId: string) {
  try {
    const payload: PersistedDesktopTabsState = {
      activeTabId,
      tabs: tabs.map((tab) => ({
        id: tab.id,
        kind: tab.kind,
        alias: tab.alias,
        workspaceName: tab.workspaceName,
        workspacePath: tab.workspacePath,
        currentFile: tab.currentFile,
      })),
    };
    localStorage.setItem(DESKTOP_TABS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

export function readInitialDesktopState(): InitialDesktopState {
  const workspaceAliases = readWorkspaceAliases();
  const tabState = readPersistedDesktopTabs(workspaceAliases);
  for (const tab of tabState.tabs) {
    const alias = tab.alias?.trim();
    if (tab.workspacePath && alias && !workspaceAliases[tab.workspacePath]) {
      workspaceAliases[tab.workspacePath] = alias;
    }
  }
  return {
    workspaceAliases,
    tabs: tabState.tabs,
    activeTabId: tabState.activeTabId,
  };
}

export function getDroppedFilePath(file: File): string | undefined {
  const electronApi = (window as any).electronAPI;
  const tauriDroppedPath = electronApi?.consumeDroppedPaths?.()[0];
  return tauriDroppedPath || electronApi?.getPathForFile?.(file) || (file as any).path;
}
