import { useEffect, type MutableRefObject } from 'react';
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
import type { HostMessage, PersistedState, WebviewMessage } from '../types';
import {
  normalizePathKey,
  type Action,
  type AppState,
  type PendingHtmlPreviewNavigation,
} from './appStateReducer';
import { acceptsWorkspaceHostMessage } from '../desktop/workspaceOperations';
import { normalizeMaxPinnedItems } from '../components/Sidebar/sidebarWorkspacePreferences';

type AppStateEffectsArgs = {
  bridge: {
    getState: <T>() => T | null | undefined;
    setState: <T>(state: T) => void;
    onMessage: (handler: (msg: HostMessage) => void) => () => void;
    postMessage: (message: WebviewMessage) => void;
  };
  dispatch: React.Dispatch<Action>;
  state: AppState;
  isDesktop: boolean;
  shouldLogPerf: boolean;
  pendingHtmlPreviewNavigationRef: MutableRefObject<PendingHtmlPreviewNavigation | null>;
};

export function useAppStateEffects({
  bridge,
  dispatch,
  state,
  isDesktop,
  shouldLogPerf,
  pendingHtmlPreviewNavigationRef,
}: AppStateEffectsArgs) {
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
          defaultCsvPreview: saved.defaultCsvPreview !== false,
          fileTabs: saved.fileTabs === true,
          documentConversion: saved.documentConversion === true,
          scopeFocus: saved.scopeFocus ?? {},
          searchScopeFocus: saved.searchScopeFocus ?? {},
          sidebarPinnedItems: saved.sidebarPinnedItems ?? {},
          sidebarSortModes: saved.sidebarSortModes ?? {},
          maxPinnedItems: normalizeMaxPinnedItems(saved.maxPinnedItems),
          desktopViewMode: normalizeDesktopViewMode(saved.desktopViewMode),
          keybindings: normalizeKeybindings(saved.keybindings, isDesktop),
          disabledKeybindings: saved.disabledKeybindings ?? {},
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
      const workspaceScopedCommands = new Set([
        'readyAck',
        'workspaceFilesChanged',
        'currentFileChanged',
        'renderContent',
        'workspaceUnavailable',
        'setLoading',
        'workspaceScanProgress',
      ]);
      if (workspaceScopedCommands.has(msg.command) && !acceptsWorkspaceHostMessage(msg)) {
        return;
      }
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
            canInstallUpdates: msg.canInstallUpdates,
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
        case 'renderContent': {
          const pendingHtmlPreview = pendingHtmlPreviewNavigationRef.current;
          const matchesPendingPreview = Boolean(
            pendingHtmlPreview &&
            msg.filePath &&
            normalizePathKey(pendingHtmlPreview.filePath) === normalizePathKey(msg.filePath),
          );
          dispatch({
            type: 'RENDER_CONTENT',
            msg,
            htmlPreviewOverride: matchesPendingPreview ? pendingHtmlPreview?.enabled : undefined,
          });
          if (matchesPendingPreview) pendingHtmlPreviewNavigationRef.current = null;
          break;
        }
        case 'navNotFound':
          pendingHtmlPreviewNavigationRef.current = null;
          dispatch({ type: 'NAV_NOT_FOUND', href: msg.href });
          break;
        case 'workspaceUnavailable':
          pendingHtmlPreviewNavigationRef.current = null;
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
            canInstallUpdates: msg.canInstallUpdates,
            isMaximized: msg.isMaximized,
          });
          break;
        case 'setLoading':
          dispatch({ type: 'SET_LOADING', label: msg.label, detail: msg.detail });
          break;
        case 'workspaceScanProgress':
          dispatch({
            type: 'WORKSPACE_SCAN_PROGRESS',
            scannedFiles: msg.scannedFiles,
            active: msg.active,
          });
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
  }, [bridge, pendingHtmlPreviewNavigationRef, shouldLogPerf]);

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
      defaultCsvPreview: state.settings.defaultCsvPreview,
      fileTabs: state.settings.fileTabs,
      documentConversion: state.settings.documentConversion,
      scopeFocus: state.settings.scopeFocus,
      searchScopeFocus: state.settings.searchScopeFocus,
      sidebarPinnedItems: state.settings.sidebarPinnedItems,
      sidebarSortModes: state.settings.sidebarSortModes,
      maxPinnedItems: normalizeMaxPinnedItems(state.settings.maxPinnedItems),
      desktopViewMode: state.settings.desktopViewMode,
      keybindings: state.settings.keybindings,
      disabledKeybindings: state.settings.disabledKeybindings,
      theme: state.theme,
      themeStyle: state.themeStyle,
      language: state.settings.language,
      customThemes: state.settings.customThemes,
      activeCustomThemeId: state.settings.activeCustomThemeId,
    });
  }, [bridge, state.settings, state.theme, state.themeStyle]);

  // Actions

}
