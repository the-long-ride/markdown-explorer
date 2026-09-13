// =============================================================================
// contexts/AppStateContext.tsx — Global application state
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { usePlatform } from './PlatformContext';
import type {
  PersistedState,
  ThemeMode,
  ThemeStyle,
  AppSettings,
  SaveDocumentResultMessage,
} from '../types';
import { requestSaveDocument, type SaveDocumentRequestOptions } from '../editor/saveDocument';
import { documentSessionKey, type MarkdownEditMode } from '../editor/documentSession';
import { useUnsavedChangesGuard } from '../editor/useUnsavedChangesGuard';
import { useDocumentConflictResolution } from '../editor/useDocumentConflictResolution';
import type { DocumentViewMode, PaneId } from '../split-view/paneState';
import { useAppStateEffects } from './useAppStateEffects';
import {
  type AppState,
  type Action,
  type AppAction,
  type NavigateOptions,
  type PendingHtmlPreviewNavigation,
  reducer as appReducer,
  createInitialState as appCreateInitialState,
  normalizePathKey,
} from './appStateReducer';

export type { AppState, Action, AppAction };

export {
  ALL_THEME_STYLE_OPTIONS,
  DEFAULT_KEYBINDINGS,
  DEFAULT_PET_THEME_STYLE,
  DESKTOP_DEFAULT_KEYBINDINGS,
  VSCODE_DEFAULT_KEYBINDINGS,
  PET_THEME_STYLE_OPTIONS,
  THEME_MODE_OPTIONS,
  THEME_STYLE_OPTIONS,
  getDefaultKeybindings,
  getDefaultKeybindingsForRuntime,
  isPetThemeStyle,
} from './appStateConstants';

function reducer(state: AppState, action: AppAction): AppState {
  return appReducer(state, action, (key, value) => {
    try { localStorage.setItem(key, value); } catch {}
  });
}

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  navigate: (fsPath: string | null, options?: NavigateOptions) => void;
  activateContentTab: (fsPath: string) => void;
  reorderContentTabs: (sourcePath: string, targetPath: string) => void;
  closeContentTab: (fsPath: string) => void;
  closeContentTabsToRight: (fsPath: string) => void;
  closeOtherContentTabs: (fsPath: string) => void;
  closeAllContentTabs: () => void;
  openInSplit: (filePath: string) => void;
  moveToOtherPane: (filePath: string) => void;
  swapSplitPanes: () => void;
  closeSplitView: () => void;
  activatePane: (paneId: PaneId) => void;
  setSplitRatio: (ratio: number) => void;
  setSplitPaneMode: (paneId: PaneId, mode: DocumentViewMode) => void;
  setSplitPaneScrollTop: (paneId: PaneId, scrollTop: number) => void;
  guardUnsavedChanges: (filePaths: string[], commit: () => void) => void;
  setWorkingDocumentSource: (filePath: string, source: string) => void;
  setDocumentEditMode: (filePath: string, mode: MarkdownEditMode) => void;
  discardDocumentChanges: (filePath: string) => void;
  saveDocument: (filePath: string, options?: SaveDocumentRequestOptions) => Promise<SaveDocumentResultMessage | null>;
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
  toggleDefaultHtmlPreview: () => void;
  setContentTabHtmlPreview: (filePath: string, enabled: boolean | undefined) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const bridge = usePlatform();
  const isDesktop = typeof (window as any).electronAPI !== 'undefined';
  const shouldLogPerf = import.meta.env.DEV || new URLSearchParams(window.location.search).has('perf');
  const [state, dispatch] = useReducer(reducer, undefined, () => appCreateInitialState(bridge.getState<PersistedState>(), isDesktop));
  const pendingHtmlPreviewNavigationRef = useRef<PendingHtmlPreviewNavigation | null>(null);

  useAppStateEffects({ bridge, dispatch, state, isDesktop, shouldLogPerf, pendingHtmlPreviewNavigationRef });

  const getCachedContentTabPath = useCallback((fsPath: string) => {
    if (!state.settings.fileTabs || !fsPath) return null;
    const pathWithoutFragment = fsPath.split('#')[0];
    const target = normalizePathKey(pathWithoutFragment);
    const fileInfo = state.fileList.find((file) => normalizePathKey(file.fsPath) === target);
    const targetPath = fileInfo?.fsPath ?? pathWithoutFragment;
    const tab = state.contentTabs.find((item) => normalizePathKey(item.filePath) === normalizePathKey(targetPath));
    return tab?.filePath ?? null;
  }, [state.contentTabs, state.fileList, state.settings.fileTabs]);

  const navigate = useCallback((fsPath: string | null, options?: NavigateOptions) => {
    const targetPath = fsPath ?? '';
    if (targetPath && options?.htmlPreviewOverride !== undefined) {
      pendingHtmlPreviewNavigationRef.current = { filePath: targetPath, enabled: options.htmlPreviewOverride };
    } else {
      pendingHtmlPreviewNavigationRef.current = null;
    }
    if (targetPath) {
      const cachedPath = getCachedContentTabPath(targetPath);
      if (cachedPath) {
        if (state.splitView.enabled) {
          dispatch({ type: 'SET_SPLIT_PANE_FILE', paneId: state.splitView.activePane, filePath: cachedPath });
        }
        dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath: cachedPath });
        if (options?.htmlPreviewOverride !== undefined) {
          dispatch({ type: 'SET_CONTENT_TAB_HTML_PREVIEW', filePath: cachedPath, enabled: options.htmlPreviewOverride });
          pendingHtmlPreviewNavigationRef.current = null;
        }
        bridge.postMessage({ command: 'navigate', path: cachedPath });
        return;
      }
      if (state.splitView.enabled) {
        dispatch({
          type: 'SET_SPLIT_PANE_FILE',
          paneId: state.splitView.activePane,
          filePath: targetPath.split('#')[0],
        });
      }
    }
    dispatch({ type: 'SET_LOADING' });
    bridge.postMessage({ command: 'navigate', path: targetPath });
  }, [bridge, getCachedContentTabPath, state.splitView.activePane, state.splitView.enabled]);

  const activateContentTab = useCallback((fsPath: string) => {
    if (!fsPath) return;
    pendingHtmlPreviewNavigationRef.current = null;
    dispatch({ type: 'ACTIVATE_CONTENT_TAB', filePath: fsPath });
    bridge.postMessage({ command: 'navigate', path: fsPath });
  }, [bridge]);

  const reorderContentTabs = useCallback((sourcePath: string, targetPath: string) => {
    if (!sourcePath || !targetPath || normalizePathKey(sourcePath) === normalizePathKey(targetPath)) return;
    dispatch({ type: 'REORDER_CONTENT_TABS', sourcePath, targetPath });
  }, []);

  const closeContentTab = useCallback((fsPath: string) => {
    const tabIndex = state.contentTabs.findIndex((item) => normalizePathKey(item.filePath) === normalizePathKey(fsPath));
    if (tabIndex === -1) return;
    const closingActive = normalizePathKey(state.activeContentTabPath ?? '') === normalizePathKey(fsPath);
    const nextTabs = state.contentTabs.filter((_, index) => index !== tabIndex);
    const fallback = closingActive ? nextTabs[tabIndex - 1] ?? nextTabs[tabIndex] ?? null : null;
    dispatch({ type: 'CLOSE_CONTENT_TAB', filePath: fsPath });
    if (closingActive) bridge.postMessage({ command: 'navigate', path: fallback?.filePath ?? '' });
  }, [bridge, state.activeContentTabPath, state.contentTabs]);

  const closeContentTabsToRight = useCallback((fsPath: string) => {
    const targetIndex = state.contentTabs.findIndex((item) => normalizePathKey(item.filePath) === normalizePathKey(fsPath));
    if (targetIndex === -1 || targetIndex >= state.contentTabs.length - 1) return;
    const activeIndex = state.contentTabs.findIndex((item) => normalizePathKey(item.filePath) === normalizePathKey(state.activeContentTabPath ?? ''));
    dispatch({ type: 'CLOSE_CONTENT_TABS_TO_RIGHT', filePath: fsPath });
    if (activeIndex === -1 || activeIndex > targetIndex) bridge.postMessage({ command: 'navigate', path: fsPath });
  }, [bridge, state.activeContentTabPath, state.contentTabs]);

  const closeOtherContentTabs = useCallback((fsPath: string) => {
    const targetTab = state.contentTabs.find((item) => normalizePathKey(item.filePath) === normalizePathKey(fsPath));
    if (!targetTab || state.contentTabs.length <= 1) return;
    const targetIsActive = normalizePathKey(state.activeContentTabPath ?? '') === normalizePathKey(fsPath);
    dispatch({ type: 'CLOSE_OTHER_CONTENT_TABS', filePath: fsPath });
    if (!targetIsActive) bridge.postMessage({ command: 'navigate', path: fsPath });
  }, [bridge, state.activeContentTabPath, state.contentTabs]);

  const closeAllContentTabs = useCallback(() => {
    if (state.contentTabs.length === 0) return;
    dispatch({ type: 'CLOSE_ALL_CONTENT_TABS' });
    bridge.postMessage({ command: 'navigate', path: '' });
  }, [bridge, state.contentTabs.length]);

  const openInSplit = useCallback((filePath: string) => {
    if (!filePath) return;
    dispatch({ type: 'OPEN_SPLIT_VIEW', filePath });
  }, []);

  const moveToOtherPane = useCallback((filePath: string) => {
    if (!filePath) return;
    if (!state.splitView.enabled) {
      dispatch({ type: 'OPEN_SPLIT_VIEW', filePath });
      return;
    }
    const paneId: PaneId = state.splitView.activePane === 'primary' ? 'secondary' : 'primary';
    dispatch({ type: 'SET_SPLIT_PANE_FILE', paneId, filePath });
  }, [state.splitView.activePane, state.splitView.enabled]);

  const swapSplitPanes = useCallback(() => {
    dispatch({ type: 'SWAP_SPLIT_PANES' });
  }, []);

  const closeSplitView = useCallback(() => {
    dispatch({ type: 'CLOSE_SPLIT_VIEW' });
  }, []);

  const activatePane = useCallback((paneId: PaneId) => {
    dispatch({ type: 'ACTIVATE_SPLIT_PANE', paneId });
  }, []);

  const setSplitRatio = useCallback((ratio: number) => {
    dispatch({ type: 'SET_SPLIT_RATIO', ratio });
  }, []);

  const setSplitPaneMode = useCallback((paneId: PaneId, mode: DocumentViewMode) => {
    dispatch({ type: 'SET_SPLIT_PANE_MODE', paneId, mode });
  }, []);

  const setSplitPaneScrollTop = useCallback((paneId: PaneId, scrollTop: number) => {
    dispatch({ type: 'SET_SPLIT_PANE_SCROLL', paneId, scrollTop });
  }, []);

  const setWorkingDocumentSource = useCallback((filePath: string, source: string) => {
    dispatch({ type: 'SET_WORKING_DOCUMENT_SOURCE', filePath, source });
  }, []);

  const setDocumentEditMode = useCallback((filePath: string, mode: MarkdownEditMode) => {
    dispatch({ type: 'SET_DOCUMENT_EDIT_MODE', filePath, mode });
  }, []);

  const discardDocumentChanges = useCallback((filePath: string) => {
    dispatch({ type: 'DISCARD_DOCUMENT_CHANGES', filePath });
  }, []);

  const saveDocument = useCallback(async (filePath: string, options: SaveDocumentRequestOptions = {}): Promise<SaveDocumentResultMessage | null> => {
    const session = state.documentSessions[documentSessionKey(filePath)];
    if (!session) return null;
    dispatch({ type: 'MARK_DOCUMENT_SAVE_STARTED', filePath });
    const result = await requestSaveDocument(bridge, session, options);
    dispatch({ type: 'APPLY_SAVE_DOCUMENT_RESULT', result });
    return result;
  }, [bridge, state.documentSessions]);

  const { guardUnsavedChanges, unsavedChangesModal } = useUnsavedChangesGuard({
    sessions: state.documentSessions,
    saveDocument,
    discardDocumentChanges,
  });
  const { conflictModal } = useDocumentConflictResolution({
    sessions: state.documentSessions,
    dispatch,
    saveDocument,
  });

  const openInEditor = useCallback(() => {
    if (state.currentFile) bridge.postMessage({ command: 'openInEditor', path: state.currentFile });
  }, [bridge, state.currentFile]);

  const refresh = useCallback(() => {
    if (!state.currentFile) return;
    dispatch({ type: 'SET_LOADING' });
    bridge.postMessage({ command: 'refresh' });
  }, [bridge, state.currentFile]);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = state.theme === 'dark' || state.theme === 'auto' ? 'light' : 'dark';
    dispatch({ type: 'SET_THEME', theme: next });
    bridge.postMessage({ command: 'updateAppearance', theme: next, themeStyle: state.themeStyle });
  }, [bridge, state.theme, state.themeStyle]);

  const setTheme = useCallback((theme: ThemeMode) => {
    dispatch({ type: 'SET_THEME', theme });
    bridge.postMessage({ command: 'updateAppearance', theme, themeStyle: state.themeStyle });
  }, [bridge, state.themeStyle]);

  const setThemeStyle = useCallback((themeStyle: ThemeStyle) => {
    dispatch({ type: 'SET_THEME_STYLE', themeStyle });
    bridge.postMessage({ command: 'updateAppearance', theme: state.theme, themeStyle });
  }, [bridge, state.theme]);

  const selectCustomTheme = useCallback((themeId: string | undefined) => {
    const customTheme = themeId ? state.settings.customThemes?.find((theme) => theme.id === themeId) : undefined;
    dispatch({ type: 'SELECT_CUSTOM_THEME', themeId: customTheme?.id });
    if (customTheme) {
      const nextThemeMode = customTheme.colorMode ?? state.theme;
      if (customTheme.colorMode) dispatch({ type: 'SET_THEME', theme: customTheme.colorMode });
      bridge.postMessage({ command: 'updateAppearance', theme: nextThemeMode, themeStyle: customTheme.baseStyle });
    }
  }, [bridge, state.settings.customThemes, state.theme]);

  const toggleSidebar = useCallback(() => { dispatch({ type: 'TOGGLE_SIDEBAR' }); }, []);
  const toggleToc = useCallback(() => { dispatch({ type: 'TOGGLE_TOC' }); }, []);
  const toggleFocusMode = useCallback(() => { dispatch({ type: 'TOGGLE_FOCUS_MODE' }); }, []);
  const setSidebarCollapsed = useCallback((collapsed: boolean) => { dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed }); }, []);
  const setSidebarActiveTab = useCallback((tab: 'files' | 'search') => { dispatch({ type: 'SET_SIDEBAR_ACTIVE_TAB', tab }); }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: patch });
    if ('documentConversion' in patch) bridge.postMessage({ command: 'setDocumentConversion', enabled: patch.documentConversion === true });
  }, [bridge]);

  const toggleDesktopViewMode = useCallback(() => {
    updateSettings({ desktopViewMode: state.settings.desktopViewMode === 'tabs' ? 'focus' : 'tabs' });
  }, [state.settings.desktopViewMode, updateSettings]);

  const toggleDefaultHtmlPreview = useCallback(() => {
    updateSettings({ defaultHtmlPreview: !state.settings.defaultHtmlPreview });
  }, [state.settings.defaultHtmlPreview, updateSettings]);

  const setContentTabHtmlPreview = useCallback((filePath: string, enabled: boolean | undefined) => {
    dispatch({ type: 'SET_CONTENT_TAB_HTML_PREVIEW', filePath, enabled });
  }, []);

  const value = useMemo<AppStateContextValue>(() => ({
    state, dispatch, navigate, activateContentTab, reorderContentTabs, closeContentTab,
    closeContentTabsToRight, closeOtherContentTabs, closeAllContentTabs,
    openInSplit, moveToOtherPane, swapSplitPanes, closeSplitView, activatePane,
    setSplitRatio, setSplitPaneMode, setSplitPaneScrollTop, guardUnsavedChanges,
    setWorkingDocumentSource, setDocumentEditMode, discardDocumentChanges, saveDocument,
    openInEditor, refresh, toggleTheme, setTheme, setThemeStyle, selectCustomTheme,
    toggleSidebar, setSidebarCollapsed, setSidebarActiveTab, toggleToc, toggleFocusMode,
    toggleDesktopViewMode, toggleDefaultHtmlPreview, setContentTabHtmlPreview, updateSettings,
  }), [
    state, navigate, activateContentTab, reorderContentTabs, closeContentTab, closeContentTabsToRight,
    closeOtherContentTabs, closeAllContentTabs, openInSplit, moveToOtherPane, swapSplitPanes,
    closeSplitView, activatePane, setSplitRatio, setSplitPaneMode, setSplitPaneScrollTop,
    guardUnsavedChanges, setWorkingDocumentSource, setDocumentEditMode, discardDocumentChanges,
    saveDocument, openInEditor, refresh, toggleTheme, setTheme, setThemeStyle, selectCustomTheme,
    toggleSidebar, setSidebarCollapsed, setSidebarActiveTab, toggleToc, toggleFocusMode,
    toggleDesktopViewMode, toggleDefaultHtmlPreview, setContentTabHtmlPreview, updateSettings,
  ]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
      {unsavedChangesModal}
      {conflictModal}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
