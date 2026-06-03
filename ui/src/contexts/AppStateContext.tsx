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
import { libsReady } from '../main';
import {
  DEFAULT_KEYBINDINGS,
  getDefaultKeybindings,
  normalizeDesktopViewMode,
  normalizeKeybindings,
  normalizeThemeMode,
  normalizeThemeStyle,
} from './appStateConstants';
import type {
  MdFile,
  FolderNode,
  TocEntry,
  Frontmatter,
  ThemeMode,
  ThemeStyle,
  AppSettings,
  PersistedState,
  RenderContentMessage,
  RecentWorkspace,
  AppRuntime,
  HostPlatform,
} from '../types';

export {
  ALL_THEME_STYLE_OPTIONS,
  DEFAULT_KEYBINDINGS,
  DEFAULT_PET_THEME_STYLE,
  DESKTOP_DEFAULT_KEYBINDINGS,
  PET_THEME_STYLE_OPTIONS,
  THEME_MODE_OPTIONS,
  THEME_STYLE_OPTIONS,
  getDefaultKeybindings,
  isPetThemeStyle,
} from './appStateConstants';

// ── State shape ─────────────────────────────────────────────────────────────

export interface AppState {
  /** All scanned files */
  fileList: MdFile[];
  /** Sidebar tree structure */
  tree: FolderNode | null;
  /** Currently displayed file */
  currentFile: string | null;
  /** Current theme */
  theme: ThemeMode;
  /** Whether the user or persisted state explicitly supplied a color mode */
  hasThemePreference: boolean;
  /** Current visual theme style */
  themeStyle: ThemeStyle;
  /** Whether the user or persisted state explicitly supplied a theme style */
  hasThemeStylePreference: boolean;
  /** Expand sections by default */
  defaultExpanded: boolean;
  /** Workspace name */
  workspaceName: string;
  /** Workspace absolute path (Electron only) */
  workspacePath?: string;
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
  /** Host app version reported by VS Code or Electron */
  appVersion: string;
  /** Host runtime variant */
  appRuntime: AppRuntime;
  /** Desktop OS/platform when available */
  hostPlatform: HostPlatform;
  /** Desktop CPU architecture when available */
  hostArch: string;
}

const initialState: AppState = {
  fileList: [],
  tree: null,
  currentFile: null,
  theme: 'auto',
  hasThemePreference: false,
  themeStyle: 'default',
  hasThemeStylePreference: false,
  defaultExpanded: true,
  workspaceName: '',
  workspacePath: undefined,
  sidebarCollapsed: false,
  contentHtml: '',
  frontmatter: {},
  toc: [],
  relativePath: '',
  isLoading: true,
  notFoundHref: null,
  settings: {
    showTitle: false,
    defaultHtmlPreview: true,
    desktopViewMode: 'focus',
    keybindings: DEFAULT_KEYBINDINGS,
    language: 'en',
  },
  renderVersion: 0,
  recentWorkspaces: [],
  isMaximized: false,
  appVersion: '',
  appRuntime: 'vscode',
  hostPlatform: 'unknown',
  hostArch: '',
};

function createInitialState(saved: PersistedState | undefined, isDesktop: boolean): AppState {
  const defaultKeybindings = getDefaultKeybindings(isDesktop);
  if (!saved) {
    return {
      ...initialState,
      appRuntime: isDesktop ? 'desktop' : 'vscode',
      settings: {
        ...initialState.settings,
        keybindings: defaultKeybindings,
      },
    };
  }
  return {
    ...initialState,
    appRuntime: isDesktop ? 'desktop' : 'vscode',
    theme: saved.theme ? normalizeThemeMode(saved.theme) : initialState.theme,
    hasThemePreference: !!saved.theme,
    themeStyle: saved.themeStyle ? normalizeThemeStyle(saved.themeStyle) : initialState.themeStyle,
    hasThemeStylePreference: !!saved.themeStyle,
    settings: {
      ...initialState.settings,
      showTitle: saved.showTitle === true,
      defaultHtmlPreview: saved.defaultHtmlPreview !== false,
      desktopViewMode: normalizeDesktopViewMode(saved.desktopViewMode),
      keybindings: normalizeKeybindings(saved.keybindings, isDesktop),
      language: saved.language || 'en',
    },
  };
}

// ── Actions ─────────────────────────────────────────────────────────────────

export type Action =
  | {
      type: 'READY_ACK';
      fileList: MdFile[];
      tree: FolderNode | null;
      theme: ThemeMode;
      themeStyle: ThemeStyle;
      defaultExpanded: boolean;
      workspaceName: string;
      workspacePath?: string;
      recentWorkspaces?: readonly RecentWorkspace[];
      appVersion?: string;
      appRuntime?: AppRuntime;
      hostPlatform?: HostPlatform;
      hostArch?: string;
    }
  | { type: 'RENDER_CONTENT'; msg: RenderContentMessage }
  | { type: 'NAV_NOT_FOUND'; href: string }
  | { type: 'SET_LOADING' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'SET_THEME_STYLE'; themeStyle: ThemeStyle }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'SET_MAXIMIZED'; isMaximized: boolean };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'READY_ACK':
      return {
        ...state,
        fileList: action.fileList,
        tree: action.tree,
        theme: state.hasThemePreference ? state.theme : action.theme,
        themeStyle: state.hasThemeStylePreference ? state.themeStyle : action.themeStyle,
        defaultExpanded: action.defaultExpanded,
        workspaceName: action.workspaceName,
        workspacePath: action.workspacePath,
        recentWorkspaces: (action.recentWorkspaces as RecentWorkspace[]) ?? state.recentWorkspaces,
        appVersion: action.appVersion ?? state.appVersion,
        appRuntime: action.appRuntime ?? state.appRuntime,
        hostPlatform: action.hostPlatform ?? state.hostPlatform,
        hostArch: action.hostArch ?? state.hostArch,
        isLoading: action.workspaceName ? state.isLoading : false,
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
      return { ...state, theme: action.theme, hasThemePreference: true };

    case 'SET_THEME_STYLE':
      return {
        ...state,
        themeStyle: action.themeStyle,
        hasThemeStylePreference: true,
      };

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
  setTheme: (theme: ThemeMode) => void;
  setThemeStyle: (themeStyle: ThemeStyle) => void;
  toggleSidebar: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const bridge = usePlatform();
  const isDesktop = typeof (window as any).electronAPI !== 'undefined';
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    createInitialState(bridge.getState<PersistedState>(), isDesktop),
  );

  // Load persisted settings on mount
  useEffect(() => {
    const saved = bridge.getState<PersistedState>();
    if (saved) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        settings: {
          showTitle: saved.showTitle === true,
          defaultHtmlPreview: saved.defaultHtmlPreview !== false,
          desktopViewMode: normalizeDesktopViewMode(saved.desktopViewMode),
          keybindings: normalizeKeybindings(saved.keybindings, isDesktop),
          language: saved.language || 'en',
        },
      });
      if (saved.theme) {
        dispatch({ type: 'SET_THEME', theme: normalizeThemeMode(saved.theme) });
      }
      if (saved.themeStyle) {
        dispatch({
          type: 'SET_THEME_STYLE',
          themeStyle: normalizeThemeStyle(saved.themeStyle),
        });
      }
    }
  }, [bridge, isDesktop]);

  // Listen for host messages
  useEffect(() => {
    const unsub = bridge.onMessage((msg) => {
      switch (msg.command) {
        case 'readyAck':
          // Check saved appearance state because mount effects can race host ready.
          const savedAppearance = bridge.getState<PersistedState>();
          dispatch({
            type: 'READY_ACK',
            fileList: msg.fileList,
            tree: msg.tree,
            theme: normalizeThemeMode(savedAppearance?.theme ?? msg.theme),
            themeStyle: normalizeThemeStyle(savedAppearance?.themeStyle ?? msg.themeStyle),
            defaultExpanded: msg.defaultExpanded,
            workspaceName: msg.workspaceName,
            workspacePath: msg.workspacePath,
            recentWorkspaces: msg.recentWorkspaces,
            appVersion: msg.appVersion,
            appRuntime: msg.appRuntime,
            hostPlatform: msg.hostPlatform,
            hostArch: msg.hostArch,
          });
          break;
        case 'renderContent':
          dispatch({ type: 'RENDER_CONTENT', msg });
          break;
        case 'navNotFound':
          dispatch({ type: 'NAV_NOT_FOUND', href: msg.href });
          break;
        case 'setLoading':
          dispatch({ type: 'SET_LOADING' });
          break;
        case 'window-state-changed':
          dispatch({ type: 'SET_MAXIMIZED', isMaximized: msg.isMaximized });
          break;
      }
    });

    // Wait for mermaid/chart.js to be on window before telling host we're ready
    libsReady.then(() => {
      bridge.postMessage({ command: 'ready' });
    });

    return unsub;
  }, [bridge]);

  // Sync theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.themeStyle = state.themeStyle;
  }, [state.theme, state.themeStyle]);

  // Persist settings on change
  useEffect(() => {
    bridge.setState<PersistedState>({
      showTitle: state.settings.showTitle,
      defaultHtmlPreview: state.settings.defaultHtmlPreview,
      desktopViewMode: state.settings.desktopViewMode,
      keybindings: state.settings.keybindings,
      theme: state.theme,
      themeStyle: state.themeStyle,
      language: state.settings.language,
    });
  }, [bridge, state.settings, state.theme, state.themeStyle]);

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
    dispatch({ type: 'SET_LOADING' });
    bridge.postMessage({ command: 'refresh' });
  }, [bridge]);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode =
      state.theme === 'dark' || state.theme === 'auto' ? 'light' : 'dark';
    dispatch({ type: 'SET_THEME', theme: next });
    bridge.postMessage({
      command: 'updateAppearance',
      theme: next,
      themeStyle: state.themeStyle,
    });
  }, [bridge, state.theme, state.themeStyle]);

  const setTheme = useCallback((theme: ThemeMode) => {
    dispatch({ type: 'SET_THEME', theme });
    bridge.postMessage({
      command: 'updateAppearance',
      theme,
      themeStyle: state.themeStyle,
    });
  }, [bridge, state.themeStyle]);

  const setThemeStyle = useCallback((themeStyle: ThemeStyle) => {
    dispatch({ type: 'SET_THEME_STYLE', themeStyle });
    bridge.postMessage({
      command: 'updateAppearance',
      theme: state.theme,
      themeStyle,
    });
  }, [bridge, state.theme]);

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
      setTheme,
      setThemeStyle,
      toggleSidebar,
      updateSettings,
    }),
    [
      state,
      navigate,
      openInEditor,
      refresh,
      toggleTheme,
      setTheme,
      setThemeStyle,
      toggleSidebar,
      updateSettings,
    ],
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
