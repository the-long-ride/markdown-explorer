// =============================================================================
// contexts/AppStateContext.tsx — Global application state
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { usePlatform } from './PlatformContext';
import type {
  MdFile,
  FolderNode,
  TocEntry,
  Frontmatter,
  ThemeMode,
  AppSettings,
  PersistedState,
  RenderContentMessage,
  RecentWorkspace,
} from '../types';

// ── State shape ─────────────────────────────────────────────────────────────

interface AppState {
  /** All scanned files */
  fileList: MdFile[];
  /** Sidebar tree structure */
  tree: FolderNode | null;
  /** Currently displayed file */
  currentFile: string | null;
  /** Current theme */
  theme: ThemeMode;
  /** Expand sections by default */
  defaultExpanded: boolean;
  /** Workspace name */
  workspaceName: string;
  /** Sidebar collapsed */
  sidebarCollapsed: boolean;
  /** Rendered HTML (from host) */
  contentHtml: string;
  /** Current frontmatter */
  frontmatter: Frontmatter;
  /** Current TOC entries */
  toc: TocEntry[];
  /** Current relative path (for breadcrumb) */
  relativePath: string;
  /** Is loading content */
  isLoading: boolean;
  /** Nav not found href */
  notFoundHref: string | null;
  /** User settings */
  settings: AppSettings;
  /** Content render counter (triggers effects) */
  renderVersion: number;
  /** Recent workspaces (Electron only) */
  recentWorkspaces: RecentWorkspace[];
  /** Is window maximized (Electron only) */
  isMaximized: boolean;
}

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  back: 'Ctrl+ArrowLeft',
  forward: 'Ctrl+ArrowRight',
  welcome: 'Ctrl+h',
  settings: 'Ctrl+i',
  toggleTheme: 'Ctrl+Shift+l',
  refresh: 'F5',
  collapseAll: 'Ctrl+Shift+x',
  expandAll: 'Ctrl+Shift+e',
  workspaceSelection: 'Ctrl+Shift+h',
  toggleSidebar: 'Ctrl+Shift+p',
};

const initialState: AppState = {
  fileList: [],
  tree: null,
  currentFile: null,
  theme: 'auto',
  defaultExpanded: true,
  workspaceName: '',
  sidebarCollapsed: false,
  contentHtml: '',
  frontmatter: {},
  toc: [],
  relativePath: '',
  isLoading: true,
  notFoundHref: null,
  settings: { showTitle: true, defaultHtmlPreview: true, keybindings: DEFAULT_KEYBINDINGS },
  renderVersion: 0,
  recentWorkspaces: [],
  isMaximized: false,
};

// ── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | {
      type: 'READY_ACK';
      fileList: MdFile[];
      tree: FolderNode | null;
      theme: ThemeMode;
      defaultExpanded: boolean;
      workspaceName: string;
      recentWorkspaces?: readonly RecentWorkspace[];
    }
  | { type: 'RENDER_CONTENT'; msg: RenderContentMessage }
  | { type: 'NAV_NOT_FOUND'; href: string }
  | { type: 'SET_LOADING' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'SET_MAXIMIZED'; isMaximized: boolean };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'READY_ACK':
      return {
        ...state,
        fileList: action.fileList,
        tree: action.tree,
        theme: state.theme !== 'auto' ? state.theme : action.theme,
        defaultExpanded: action.defaultExpanded,
        workspaceName: action.workspaceName,
        recentWorkspaces: (action.recentWorkspaces as RecentWorkspace[]) ?? state.recentWorkspaces,
        isLoading: false,
      };

    case 'RENDER_CONTENT':
      return {
        ...state,
        fileList: action.msg.fileList ?? state.fileList,
        currentFile: action.msg.filePath,
        contentHtml: action.msg.html,
        frontmatter: action.msg.frontmatter,
        toc: action.msg.toc,
        relativePath: action.msg.relativePath,
        isLoading: false,
        notFoundHref: null,
        renderVersion: state.renderVersion + 1,
      };

    case 'NAV_NOT_FOUND':
      return { ...state, isLoading: false, notFoundHref: action.href };

    case 'SET_LOADING':
      return { ...state, isLoading: true, notFoundHref: null };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case 'SET_THEME':
      return { ...state, theme: action.theme };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };

    case 'SET_MAXIMIZED':
      return {
        ...state,
        isMaximized: action.isMaximized,
      };

    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────────────────────────────────

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  navigate: (fsPath: string | null) => void;
  openInEditor: () => void;
  refresh: () => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const bridge = usePlatform();
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load persisted settings on mount
  useEffect(() => {
    const saved = bridge.getState<PersistedState>();
    if (saved) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        settings: {
          showTitle: saved.showTitle !== false,
          defaultHtmlPreview: saved.defaultHtmlPreview !== false,
          keybindings: saved.keybindings ?? DEFAULT_KEYBINDINGS,
        },
      });
      if (saved.theme) {
        dispatch({ type: 'SET_THEME', theme: saved.theme });
      }
    }
  }, [bridge]);

  // Listen for host messages
  useEffect(() => {
    return bridge.onMessage((msg) => {
      switch (msg.command) {
        case 'readyAck':
          // Check if there is a saved theme in state (since mount useEffect runs first)
          const savedTheme = bridge.getState<PersistedState>()?.theme;
          dispatch({
            type: 'READY_ACK',
            fileList: msg.fileList,
            tree: msg.tree,
            theme: savedTheme || (msg.theme as ThemeMode) || 'auto',
            defaultExpanded: msg.defaultExpanded,
            workspaceName: msg.workspaceName,
            recentWorkspaces: msg.recentWorkspaces,
          });
          break;
        case 'renderContent':
          dispatch({ type: 'RENDER_CONTENT', msg });
          break;
        case 'navNotFound':
          dispatch({ type: 'NAV_NOT_FOUND', href: msg.href });
          break;
        case 'window-state-changed':
          dispatch({ type: 'SET_MAXIMIZED', isMaximized: msg.isMaximized });
          break;
      }
    });
  }, [bridge]);

  // Sync theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  // Persist settings on change
  useEffect(() => {
    bridge.setState<PersistedState>({
      showTitle: state.settings.showTitle,
      defaultHtmlPreview: state.settings.defaultHtmlPreview,
      keybindings: state.settings.keybindings,
      theme: state.theme,
    });
  }, [bridge, state.settings, state.theme]);

  // Actions
  const navigate = useCallback(
    (fsPath: string | null) => {
      dispatch({ type: 'SET_LOADING' });
      bridge.postMessage({ command: 'navigate', path: fsPath ?? '' });
    },
    [bridge],
  );

  const openInEditor = useCallback(() => {
    if (state.currentFile) {
      bridge.postMessage({ command: 'openInEditor', path: state.currentFile });
    }
  }, [bridge, state.currentFile]);

  const refresh = useCallback(() => {
    bridge.postMessage({ command: 'refresh' });
  }, [bridge]);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode =
      state.theme === 'dark' || state.theme === 'auto' ? 'light' : 'dark';
    dispatch({ type: 'SET_THEME', theme: next });
  }, [state.theme]);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: patch });
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      dispatch,
      navigate,
      openInEditor,
      refresh,
      toggleTheme,
      toggleSidebar,
      updateSettings,
    }),
    [state, navigate, openInEditor, refresh, toggleTheme, toggleSidebar, updateSettings],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
