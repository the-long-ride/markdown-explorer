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
  DEFAULT_KEYBINDINGS,
  getDefaultKeybindings,
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
import {
  collectSelectedFolderPaths,
  reconcileScopeFocusPaths,
} from './scope-focus-reconcile.js';
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
  ContentTab,
  RecentWorkspace,
  AppRuntime,
  HostPlatform,
  WorkspaceUnavailableReason,
  DocumentPreviewInfo,
  UpdateState,
} from '../types';

import { parse } from '../markdown/parser';
import { HtmlRenderer } from '../markdown/renderer';
import { rewriteRelativeMediaUrls } from '../markdown/mediaUrls';

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
  /** TOC panel collapsed */
  tocCollapsed: boolean;
  /** Rendered HTML (from host) */
  contentHtml: string;
  /** Original Markdown/MDX source for exact file copy */
  markdownSource: string | null;
  /** Current frontmatter */
  frontmatter: Frontmatter;
  /** Current TOC entries */
  toc: TocEntry[];
  /** Current relative path (for breadcrumb) */
  relativePath: string;
  /** Is loading content */
  isLoading: boolean;
  /** Loading title from the host, if a specific stage is known */
  loadingLabel: string;
  /** Loading detail from the host, if a specific stage is known */
  loadingDetail: string;
  /** Metadata for converted or imported previews */
  previewInfo: DocumentPreviewInfo | null;
  /** Nav not found href */
  notFoundHref: string | null;
  /** Workspace path that could not be opened */
  workspaceUnavailablePath: string | null;
  /** Why the workspace could not be opened */
  workspaceUnavailableReason: WorkspaceUnavailableReason | null;
  /** User settings */
  settings: AppSettings;
  /** Content render counter (triggers effects) */
  renderVersion: number;
  /** Open content tabs for the current workspace */
  contentTabs: ContentTab[];
  /** Active content tab path */
  activeContentTabPath: string | null;
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
  /** Focus mode active */
  focusMode: boolean;
  /** Desktop self-update state */
  updateState: UpdateState;
  /** Active sidebar tab */
  sidebarActiveTab: 'files' | 'search';
}

function createEmptyUpdateState(): UpdateState {
  return {
    status: 'idle',
    version: '',
    downloadedVersion: '',
    downloadedFileName: '',
    progressPercent: 0,
    error: '',
  };
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
  focusMode: false,
  updateState: createEmptyUpdateState(),
  sidebarActiveTab: 'files',
};

function createInitialState(saved: PersistedState | undefined, isDesktop: boolean): AppState {
  const defaultKeybindings = getDefaultKeybindings(isDesktop);
  const tocCollapsed = typeof localStorage !== 'undefined'
    ? localStorage.getItem('markdown-explorer-toc-collapsed') === 'true'
    : false;
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
      contentTabs?: readonly ContentTab[];
      activeContentTabPath?: string | null;
      recentWorkspaces?: readonly RecentWorkspace[];
      appVersion?: string;
      appRuntime?: AppRuntime;
      hostPlatform?: HostPlatform;
      hostArch?: string;
      documentConversionEnabled?: boolean;
      isMaximized?: boolean;
    }
  | {
      type: 'RECENT_WORKSPACES_CHANGED';
      recentWorkspaces: readonly RecentWorkspace[];
    }
  | { type: 'RENDER_CONTENT'; msg: RenderContentMessage }
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

function normalizePathKey(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase();
}

function getWorkspaceScopeKey(workspacePath: string | undefined, workspaceName: string): string {
  return workspacePath || workspaceName || 'default';
}

function getPathFileName(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath || 'Document';
}

function stripMarkdownExtension(fileName: string): string {
  const extIndex = fileName.lastIndexOf('.');
  return extIndex > 0 ? fileName.slice(0, extIndex) : fileName;
}

function findFileInfo(fileList: readonly MdFile[], filePath: string): MdFile | undefined {
  const target = normalizePathKey(filePath);
  return fileList.find(
    (file) =>
      normalizePathKey(file.fsPath) === target ||
      normalizePathKey(file.relativePath) === target,
  );
}

function upsertContentTab(tabs: readonly ContentTab[], tab: ContentTab): ContentTab[] {
  const existingIndex = tabs.findIndex(
    (item) => normalizePathKey(item.filePath) === normalizePathKey(tab.filePath),
  );
  if (existingIndex === -1) return [...tabs, tab];
  return tabs.map((item, index) => (index === existingIndex ? tab : item));
}

interface RenderedMarkdown {
  html: string;
  frontmatter: Record<string, string>;
  toc: Array<{ level: number; text: string; id: string }>;
}

function renderMarkdownClientSide(
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

function createContentTabFromMessage(
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

function createContentTabFromState(state: AppState): ContentTab | null {
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

function applyContentTab(state: AppState, tab: ContentTab, tabs = state.contentTabs): AppState {
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

function clearContentTabs(state: AppState): AppState {
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

function applyContentTabsFallback(
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

function refreshContentTabMetadata(
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

function reconcileScopeFocusSetting({
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

function reducer(state: AppState, action: Action): AppState {
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
        isMaximized: action.isMaximized ?? state.isMaximized,
        isLoading: workspaceChanged
          ? (action.workspaceName ? state.isLoading : false)
          : false,
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
      try {
        localStorage.setItem('markdown-explorer-toc-collapsed', String(nextCollapsed));
      } catch (e) {
        // ignore
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
    createInitialState(bridge.getState<PersistedState>(), isDesktop),
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
