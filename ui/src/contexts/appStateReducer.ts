import { createEmptyUpdateState, normalizePathKey, type AppState, type Action } from './appStateModel';
import type { RecentWorkspace } from '../types';
import { normalizeActiveCustomThemeId, normalizeCustomThemes } from '../theme/customThemes';
import {
  applyContentTab,
  applyContentTabsFallback,
  clearContentTabs,
  createContentTabFromMessage,
  createContentTabFromState,
  getWorkspaceScopeKey,
  reconcileScopeFocusSetting,
  reorderContentTabs,
  refreshContentTabMetadata,
  renderMarkdownClientSide,
  upsertContentTab,
} from './contentTabState';

export * from './appStateModel';
export * from './contentTabState';

export type TocStorageWriter = (key: string, value: string) => void;

export function reducer(
  state: AppState,
  action: Action,
  writeTocStorage?: TocStorageWriter,
): AppState {
  switch (action.type) {
    case 'READY_ACK': {
      const nextWorkspaceKey = getWorkspaceScopeKey(action.workspacePath, action.workspaceName);
      const currentWorkspaceKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
      const workspaceChanged = nextWorkspaceKey !== currentWorkspaceKey;
      const restoredContentTabs = action.contentTabs
        ? refreshContentTabMetadata(action.contentTabs, action.fileList)
        : workspaceChanged
          ? []
          : refreshContentTabMetadata(state.contentTabs, action.fileList);
      const reconciledScopeFocus = reconcileScopeFocusSetting({
        scopeFocus: state.settings.scopeFocus,
        scopeKey: nextWorkspaceKey,
        previousFileList: state.fileList,
        nextFileList: action.fileList,
        previousTree: state.tree,
        includeNewFiles: !workspaceChanged && state.fileList.length > 0,
      });
      const reconciledSearchScopeFocus = reconcileScopeFocusSetting({
        scopeFocus: state.settings.searchScopeFocus,
        scopeKey: nextWorkspaceKey,
        previousFileList: state.fileList,
        nextFileList: action.fileList,
        previousTree: state.tree,
        includeNewFiles: !workspaceChanged && state.fileList.length > 0,
      });
      return {
        ...state,
        fileList: action.fileList,
        tree: action.tree,
        theme: state.hasThemePreference ? state.theme : action.theme,
        themeStyle: state.hasThemeStylePreference ? state.themeStyle : action.themeStyle,
        defaultExpanded: action.defaultExpanded,
        workspaceName: action.workspaceName,
        workspacePath: action.workspacePath,
        markdownSource: null,
        previewInfo: null,
        settings: {
          ...state.settings,
          documentConversion: action.documentConversionEnabled ?? state.settings.documentConversion,
          scopeFocus: reconciledScopeFocus,
          searchScopeFocus: reconciledSearchScopeFocus,
        },
        recentWorkspaces: (action.recentWorkspaces as RecentWorkspace[]) ?? state.recentWorkspaces,
        appVersion: action.appVersion ?? state.appVersion,
        appRuntime: action.appRuntime ?? state.appRuntime,
        hostPlatform: action.hostPlatform ?? state.hostPlatform,
        hostArch: action.hostArch ?? state.hostArch,
        canInstallUpdates: action.canInstallUpdates ?? state.canInstallUpdates,
        isMaximized: action.isMaximized ?? state.isMaximized,
        isLoading: workspaceChanged
          ? (action.workspaceName ? state.isLoading : false)
          : false,
        staleContentFilePath: null,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
        contentTabs: restoredContentTabs,
        activeContentTabPath:
          action.activeContentTabPath !== undefined
            ? action.activeContentTabPath
            : workspaceChanged
              ? null
              : state.activeContentTabPath,
        focusMode: false,
        sidebarActiveTab: 'files',
      };
    }

    case 'RECENT_WORKSPACES_CHANGED':
      return {
        ...state,
        recentWorkspaces: action.recentWorkspaces as RecentWorkspace[],
      };

    case 'RENDER_CONTENT': {
      const filePath = action.msg.filePath || null;
      const nextFileList = action.msg.fileList ?? state.fileList;
      const isMdx = filePath ? filePath.endsWith('.mdx') : false;
      const rendered = action.msg.markdownSource
        ? renderMarkdownClientSide(action.msg.markdownSource, filePath, isMdx)
        : { html: action.msg.html, frontmatter: action.msg.frontmatter, toc: action.msg.toc };
      const baseState: AppState = {
        ...state,
        fileList: nextFileList,
        currentFile: filePath,
        contentHtml: rendered.html,
        markdownSource: action.msg.markdownSource ?? null,
        frontmatter: rendered.frontmatter,
        toc: rendered.toc,
        previewInfo: action.msg.previewInfo ?? null,
        relativePath: action.msg.relativePath,
        isLoading: false,
        isWorkspaceScanning: false,
        loadingLabel: '',
        loadingDetail: '',
        staleContentFilePath: null,
        notFoundHref: null,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
        renderVersion: state.renderVersion + 1,
      };
      if (!state.settings.fileTabs) {
        return {
          ...baseState,
          contentTabs: [],
          activeContentTabPath: null,
        };
      }
      if (!filePath) {
        return {
          ...baseState,
          contentTabs: refreshContentTabMetadata(state.contentTabs, nextFileList),
          activeContentTabPath: null,
        };
      }
      const tab = createContentTabFromMessage(action.msg, nextFileList);
      return {
        ...baseState,
        contentTabs: upsertContentTab(
          refreshContentTabMetadata(state.contentTabs, nextFileList),
          tab,
        ),
        activeContentTabPath: filePath,
      };
    }

    case 'WORKSPACE_FILES_CHANGED': {
      const nextWorkspaceKey = getWorkspaceScopeKey(action.workspacePath, action.workspaceName);
      const currentWorkspaceKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
      const workspaceChanged = nextWorkspaceKey !== currentWorkspaceKey;
      const reconciledScopeFocus = reconcileScopeFocusSetting({
        scopeFocus: state.settings.scopeFocus,
        scopeKey: nextWorkspaceKey,
        previousFileList: state.fileList,
        nextFileList: action.fileList,
        previousTree: state.tree,
        includeNewFiles: !workspaceChanged && state.fileList.length > 0,
      });
      const reconciledSearchScopeFocus = reconcileScopeFocusSetting({
        scopeFocus: state.settings.searchScopeFocus,
        scopeKey: nextWorkspaceKey,
        previousFileList: state.fileList,
        nextFileList: action.fileList,
        previousTree: state.tree,
        includeNewFiles: !workspaceChanged && state.fileList.length > 0,
      });
      return {
        ...state,
        fileList: action.fileList,
        tree: action.tree,
        workspaceName: action.workspaceName,
        workspacePath: action.workspacePath,
        settings: {
          ...state.settings,
          documentConversion: action.documentConversionEnabled ?? state.settings.documentConversion,
          scopeFocus: reconciledScopeFocus,
          searchScopeFocus: reconciledSearchScopeFocus,
        },
        contentTabs: refreshContentTabMetadata(state.contentTabs, action.fileList),
        isLoading: false,
        isWorkspaceScanning: false,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
      };
    }

    case 'CURRENT_FILE_CHANGED':
      if (normalizePathKey(state.currentFile ?? '') !== normalizePathKey(action.filePath)) return state;
      return {
        ...state,
        staleContentFilePath: action.filePath,
      };

    case 'NAV_NOT_FOUND':
      return {
        ...state,
        isLoading: false,
        notFoundHref: action.href,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
      };

    case 'ACTIVATE_CONTENT_TAB': {
      const tab = state.contentTabs.find(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(action.filePath),
      );
      if (!tab) return state;
      return applyContentTab(state, tab);
    }

    case 'REORDER_CONTENT_TABS': {
      const contentTabs = reorderContentTabs(state.contentTabs, action.sourcePath, action.targetPath);
      return contentTabs === state.contentTabs ? state : { ...state, contentTabs };
    }

    case 'CLOSE_CONTENT_TAB': {
      const tabIndex = state.contentTabs.findIndex(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(action.filePath),
      );
      if (tabIndex === -1) return state;
      const nextTabs = state.contentTabs.filter((_, index) => index !== tabIndex);
      if (normalizePathKey(state.activeContentTabPath ?? '') !== normalizePathKey(action.filePath)) {
        return {
          ...state,
          contentTabs: nextTabs,
        };
      }
      const fallback = nextTabs[tabIndex - 1] ?? nextTabs[tabIndex] ?? null;
      if (fallback) return applyContentTab(state, fallback, nextTabs);
      return clearContentTabs(state);
    }

    case 'CLOSE_CONTENT_TABS_TO_RIGHT': {
      const tabIndex = state.contentTabs.findIndex(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(action.filePath),
      );
      if (tabIndex === -1 || tabIndex >= state.contentTabs.length - 1) return state;
      const nextTabs = state.contentTabs.slice(0, tabIndex + 1);
      return applyContentTabsFallback(state, nextTabs, action.filePath);
    }

    case 'CLOSE_OTHER_CONTENT_TABS': {
      const targetTab = state.contentTabs.find(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(action.filePath),
      );
      if (!targetTab || state.contentTabs.length <= 1) return state;
      return applyContentTab(state, targetTab, [targetTab]);
    }

    case 'CLOSE_ALL_CONTENT_TABS': {
      if (state.contentTabs.length === 0) return state;
      return clearContentTabs(state);
    }

    case 'WORKSPACE_UNAVAILABLE':
      return {
        ...state,
        fileList: [],
        tree: null,
        currentFile: null,
        workspaceName: action.workspaceName,
        workspacePath: action.workspacePath,
        contentHtml: '',
        markdownSource: null,
        frontmatter: {},
        toc: [],
        previewInfo: null,
        relativePath: '',
        isLoading: false,
        loadingLabel: '',
        loadingDetail: '',
        notFoundHref: null,
        workspaceUnavailablePath: action.workspacePath,
        workspaceUnavailableReason: action.reason,
        recentWorkspaces: (action.recentWorkspaces as RecentWorkspace[]) ?? state.recentWorkspaces,
        appVersion: action.appVersion ?? state.appVersion,
        appRuntime: action.appRuntime ?? state.appRuntime,
        hostPlatform: action.hostPlatform ?? state.hostPlatform,
        hostArch: action.hostArch ?? state.hostArch,
        canInstallUpdates: action.canInstallUpdates ?? state.canInstallUpdates,
        isMaximized: action.isMaximized ?? state.isMaximized,
        contentTabs: [],
        activeContentTabPath: null,
        renderVersion: state.renderVersion + 1,
        focusMode: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: true,
        loadingLabel: action.label || 'Loading docs...',
        loadingDetail: action.detail || '',
        staleContentFilePath: null,
        notFoundHref: null,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
      };

    case 'WORKSPACE_SCAN_PROGRESS':
      return { ...state, isWorkspaceScanning: action.active, scannedFiles: action.scannedFiles };

    case 'SET_UPDATE_STATE':
      return {
        ...state,
        updateState: {
          ...createEmptyUpdateState(),
          ...action.updateState,
        },
      };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case 'TOGGLE_TOC': {
      const nextCollapsed = !state.tocCollapsed;
      if (writeTocStorage) {
        try {
          writeTocStorage('markdown-explorer-toc-collapsed', String(nextCollapsed));
        } catch {}
      }
      return { ...state, tocCollapsed: nextCollapsed };
    }

    case 'SET_THEME':
      return { ...state, theme: action.theme, hasThemePreference: true };

    case 'SET_THEME_STYLE':
      return {
        ...state,
        themeStyle: action.themeStyle,
        hasThemeStylePreference: true,
        settings: { ...state.settings, activeCustomThemeId: undefined },
      };

    case 'SELECT_CUSTOM_THEME': {
      const customTheme = action.themeId
        ? state.settings.customThemes?.find((theme) => theme.id === action.themeId)
        : undefined;
      return {
        ...state,
        themeStyle: customTheme?.baseStyle ?? state.themeStyle,
        hasThemeStylePreference: customTheme ? true : state.hasThemeStylePreference,
        settings: {
          ...state.settings,
          activeCustomThemeId: customTheme?.id,
        },
      };
    }

    case 'UPDATE_SETTINGS': {
      const customThemes = action.settings.customThemes
        ? normalizeCustomThemes(action.settings.customThemes)
        : state.settings.customThemes;
      const activeCustomThemeId =
        'activeCustomThemeId' in action.settings || action.settings.customThemes
          ? normalizeActiveCustomThemeId(
              'activeCustomThemeId' in action.settings
                ? action.settings.activeCustomThemeId
                : state.settings.activeCustomThemeId,
              customThemes ?? [],
            )
          : state.settings.activeCustomThemeId;
      const activeCustomTheme = activeCustomThemeId
        ? customThemes?.find((theme) => theme.id === activeCustomThemeId)
        : undefined;
      const nextState = {
        ...state,
        themeStyle: activeCustomTheme?.baseStyle ?? state.themeStyle,
        hasThemeStylePreference: activeCustomTheme ? true : state.hasThemeStylePreference,
        settings: {
          ...state.settings,
          ...action.settings,
          customThemes,
          activeCustomThemeId,
        },
      };
      if ('fileTabs' in action.settings) {
        if (action.settings.fileTabs === false) {
          return {
            ...nextState,
            contentTabs: [],
            activeContentTabPath: null,
          };
        }
        if (action.settings.fileTabs === true && !state.settings.fileTabs) {
          const currentTab = createContentTabFromState(state);
          return {
            ...nextState,
            contentTabs: currentTab
              ? upsertContentTab(state.contentTabs, currentTab)
              : state.contentTabs,
            activeContentTabPath: currentTab?.filePath ?? state.activeContentTabPath,
          };
        }
      }
      return nextState;
    }

    case 'SET_MAXIMIZED':
      return {
        ...state,
        isMaximized: action.isMaximized,
      };

    case 'TOGGLE_FOCUS_MODE':
      return {
        ...state,
        focusMode: !state.focusMode,
      };

    case 'SET_SIDEBAR_ACTIVE_TAB':
      return { ...state, sidebarActiveTab: action.tab };

    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, sidebarCollapsed: action.collapsed };

    default:
      return state;
  }
}
