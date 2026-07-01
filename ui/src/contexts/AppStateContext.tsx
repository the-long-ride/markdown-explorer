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
import {
  normalizeDesktopViewMode,
  normalizeKeybindings,
  normalizeThemeMode,
  normalizeThemeStyle,
} from './appStateConstants';
import {
  applyCustomThemeToRoot,
  getActiveCustomTheme,
  normalizeActiveCustomThemeId,
  normalizeCustomThemes,
} from '../theme/customThemes';
import type {
  PersistedState,
  ThemeMode,
  ThemeStyle,
  AppSettings,
} from '../types';
import {
  type AppState,
  type Action,
  reducer as appReducer,
  createInitialState as appCreateInitialState,
  normalizePathKey,
} from './appStateReducer';

export type { AppState, Action };

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

function reducer(state: AppState, action: Action): AppState {
  return appReducer(state, action, (key, value) => {
    try { localStorage.setItem(key, value); } catch {}
  });
}

// ── Context ─────────────────────────────────────────────────────────────────

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  navigate: (fsPath: string | null) => void;
  activateContentTab: (fsPath: string) => void;
  closeContentTab: (fsPath: string) => void;
  closeContentTabsToRight: (fsPath: string) => void;
  closeOtherContentTabs: (fsPath: string) => void;
  closeAllContentTabs: () => void;
  openInEditor: () => void;
  refresh: () => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  setThemeStyle: (themeStyle: ThemeStyle) => void;
  selectCustomTheme: (themeId: string | undefined) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarActiveTab: (tab: 'files' | 'search') => void;
  toggleToc: () => void;
  toggleFocusMode: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const bridge = usePlatform();
  const isDesktop = typeof (window as any).electronAPI !== 'undefined';
  const shouldLogPerf =
    import.meta.env.DEV || new URLSearchParams(window.location.search).has('perf');
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    appCreateInitialState(bridge.getState<PersistedState>(), isDesktop),
  );

  // Load persisted settings on mount
  useEffect(() => {
    const saved = bridge.getState<PersistedState>();
    if (saved) {
      const customThemes = normalizeCustomThemes(saved.customThemes);
      const activeCustomThemeId = normalizeActiveCustomThemeId(saved.activeCustomThemeId, customThemes);
      dispatch({
        type: 'UPDATE_SETTINGS',
        settings: {
          showTitle: saved.showTitle === true,
          defaultHtmlPreview: saved.defaultHtmlPreview !== false,
          fileTabs: saved.fileTabs === true,
          documentConversion: saved.documentConversion === true,
          scopeFocus: saved.scopeFocus ?? {},
          searchScopeFocus: saved.searchScopeFocus ?? {},
          desktopViewMode: normalizeDesktopViewMode(saved.desktopViewMode),
          keybindings: normalizeKeybindings(saved.keybindings, isDesktop),
          language: saved.language || 'en',
          customThemes,
          activeCustomThemeId,
        },
      });
      if (saved.theme) {
        dispatch({ type: 'SET_THEME', theme: normalizeThemeMode(saved.theme) });
      }
      if (activeCustomThemeId) {
        dispatch({ type: 'SELECT_CUSTOM_THEME', themeId: activeCustomThemeId });
      } else if (saved.themeStyle) {
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
            documentConversionEnabled: msg.documentConversionEnabled,
            isMaximized: msg.isMaximized,
          });
          break;
        case 'workspaceFilesChanged':
          dispatch({
            type: 'WORKSPACE_FILES_CHANGED',
            fileList: msg.fileList,
            tree: msg.tree,
            workspaceName: msg.workspaceName,
            workspacePath: msg.workspacePath,
            documentConversionEnabled: msg.documentConversionEnabled,
          });
          break;
        case 'currentFileChanged':
          dispatch({ type: 'CURRENT_FILE_CHANGED', filePath: msg.filePath });
          break;
        case 'recentWorkspacesChanged':
          dispatch({
            type: 'RECENT_WORKSPACES_CHANGED',
            recentWorkspaces: msg.recentWorkspaces,
          });
          break;
        case 'renderContent':
          dispatch({ type: 'RENDER_CONTENT', msg });
          break;
        case 'navNotFound':
          dispatch({ type: 'NAV_NOT_FOUND', href: msg.href });
          break;
        case 'workspaceUnavailable':
          dispatch({
            type: 'WORKSPACE_UNAVAILABLE',
            workspacePath: msg.workspacePath,
            workspaceName: msg.workspaceName,
            reason: msg.reason,
            recentWorkspaces: msg.recentWorkspaces,
            appVersion: msg.appVersion,
            appRuntime: msg.appRuntime,
            hostPlatform: msg.hostPlatform,
            hostArch: msg.hostArch,
            isMaximized: msg.isMaximized,
          });
          break;
        case 'setLoading':
          dispatch({ type: 'SET_LOADING', label: msg.label, detail: msg.detail });
          break;
        case 'updateStateChanged':
          dispatch({ type: 'SET_UPDATE_STATE', updateState: msg.state });
          break;
        case 'window-state-changed':
          dispatch({ type: 'SET_MAXIMIZED', isMaximized: msg.isMaximized });
          break;
      }
    });

    const saved = bridge.getState<PersistedState>();
    if (shouldLogPerf) {
      performance.mark('renderer:ready-post');
      console.info('[perf] mark renderer:ready-post');
    }
    bridge.postMessage({
      command: 'ready',
      documentConversionEnabled:
        typeof saved?.documentConversion === 'boolean'
          ? saved.documentConversion
          : undefined,
    });

    return unsub;
  }, [bridge, shouldLogPerf]);

  // Sync theme to document
  useEffect(() => {
    const activeCustomTheme = getActiveCustomTheme(state.settings);
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.themeStyle = activeCustomTheme?.baseStyle ?? state.themeStyle;
    applyCustomThemeToRoot(document.documentElement, activeCustomTheme, state.theme);

    if (state.theme !== 'auto') return;
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!media) return;
    const handleChange = () => {
      applyCustomThemeToRoot(
        document.documentElement,
        getActiveCustomTheme(state.settings),
        state.theme,
      );
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [state.settings, state.theme, state.themeStyle]);

  // Persist settings on change
  useEffect(() => {
    bridge.setState<PersistedState>({
      showTitle: state.settings.showTitle,
      defaultHtmlPreview: state.settings.defaultHtmlPreview,
      fileTabs: state.settings.fileTabs,
      documentConversion: state.settings.documentConversion,
      scopeFocus: state.settings.scopeFocus,
      searchScopeFocus: state.settings.searchScopeFocus,
      desktopViewMode: state.settings.desktopViewMode,
      keybindings: state.settings.keybindings,
      theme: state.theme,
      themeStyle: state.themeStyle,
      language: state.settings.language,
      customThemes: state.settings.customThemes,
      activeCustomThemeId: state.settings.activeCustomThemeId,
    });
  }, [bridge, state.settings, state.theme, state.themeStyle]);

  // Actions
  const getCachedContentTabPath = useCallback(
    (fsPath: string) => {
      if (!state.settings.fileTabs || !fsPath) return null;
      const pathWithoutFragment = fsPath.split('#')[0];
      const target = normalizePathKey(pathWithoutFragment);
      const fileInfo = state.fileList.find(
        (file) => normalizePathKey(file.fsPath) === target,
      );
      const targetPath = fileInfo?.fsPath ?? pathWithoutFragment;
      const tab = state.contentTabs.find(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(targetPath),
      );
      return tab?.filePath ?? null;
    },
    [state.contentTabs, state.fileList, state.settings.fileTabs],
  );

  const navigate = useCallback(
    (fsPath: string | null) => {
      const targetPath = fsPath ?? '';
      if (targetPath) {
        const cachedPath = getCachedContentTabPath(targetPath);
        if (cachedPath) {
          dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath: cachedPath });
          bridge.postMessage({ command: 'navigate', path: cachedPath });
          return;
        }
      }
      dispatch({ type: 'SET_LOADING' });
      bridge.postMessage({ command: 'navigate', path: targetPath });
    },
    [bridge, getCachedContentTabPath],
  );

  const activateContentTab = useCallback(
    (fsPath: string) => {
      if (!fsPath) return;
      dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath: fsPath });
      bridge.postMessage({ command: 'navigate', path: fsPath });
    },
    [bridge],
  );

  const closeContentTab = useCallback(
    (fsPath: string) => {
      const tabIndex = state.contentTabs.findIndex(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(fsPath),
      );
      if (tabIndex === -1) return;
      const closingActive =
        normalizePathKey(state.activeContentTabPath ?? '') === normalizePathKey(fsPath);
      const nextTabs = state.contentTabs.filter((_, index) => index !== tabIndex);
      const fallback = closingActive
        ? nextTabs[tabIndex - 1] ?? nextTabs[tabIndex] ?? null
        : null;
      dispatch({ type: 'CLOSE_CONTENT_TAB', filePath: fsPath });
      if (closingActive) {
        bridge.postMessage({ command: 'navigate', path: fallback?.filePath ?? '' });
      }
    },
    [bridge, state.activeContentTabPath, state.contentTabs],
  );

  const closeContentTabsToRight = useCallback(
    (fsPath: string) => {
      const targetIndex = state.contentTabs.findIndex(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(fsPath),
      );
      if (targetIndex === -1 || targetIndex >= state.contentTabs.length - 1) return;
      const activeIndex = state.contentTabs.findIndex(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(state.activeContentTabPath ?? ''),
      );
      dispatch({ type: 'CLOSE_CONTENT_TABS_TO_RIGHT', filePath: fsPath });
      if (activeIndex === -1 || activeIndex > targetIndex) {
        bridge.postMessage({ command: 'navigate', path: fsPath });
      }
    },
    [bridge, state.activeContentTabPath, state.contentTabs],
  );

  const closeOtherContentTabs = useCallback(
    (fsPath: string) => {
      const targetTab = state.contentTabs.find(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(fsPath),
      );
      if (!targetTab || state.contentTabs.length <= 1) return;
      const targetIsActive =
        normalizePathKey(state.activeContentTabPath ?? '') === normalizePathKey(fsPath);
      dispatch({ type: 'CLOSE_OTHER_CONTENT_TABS', filePath: fsPath });
      if (!targetIsActive) {
        bridge.postMessage({ command: 'navigate', path: fsPath });
      }
    },
    [bridge, state.activeContentTabPath, state.contentTabs],
  );

  const closeAllContentTabs = useCallback(() => {
    if (state.contentTabs.length === 0) return;
    dispatch({ type: 'CLOSE_ALL_CONTENT_TABS' });
    bridge.postMessage({ command: 'navigate', path: '' });
  }, [bridge, state.contentTabs.length]);

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

  const selectCustomTheme = useCallback((themeId: string | undefined) => {
    const customTheme = themeId
      ? state.settings.customThemes?.find((theme) => theme.id === themeId)
      : undefined;
    dispatch({ type: 'SELECT_CUSTOM_THEME', themeId: customTheme?.id });
    if (customTheme) {
      const nextThemeMode = customTheme.colorMode ?? state.theme;
      if (customTheme.colorMode) {
        dispatch({ type: 'SET_THEME', theme: customTheme.colorMode });
      }
      bridge.postMessage({
        command: 'updateAppearance',
        theme: nextThemeMode,
        themeStyle: customTheme.baseStyle,
      });
    }
  }, [bridge, state.settings.customThemes, state.theme]);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const toggleToc = useCallback(() => {
    dispatch({ type: 'TOGGLE_TOC' });
  }, []);

  const toggleFocusMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_FOCUS_MODE' });
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed });
  }, []);

  const setSidebarActiveTab = useCallback((tab: 'files' | 'search') => {
    dispatch({ type: 'SET_SIDEBAR_ACTIVE_TAB', tab });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: patch });
    if ('documentConversion' in patch) {
      bridge.postMessage({
        command: 'setDocumentConversion',
        enabled: patch.documentConversion === true,
      });
    }
  }, [bridge]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      dispatch,
      navigate,
      activateContentTab,
      closeContentTab,
      closeContentTabsToRight,
      closeOtherContentTabs,
      closeAllContentTabs,
      openInEditor,
      refresh,
      toggleTheme,
      setTheme,
      setThemeStyle,
      selectCustomTheme,
      toggleSidebar,
      setSidebarCollapsed,
      setSidebarActiveTab,
      toggleToc,
      toggleFocusMode,
      updateSettings,
    }),
    [
      state,
      navigate,
      activateContentTab,
      closeContentTab,
      closeContentTabsToRight,
      closeOtherContentTabs,
      closeAllContentTabs,
      openInEditor,
      refresh,
      toggleTheme,
      setTheme,
      setThemeStyle,
      selectCustomTheme,
      toggleSidebar,
      setSidebarCollapsed,
      setSidebarActiveTab,
      toggleToc,
      toggleFocusMode,
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
