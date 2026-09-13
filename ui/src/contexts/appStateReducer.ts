import { normalizePathKey, type AppState, type Action } from './appStateModel';
import type { MdFile, RecentWorkspace } from '../types';
import {
  applyContentTab,
  applyContentTabsFallback,
  clearContentTabs,
  createContentTabFromMessage,
  createPlaceholderContentTab,
  findFileInfo,
  getWorkspaceScopeKey,
  reconcileScopeFocusSetting,
  reorderContentTabs,
  refreshContentTabMetadata,
  upsertContentTab,
} from './contentTabState';
import { resolveRenderedDocument } from './renderedDocument';
import {
  prepareRenderContentSession,
  reduceDocumentEditingAction,
  type DocumentEditingAction,
} from '../editor/documentWorkingCopy';
import { reduceSettingsUiAction } from './reducers/settingsUiReducer';
import { reduceSplitViewAction, type SplitViewAction } from '../split-view/splitViewReducer';

export * from './appStateModel';
export * from './contentTabState';

export type TocStorageWriter = (key: string, value: string) => void;
export type AppAction = Action | DocumentEditingAction | SplitViewAction;

export function reducer(
  state: AppState,
  action: AppAction,
  writeTocStorage?: TocStorageWriter,
): AppState {
  if (action.type === 'RENDER_CONTENT') {
    const prepared = prepareRenderContentSession(state, action.msg);
    state = prepared.state;
    action = { ...action, msg: prepared.msg };
  }

  const editingState = reduceDocumentEditingAction(state, action as DocumentEditingAction);
  if (editingState) return editingState;

  const splitViewState = reduceSplitViewAction(state, action as SplitViewAction);
  if (splitViewState) return splitViewState;

  const settingsUiState = reduceSettingsUiAction(state, action as Action, writeTocStorage);
  if (settingsUiState) return settingsUiState;

  switch (action.type) {
    case 'READY_ACK': {
      const nextWorkspaceKey = getWorkspaceScopeKey(action.workspacePath, action.workspaceName);
      const currentWorkspaceKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
      const workspaceChanged = nextWorkspaceKey !== currentWorkspaceKey;
      const restoredContentTabs = action.contentTabs
        ? refreshContentTabMetadata(action.contentTabs, action.fileList)
        : workspaceChanged ? [] : refreshContentTabMetadata(state.contentTabs, action.fileList);
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
        currentHtmlPreviewOverride: workspaceChanged ? undefined : state.currentHtmlPreviewOverride,
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
        isLoading: workspaceChanged ? (action.workspaceName ? state.isLoading : false) : false,
        staleContentFilePath: null,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
        contentTabs: restoredContentTabs,
        activeContentTabPath: action.activeContentTabPath !== undefined
          ? action.activeContentTabPath
          : workspaceChanged ? null : state.activeContentTabPath,
        documentSessions: workspaceChanged ? {} : state.documentSessions,
        focusMode: false,
        sidebarActiveTab: 'files',
      };
    }

    case 'SET_DESKTOP_FONTS':
      return {
        ...state,
        desktopFonts: [...action.fonts],
        desktopFontError: action.error ?? null,
        desktopFontsResult: { requestId: action.requestId, importedId: action.importedId },
      };

    case 'RECENT_WORKSPACES_CHANGED':
      return { ...state, recentWorkspaces: action.recentWorkspaces as RecentWorkspace[] };

    case 'RENDER_CONTENT': {
      const filePath = action.msg.filePath || null;
      const nextFileList = action.msg.fileList ?? state.fileList;
      const rendered = resolveRenderedDocument(action.msg, state.settings);
      const existingTab = filePath
        ? state.contentTabs.find((item) => normalizePathKey(item.filePath) === normalizePathKey(filePath))
        : undefined;
      const retainedCurrentOverride = filePath && normalizePathKey(state.currentFile ?? '') === normalizePathKey(filePath)
        ? state.currentHtmlPreviewOverride
        : undefined;
      const resolvedHtmlPreviewOverride = action.htmlPreviewOverride ?? existingTab?.htmlPreviewOverride ?? retainedCurrentOverride;
      const baseState: AppState = {
        ...state,
        fileList: nextFileList,
        currentFile: filePath,
        contentHtml: rendered.html,
        markdownSource: action.msg.markdownSource ?? null,
        sourceDocumentText: action.msg.sourceDocumentText ?? null,
        currentHtmlPreviewOverride: resolvedHtmlPreviewOverride,
        frontmatter: rendered.frontmatter,
        toc: rendered.toc,
        previewInfo: action.msg.previewInfo ?? null,
        relativePath: action.msg.relativePath,
        isLoading: false,
        loadingLabel: '',
        loadingDetail: '',
        staleContentFilePath: null,
        notFoundHref: null,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
        renderVersion: state.renderVersion + 1,
      };
      if (!state.settings.fileTabs) return { ...baseState, contentTabs: [], activeContentTabPath: null };
      if (!filePath) {
        return {
          ...baseState,
          contentTabs: refreshContentTabMetadata(state.contentTabs, nextFileList),
          activeContentTabPath: null,
        };
      }
      const tab = {
        ...createContentTabFromMessage(action.msg, nextFileList, rendered),
        documentWrite: action.msg.documentWrite,
        htmlPreviewOverride: resolvedHtmlPreviewOverride,
      };
      return {
        ...baseState,
        contentTabs: upsertContentTab(refreshContentTabMetadata(state.contentTabs, nextFileList), tab),
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
        contentTabs: workspaceChanged ? [] : refreshContentTabMetadata(state.contentTabs, action.fileList),
        activeContentTabPath: workspaceChanged ? null : state.activeContentTabPath,
        currentHtmlPreviewOverride: workspaceChanged ? undefined : state.currentHtmlPreviewOverride,
        documentSessions: workspaceChanged ? {} : state.documentSessions,
        isLoading: false,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
      };
    }

    case 'CURRENT_FILE_CHANGED':
      if (normalizePathKey(state.currentFile ?? '') !== normalizePathKey(action.filePath)) return state;
      return { ...state, staleContentFilePath: action.filePath };

    case 'NAV_NOT_FOUND':
      return {
        ...state,
        isLoading: false,
        notFoundHref: action.href,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
      };

    case 'ACTIVATE_CONTENT_TAB': {
      const tab = state.contentTabs.find((item) => normalizePathKey(item.filePath) === normalizePathKey(action.filePath));
      if (!tab) return state;
      return applyContentTab(state, tab);
    }

    case 'REORDER_CONTENT_TABS': {
      const contentTabs = reorderContentTabs(state.contentTabs, action.sourcePath, action.targetPath);
      return contentTabs === state.contentTabs ? state : { ...state, contentTabs };
    }

    case 'RESTORE_CONTENT_TABS': {
      if (state.fileList.length === 0 || action.filePaths.length === 0) return state;
      const currentFile = state.currentFile;
      const placeholders = action.filePaths
        .map((filePath) => findFileInfo(state.fileList, filePath))
        .filter((fileInfo): fileInfo is MdFile => Boolean(fileInfo))
        .map((fileInfo) => createPlaceholderContentTab(fileInfo));
      if (placeholders.length === 0) return state;
      let contentTabs = placeholders;
      if (currentFile) {
        const activeKey = normalizePathKey(currentFile);
        const activeExists = placeholders.some((tab) => normalizePathKey(tab.filePath) === activeKey);
        if (!activeExists) {
          const activeInfo = findFileInfo(state.fileList, currentFile);
          if (activeInfo) contentTabs = [...placeholders, createPlaceholderContentTab(activeInfo)];
        }
      }
      return { ...state, contentTabs, activeContentTabPath: currentFile ?? placeholders[0].filePath };
    }

    case 'SET_CONTENT_TAB_HTML_PREVIEW': {
      const target = normalizePathKey(action.filePath);
      const isCurrent = normalizePathKey(state.currentFile ?? '') === target;
      let changed = false;
      const contentTabs = state.contentTabs.map((tab) => {
        if (normalizePathKey(tab.filePath) !== target) return tab;
        changed = true;
        if (action.enabled === undefined) {
          const { htmlPreviewOverride: _removed, ...rest } = tab;
          return rest;
        }
        return { ...tab, htmlPreviewOverride: action.enabled };
      });
      if (!changed && !isCurrent) return state;
      return {
        ...state,
        contentTabs,
        currentHtmlPreviewOverride: isCurrent ? action.enabled : state.currentHtmlPreviewOverride,
        renderVersion: state.renderVersion + 1,
      };
    }

    case 'CLOSE_CONTENT_TAB': {
      const tabIndex = state.contentTabs.findIndex((item) => normalizePathKey(item.filePath) === normalizePathKey(action.filePath));
      if (tabIndex === -1) return state;
      const nextTabs = state.contentTabs.filter((_, index) => index !== tabIndex);
      if (normalizePathKey(state.activeContentTabPath ?? '') !== normalizePathKey(action.filePath)) {
        return { ...state, contentTabs: nextTabs };
      }
      const fallback = nextTabs[tabIndex - 1] ?? nextTabs[tabIndex] ?? null;
      if (fallback) return applyContentTab(state, fallback, nextTabs);
      return clearContentTabs(state);
    }

    case 'CLOSE_CONTENT_TABS_TO_RIGHT': {
      const tabIndex = state.contentTabs.findIndex((item) => normalizePathKey(item.filePath) === normalizePathKey(action.filePath));
      if (tabIndex === -1 || tabIndex >= state.contentTabs.length - 1) return state;
      return applyContentTabsFallback(state, state.contentTabs.slice(0, tabIndex + 1), action.filePath);
    }

    case 'CLOSE_OTHER_CONTENT_TABS': {
      const targetTab = state.contentTabs.find((item) => normalizePathKey(item.filePath) === normalizePathKey(action.filePath));
      if (!targetTab || state.contentTabs.length <= 1) return state;
      return applyContentTab(state, targetTab, [targetTab]);
    }

    case 'CLOSE_ALL_CONTENT_TABS':
      return state.contentTabs.length === 0 ? state : clearContentTabs(state);

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
        documentSessions: {},
        renderVersion: state.renderVersion + 1,
        focusMode: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: true,
        loadingLabel: action.label || '',
        loadingDetail: action.detail || '',
        staleContentFilePath: null,
        notFoundHref: null,
        workspaceUnavailablePath: null,
        workspaceUnavailableReason: null,
      };

    case 'WORKSPACE_SCAN_PROGRESS':
      return { ...state, isWorkspaceScanning: action.active, scannedFiles: action.scannedFiles };

    default:
      return state;
  }
}
