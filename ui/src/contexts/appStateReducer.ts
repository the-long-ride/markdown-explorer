import {
  normalizeActiveCustomThemeId,
  normalizeCustomThemes,
} from '../theme/customThemes';
import {
  collectSelectedFolderPaths,
  reconcileScopeFocusPaths,
} from './scope-focus-reconcile.js';
import {
  DEFAULT_KEYBINDINGS,
  getDefaultKeybindings,
  normalizeDesktopViewMode,
  normalizeKeybindings,
  normalizeThemeMode,
  normalizeThemeStyle,
} from './appStateConstants';
import type {
  AppRuntime,
  AppSettings,
  ContentTab,
  FolderNode,
  Frontmatter,
  HostPlatform,
  MdFile,
  PersistedState,
  RecentWorkspace,
  RenderContentMessage,
  ThemeMode,
  ThemeStyle,
  TocEntry,
  UpdateState,
  WorkspaceUnavailableReason,
  DocumentPreviewInfo,
} from '../types';
import { parse } from '../markdown/parser';
import { HtmlRenderer } from '../markdown/renderer';
import { rewriteRelativeMediaUrls } from '../markdown/mediaUrls';

export interface AppState {
  fileList: MdFile[];
  tree: FolderNode | null;
  currentFile: string | null;
  theme: ThemeMode;
  hasThemePreference: boolean;
  themeStyle: ThemeStyle;
  hasThemeStylePreference: boolean;
  defaultExpanded: boolean;
  workspaceName: string;
  workspacePath?: string;
  sidebarCollapsed: boolean;
  tocCollapsed: boolean;
  contentHtml: string;
  markdownSource: string | null;
  frontmatter: Frontmatter;
  toc: TocEntry[];
  relativePath: string;
  isLoading: boolean;
  loadingLabel: string;
  loadingDetail: string;
  previewInfo: DocumentPreviewInfo | null;
  staleContentFilePath: string | null;
  notFoundHref: string | null;
  workspaceUnavailablePath: string | null;
  workspaceUnavailableReason: WorkspaceUnavailableReason | null;
  settings: AppSettings;
  renderVersion: number;
  contentTabs: ContentTab[];
  activeContentTabPath: string | null;
  recentWorkspaces: RecentWorkspace[];
  isMaximized: boolean;
  appVersion: string;
  appRuntime: AppRuntime;
  hostPlatform: HostPlatform;
  hostArch: string;
  canInstallUpdates: boolean;
  focusMode: boolean;
  updateState: UpdateState;
  sidebarActiveTab: 'files' | 'search';
}

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
      contentTabs?: readonly ContentTab[];
      activeContentTabPath?: string | null;
      recentWorkspaces?: readonly RecentWorkspace[];
      appVersion?: string;
      appRuntime?: AppRuntime;
      hostPlatform?: HostPlatform;
      hostArch?: string;
      canInstallUpdates?: boolean;
      documentConversionEnabled?: boolean;
      isMaximized?: boolean;
    }
  | {
      type: 'RECENT_WORKSPACES_CHANGED';
      recentWorkspaces: readonly RecentWorkspace[];
    }
  | { type: 'RENDER_CONTENT'; msg: RenderContentMessage }
  | {
      type: 'WORKSPACE_FILES_CHANGED';
      fileList: MdFile[];
      tree: FolderNode | null;
      workspaceName: string;
      workspacePath?: string;
      documentConversionEnabled?: boolean;
    }
  | { type: 'CURRENT_FILE_CHANGED'; filePath: string }
  | { type: 'NAV_NOT_FOUND'; href: string }
  | { type: 'ACTIVATE_CONTENT_TAB'; filePath: string }
  | { type: 'CLOSE_CONTENT_TAB'; filePath: string }
  | { type: 'CLOSE_CONTENT_TABS_TO_RIGHT'; filePath: string }
  | { type: 'CLOSE_OTHER_CONTENT_TABS'; filePath: string }
  | { type: 'CLOSE_ALL_CONTENT_TABS' }
  | {
      type: 'WORKSPACE_UNAVAILABLE';
      workspacePath: string;
      workspaceName: string;
      reason: WorkspaceUnavailableReason;
      recentWorkspaces?: readonly RecentWorkspace[];
      appVersion?: string;
      appRuntime?: AppRuntime;
      hostPlatform?: HostPlatform;
      hostArch?: string;
      canInstallUpdates?: boolean;
      isMaximized?: boolean;
    }
  | { type: 'SET_LOADING'; label?: string; detail?: string }
  | { type: 'SET_UPDATE_STATE'; updateState: UpdateState }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_TOC' }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'SET_THEME_STYLE'; themeStyle: ThemeStyle }
  | { type: 'SELECT_CUSTOM_THEME'; themeId: string | undefined }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'SET_MAXIMIZED'; isMaximized: boolean }
  | { type: 'TOGGLE_FOCUS_MODE' }
  | { type: 'SET_SIDEBAR_ACTIVE_TAB'; tab: 'files' | 'search' }
  | { type: 'SET_SIDEBAR_COLLAPSED'; collapsed: boolean };

export function createEmptyUpdateState(): UpdateState {
  return {
    status: 'idle',
    version: '',
    downloadedVersion: '',
    downloadedFileName: '',
    progressPercent: 0,
    error: '',
  };
}

export const initialState: AppState = {
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
  tocCollapsed: false,
  contentHtml: '',
  markdownSource: null,
  frontmatter: {},
  toc: [],
  relativePath: '',
  isLoading: true,
  loadingLabel: 'Loading docs...',
  loadingDetail: '',
  previewInfo: null,
  staleContentFilePath: null,
  notFoundHref: null,
  workspaceUnavailablePath: null,
  workspaceUnavailableReason: null,
  settings: {
    showTitle: false,
    defaultHtmlPreview: true,
    fileTabs: false,
    documentConversion: false,
    scopeFocus: {},
    desktopViewMode: 'focus',
    keybindings: DEFAULT_KEYBINDINGS,
    language: 'en',
    customThemes: [],
  },
  renderVersion: 0,
  contentTabs: [],
  activeContentTabPath: null,
  recentWorkspaces: [],
  isMaximized: false,
  appVersion: '',
  appRuntime: 'vscode',
  hostPlatform: 'unknown',
  hostArch: '',
  canInstallUpdates: false,
  focusMode: false,
  updateState: createEmptyUpdateState(),
  sidebarActiveTab: 'files',
};

export function createInitialState(
  saved: PersistedState | undefined,
  isDesktop: boolean,
  storage?: Storage | { getItem(k: string): string | null },
): AppState {
  const tocCollapsed = storage
    ? storage.getItem('markdown-explorer-toc-collapsed') === 'true'
    : false;
  const defaultKeybindings = getDefaultKeybindings(isDesktop);
  if (!saved) {
    return {
      ...initialState,
      appRuntime: isDesktop ? 'desktop' : 'vscode',
      tocCollapsed,
      focusMode: false,
      settings: {
        ...initialState.settings,
        keybindings: defaultKeybindings,
        searchScopeFocus: {},
      },
    };
  }
  const customThemes = normalizeCustomThemes(saved.customThemes);
  return {
    ...initialState,
    appRuntime: isDesktop ? 'desktop' : 'vscode',
    theme: saved.theme ? normalizeThemeMode(saved.theme) : initialState.theme,
    hasThemePreference: !!saved.theme,
    themeStyle: saved.themeStyle ? normalizeThemeStyle(saved.themeStyle) : initialState.themeStyle,
    hasThemeStylePreference: !!saved.themeStyle,
    tocCollapsed,
    settings: {
      ...initialState.settings,
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
      activeCustomThemeId: normalizeActiveCustomThemeId(saved.activeCustomThemeId, customThemes),
    },
  };
}

export function normalizePathKey(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase();
}

export function getWorkspaceScopeKey(workspacePath: string | undefined, workspaceName: string): string {
  return workspacePath || workspaceName || 'default';
}

export function getPathFileName(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath || 'Document';
}

export function stripMarkdownExtension(fileName: string): string {
  const extIndex = fileName.lastIndexOf('.');
  return extIndex > 0 ? fileName.slice(0, extIndex) : fileName;
}

export function findFileInfo(fileList: readonly MdFile[], filePath: string): MdFile | undefined {
  const target = normalizePathKey(filePath);
  return fileList.find(
    (file) =>
      normalizePathKey(file.fsPath) === target ||
      normalizePathKey(file.relativePath) === target,
  );
}

export function upsertContentTab(tabs: readonly ContentTab[], tab: ContentTab): ContentTab[] {
  const existingIndex = tabs.findIndex(
    (item) => normalizePathKey(item.filePath) === normalizePathKey(tab.filePath),
  );
  if (existingIndex === -1) return [...tabs, tab];
  return tabs.map((item, index) => (index === existingIndex ? tab : item));
}

export interface RenderedMarkdown {
  html: string;
  frontmatter: Record<string, string>;
  toc: Array<{ level: number; text: string; id: string }>;
}

export function renderMarkdownClientSide(
  markdownSource: string | null | undefined,
  filePath: string | null,
  isMdx?: boolean,
): RenderedMarkdown {
  const empty = { html: '', frontmatter: {}, toc: [] };
  if (!markdownSource) return empty;
  try {
    const result = parse(markdownSource, isMdx ?? false);
    const renderer = new HtmlRenderer({ theme: 'auto', isMdx: isMdx ?? false });
    const rendered = renderer.render(result.tokens);
    const html = rewriteRelativeMediaUrls(rendered.html, filePath ?? '');
    return { html, frontmatter: result.frontmatter, toc: rendered.toc };
  } catch (err) {
    console.error('Client-side markdown rendering failed:', err);
    return { html: `<pre>${markdownSource}</pre>`, frontmatter: {}, toc: [] };
  }
}

export function createContentTabFromMessage(
  msg: RenderContentMessage,
  fileList: readonly MdFile[],
): ContentTab {
  const fileInfo = findFileInfo(fileList, msg.filePath);
  const relativePath = msg.relativePath || fileInfo?.relativePath || getPathFileName(msg.filePath);
  const fileName = fileInfo?.fileName || getPathFileName(relativePath || msg.filePath);
  const title = msg.title || fileInfo?.title || stripMarkdownExtension(fileName);
  const isMdx = msg.filePath ? msg.filePath.endsWith('.mdx') : false;
  const rendered = msg.markdownSource
    ? renderMarkdownClientSide(msg.markdownSource, msg.filePath, isMdx)
    : { html: msg.html, frontmatter: msg.frontmatter, toc: msg.toc };
  return {
    filePath: msg.filePath,
    relativePath,
    fileName,
    title,
    contentHtml: rendered.html,
    markdownSource: msg.markdownSource ?? null,
    frontmatter: rendered.frontmatter,
    toc: rendered.toc,
    previewInfo: msg.previewInfo ?? null,
  };
}

export function createContentTabFromState(state: AppState): ContentTab | null {
  if (!state.currentFile) return null;
  const fileInfo = findFileInfo(state.fileList, state.currentFile);
  const relativePath = state.relativePath || fileInfo?.relativePath || getPathFileName(state.currentFile);
  const fileName = fileInfo?.fileName || getPathFileName(relativePath || state.currentFile);
  return {
    filePath: state.currentFile,
    relativePath,
    fileName,
    title: fileInfo?.title || stripMarkdownExtension(fileName),
    contentHtml: state.contentHtml,
    markdownSource: state.markdownSource,
    frontmatter: state.frontmatter,
    toc: state.toc,
    previewInfo: state.previewInfo,
  };
}

export function applyContentTab(state: AppState, tab: ContentTab, tabs = state.contentTabs): AppState {
  return {
    ...state,
    currentFile: tab.filePath,
    contentHtml: tab.contentHtml,
    markdownSource: tab.markdownSource,
    frontmatter: tab.frontmatter,
    toc: tab.toc,
    relativePath: tab.relativePath,
    isLoading: false,
    loadingLabel: '',
    loadingDetail: '',
    previewInfo: tab.previewInfo ?? null,
    notFoundHref: null,
    workspaceUnavailablePath: null,
    workspaceUnavailableReason: null,
    contentTabs: tabs as ContentTab[],
    activeContentTabPath: tab.filePath,
    renderVersion: state.renderVersion + 1,
  };
}

export function clearContentTabs(state: AppState): AppState {
  return {
    ...state,
    currentFile: null,
    contentHtml: '',
    markdownSource: null,
    frontmatter: {},
    toc: [],
    previewInfo: null,
    relativePath: '',
    isLoading: false,
    notFoundHref: null,
    contentTabs: [],
    activeContentTabPath: null,
    renderVersion: state.renderVersion + 1,
  };
}

export function applyContentTabsFallback(
  state: AppState,
  tabs: readonly ContentTab[],
  preferredPath?: string,
): AppState {
  const nextTabs = tabs as ContentTab[];
  if (nextTabs.length === 0) return clearContentTabs(state);

  const activePath = normalizePathKey(state.activeContentTabPath ?? '');
  const activeTab = nextTabs.find(
    (item) => normalizePathKey(item.filePath) === activePath,
  );
  if (activeTab) {
    return {
      ...state,
      contentTabs: nextTabs,
    };
  }

  const preferredTab = preferredPath
    ? nextTabs.find(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(preferredPath),
      )
    : null;
  return applyContentTab(state, preferredTab ?? nextTabs[nextTabs.length - 1], nextTabs);
}

export function refreshContentTabMetadata(
  tabs: readonly ContentTab[],
  fileList: readonly MdFile[],
): ContentTab[] {
  if (tabs.length === 0 || fileList.length === 0) return tabs as ContentTab[];
  return tabs.map((tab) => {
    const fileInfo = findFileInfo(fileList, tab.filePath);
    if (!fileInfo) return tab;
    return {
      ...tab,
      fileName: fileInfo.fileName,
      title: fileInfo.title,
      relativePath: fileInfo.relativePath,
    };
  });
}

export function reconcileScopeFocusSetting({
  scopeFocus,
  scopeKey,
  previousFileList,
  nextFileList,
  previousTree,
  includeNewFiles,
}: {
  scopeFocus: Record<string, string[]> | undefined;
  scopeKey: string;
  previousFileList: readonly MdFile[];
  nextFileList: readonly MdFile[];
  previousTree: FolderNode | null;
  includeNewFiles: boolean;
}): Record<string, string[]> | undefined {
  if (!scopeFocus || !Object.prototype.hasOwnProperty.call(scopeFocus, scopeKey)) {
    return scopeFocus;
  }

  const savedScopePaths = scopeFocus[scopeKey] ?? [];
  const previousFilePaths = previousFileList.map((file) => file.fsPath);
  const nextFilePaths = nextFileList.map((file) => file.fsPath);
  const previousFilePathSet = new Set(previousFilePaths);
  const selectedFolderPaths = collectSelectedFolderPaths(
    previousTree,
    new Set(savedScopePaths.filter((filePath) => previousFilePathSet.has(filePath))),
  );
  const reconciledPaths = reconcileScopeFocusPaths({
    savedScopePaths,
    previousFilePaths: includeNewFiles ? previousFilePaths : nextFilePaths,
    nextFilePaths,
    selectedFolderPaths,
  });

  if (reconciledPaths === null) return scopeFocus;

  const nextScopeFocus = { ...scopeFocus };
  if (nextFilePaths.length > 0 && reconciledPaths.length >= nextFilePaths.length) {
    delete nextScopeFocus[scopeKey];
  } else {
    nextScopeFocus[scopeKey] = reconciledPaths;
  }
  return nextScopeFocus;
}

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
