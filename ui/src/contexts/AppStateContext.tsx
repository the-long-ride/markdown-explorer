// =============================================================================
// contexts/AppStateContext.tsx — Global application state
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from 'react';
import { usePlatform } from './PlatformContext';
import type {
  PersistedState,
  ThemeMode,
  ThemeStyle,
  AppSettings,
} from '../types';
import { useAppStateEffects } from './useAppStateEffects';
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
  reorderContentTabs: (sourcePath: string, targetPath: string) => void;
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
  toggleDesktopViewMode: () => void;
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

  useAppStateEffects({ bridge, dispatch, state, isDesktop, shouldLogPerf });

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

  const reorderContentTabs = useCallback((sourcePath: string, targetPath: string) => {
    if (!sourcePath || !targetPath || normalizePathKey(sourcePath) === normalizePathKey(targetPath)) return;
    dispatch({ type: 'REORDER_CONTENT_TABS', sourcePath, targetPath });
  }, []);

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

  const toggleDesktopViewMode = useCallback(() => {
    updateSettings({
      desktopViewMode: state.settings.desktopViewMode === 'tabs' ? 'focus' : 'tabs',
    });
  }, [state.settings.desktopViewMode, updateSettings]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      dispatch,
      navigate,
      activateContentTab,
      reorderContentTabs,
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
      toggleDesktopViewMode,
      updateSettings,
    }),
    [
      state,
      navigate,
      activateContentTab,
      reorderContentTabs,
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
      toggleDesktopViewMode,
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

