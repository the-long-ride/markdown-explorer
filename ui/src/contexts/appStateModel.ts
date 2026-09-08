import { TOC_COLLAPSED_STORAGE_KEY } from '../constants/storage';
import {
  normalizeActiveCustomThemeId,
  normalizeCustomThemes,
} from '../theme/customThemes';
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
  ThemeMode,
  ThemeStyle,
  TocEntry,
  UpdateState,
  WorkspaceUnavailableReason,
  DocumentPreviewInfo,
  RenderContentMessage,
} from '../types';
import type { EditableDocumentSession } from '../editor/documentSession';
import type { GitCapability } from '../history/contracts';
import { createSplitViewState, type SplitViewState } from '../split-view/paneState';

import { normalizeMaxPinnedItems } from '../components/Sidebar/sidebarWorkspacePreferences';
import { migrateDesktopFontBindings, type DesktopFontFamily } from '../desktop/fonts/fontModel';
export interface NavigateOptions {
  htmlPreviewOverride?: boolean;
}

export interface PendingHtmlPreviewNavigation {
  filePath: string;
  enabled: boolean;
}

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
  sourceDocumentText: string | null;
  currentHtmlPreviewOverride?: boolean;
  frontmatter: Frontmatter;
  toc: TocEntry[];
  relativePath: string;
  isLoading: boolean;
  loadingLabel: string;
  loadingDetail: string;
  isWorkspaceScanning: boolean;
  scannedFiles: number;
  previewInfo: DocumentPreviewInfo | null;
  staleContentFilePath: string | null;
  notFoundHref: string | null;
  workspaceUnavailablePath: string | null;
  workspaceUnavailableReason: WorkspaceUnavailableReason | null;
  settings: AppSettings;
  desktopFonts: DesktopFontFamily[];
  desktopFontError: string | null;
  desktopFontsResult: { requestId: string; importedId?: string } | null;
  renderVersion: number;
  contentTabs: ContentTab[];
  activeContentTabPath: string | null;
  documentSessions: Record<string, EditableDocumentSession>;
  splitView: SplitViewState;
  gitCapability: GitCapability | null;
  recentWorkspaces: RecentWorkspace[];
  isMaximized: boolean;
  appVersion: string;
  appRuntime: AppRuntime;
  hostPlatform: HostPlatform;
  hostArch: string;
  canInstallUpdates: boolean;
  focusMode: boolean;
  updateState: UpdateState;
  sidebarActiveTab: 'files' | 'search' | 'bookmarks';
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
  | { type: 'RENDER_CONTENT'; msg: RenderContentMessage; htmlPreviewOverride?: boolean }
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
  | { type: 'RESTORE_CONTENT_TABS'; filePaths: string[] }
  | { type: 'REORDER_CONTENT_TABS'; sourcePath: string; targetPath: string }
  | { type: 'CLOSE_CONTENT_TAB'; filePath: string }
  | { type: 'CLOSE_CONTENT_TABS_TO_RIGHT'; filePath: string }
  | { type: 'CLOSE_OTHER_CONTENT_TABS'; filePath: string }
  | { type: 'CLOSE_ALL_CONTENT_TABS' }
  | { type: 'SET_CONTENT_TAB_HTML_PREVIEW'; filePath: string; enabled: boolean | undefined }
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
  | { type: 'WORKSPACE_SCAN_PROGRESS'; scannedFiles: number; active: boolean }
  | { type: 'SET_UPDATE_STATE'; updateState: UpdateState }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_TOC' }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'SET_THEME_STYLE'; themeStyle: ThemeStyle }
  | { type: 'SELECT_CUSTOM_THEME'; themeId: string | undefined }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'SET_DESKTOP_FONTS'; fonts: readonly DesktopFontFamily[]; requestId: string; importedId?: string; error?: string }
  | { type: 'SET_MAXIMIZED'; isMaximized: boolean }
  | { type: 'TOGGLE_FOCUS_MODE' }
  | { type: 'SET_SIDEBAR_ACTIVE_TAB'; tab: 'files' | 'search' | 'bookmarks' }
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
  sourceDocumentText: null,
  currentHtmlPreviewOverride: undefined,
  frontmatter: {},
  toc: [],
  relativePath: '',
  isLoading: true,
  loadingLabel: '',
  loadingDetail: '',
  isWorkspaceScanning: false,
  scannedFiles: 0,
  previewInfo: null,
  staleContentFilePath: null,
  notFoundHref: null,
  workspaceUnavailablePath: null,
  workspaceUnavailableReason: null,
  settings: {
    showTitle: false,
    defaultHtmlPreview: true,
    defaultHtmlCodeBlockPreview: true,
    defaultCsvPreview: true,
    fileTabs: false,
    bookmarksEnabled: false,
    insightsEnabled: false,
    documentConversion: false,
    scopeFocus: {},
    searchScopeFocus: {},
    sidebarPinnedItems: {},
    sidebarSortModes: {},
    maxPinnedItems: 10,
    desktopViewMode: 'focus',
    fontBindings: migrateDesktopFontBindings(undefined),
    keybindings: DEFAULT_KEYBINDINGS,
    disabledKeybindings: {},
    language: 'en',
    customThemes: [],
  },
  desktopFonts: [],
  desktopFontError: null,
  desktopFontsResult: null,
  renderVersion: 0,
  contentTabs: [],
  activeContentTabPath: null,
  documentSessions: {},
  splitView: createSplitViewState(),
  gitCapability: null,
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
    ? storage.getItem(TOC_COLLAPSED_STORAGE_KEY) === 'true'
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
        disabledKeybindings: {},
        searchScopeFocus: {},
        sidebarPinnedItems: {},
        sidebarSortModes: {},
        maxPinnedItems: 10,
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
      defaultHtmlCodeBlockPreview: saved.defaultHtmlCodeBlockPreview ?? saved.defaultHtmlPreview !== false,
      defaultCsvPreview: saved.defaultCsvPreview !== false,
      fileTabs: saved.fileTabs === true,
      bookmarksEnabled: saved.bookmarksEnabled === true,
      insightsEnabled: saved.insightsEnabled === true,
      documentConversion: saved.documentConversion === true,
      scopeFocus: saved.scopeFocus ?? {},
      searchScopeFocus: saved.searchScopeFocus ?? {},
      sidebarPinnedItems: saved.sidebarPinnedItems ?? {},
      sidebarSortModes: saved.sidebarSortModes ?? {},
      maxPinnedItems: normalizeMaxPinnedItems(saved.maxPinnedItems),
      desktopViewMode: normalizeDesktopViewMode(saved.desktopViewMode),
      fontBindings: migrateDesktopFontBindings(saved.fontBindings, saved.appFont, saved.codeFont),
      keybindings: normalizeKeybindings(saved.keybindings, isDesktop),
      disabledKeybindings: saved.disabledKeybindings ?? {},
      language: saved.language || 'en',
      customThemes,
      activeCustomThemeId: normalizeActiveCustomThemeId(saved.activeCustomThemeId, customThemes),
    },
  };
}

export function normalizePathKey(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase();
}
