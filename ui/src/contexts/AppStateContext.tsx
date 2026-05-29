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
import type {
  MdFile,
  FolderNode,
  TocEntry,
  Frontmatter,
  ThemeMode,
  ThemeStyle,
  DesktopViewMode,
  PetThemeStyle,
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
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
};

export const THEME_MODE_OPTIONS: readonly { id: ThemeMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export const THEME_STYLE_OPTIONS: readonly {
  id: Exclude<ThemeStyle, PetThemeStyle>;
  label: string;
  description: string;
}[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Compact reader surfaces with the original Markdown Explorer balance.',
  },
  {
    id: 'glass',
    label: 'Evolved Glass',
    description: 'Layered translucent panels, softer strokes, and airy document rhythm.',
  },
  {
    id: 'bento',
    label: 'Bento Grids',
    description: 'Modular blocks, stronger structure, and denser scan-friendly spacing.',
  },
];

export const DEFAULT_PET_THEME_STYLE: PetThemeStyle = 'pet-shiba';

export const PET_THEME_STYLE_OPTIONS: readonly {
  id: PetThemeStyle;
  label: string;
  description: string;
}[] = [
  {
    id: 'pet-white-shiba',
    label: 'White Shiba',
    description: 'Snowy fur, warm ears, and a calm little desk buddy.',
  },
  {
    id: 'pet-shiba',
    label: 'Normal Shiba',
    description: 'Toasted orange, curled-tail energy with cheerful paw trails.',
  },
  {
    id: 'pet-shiba-memes',
    label: 'Black Shiba',
    description: 'A dark Shiba theme with inky fur, bright eyes, and cheerful desk-buddy energy.',
  },
  {
    id: 'pet-k-ink',
    label: "K-Ink (app author's dog)",
    description: 'A personal K-Ink theme with expressive ears, warm amber eyes, and anime sticker energy.',
  },
  {
    id: 'pet-cat',
    label: 'Cat',
    description: 'Soft midnight whiskers, fish-bone marks, and nimble motion.',
  },
  {
    id: 'pet-hamster',
    label: 'Hamster',
    description: 'Seed colors, round cheeks, and a pocket-sized reading rhythm.',
  },
  {
    id: 'pet-corgi',
    label: 'Corgi',
    description: 'Golden loaf shapes, sky notes, and a wagging workspace mood.',
  },
];

export const ALL_THEME_STYLE_OPTIONS = [
  ...THEME_STYLE_OPTIONS,
  ...PET_THEME_STYLE_OPTIONS,
] as const;

export function isPetThemeStyle(value: ThemeStyle): value is PetThemeStyle {
  return PET_THEME_STYLE_OPTIONS.some((option) => option.id === value);
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return THEME_MODE_OPTIONS.some((option) => option.id === value)
    ? (value as ThemeMode)
    : 'auto';
}

function normalizeThemeStyle(value: unknown): ThemeStyle {
  return ALL_THEME_STYLE_OPTIONS.some((option) => option.id === value)
    ? (value as ThemeStyle)
    : 'default';
}

function normalizeDesktopViewMode(value: unknown): DesktopViewMode {
  return value === 'tabs' ? 'tabs' : 'focus';
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
    showTitle: true,
    defaultHtmlPreview: true,
    desktopViewMode: 'focus',
    keybindings: DEFAULT_KEYBINDINGS,
  },
  renderVersion: 0,
  recentWorkspaces: [],
  isMaximized: false,
};

function createInitialState(saved?: PersistedState): AppState {
  if (!saved) return initialState;
  return {
    ...initialState,
    theme: saved.theme ? normalizeThemeMode(saved.theme) : initialState.theme,
    hasThemePreference: !!saved.theme,
    themeStyle: saved.themeStyle ? normalizeThemeStyle(saved.themeStyle) : initialState.themeStyle,
    hasThemeStylePreference: !!saved.themeStyle,
    settings: {
      ...initialState.settings,
      showTitle: saved.showTitle !== false,
      defaultHtmlPreview: saved.defaultHtmlPreview !== false,
      desktopViewMode: normalizeDesktopViewMode(saved.desktopViewMode),
      keybindings: saved.keybindings ?? DEFAULT_KEYBINDINGS,
    },
  };
}

// ── Actions ─────────────────────────────────────────────────────────────────

type Action =
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
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    createInitialState(bridge.getState<PersistedState>()),
  );

  // Load persisted settings on mount
  useEffect(() => {
    const saved = bridge.getState<PersistedState>();
    if (saved) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        settings: {
          showTitle: saved.showTitle !== false,
          defaultHtmlPreview: saved.defaultHtmlPreview !== false,
          desktopViewMode: normalizeDesktopViewMode(saved.desktopViewMode),
          keybindings: saved.keybindings ?? DEFAULT_KEYBINDINGS,
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
  }, [bridge]);

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
