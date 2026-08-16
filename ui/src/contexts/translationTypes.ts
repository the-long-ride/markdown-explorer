import type { AuditedUiTranslationDomains } from './auditedUiTranslationTypes';

export interface Translations extends AuditedUiTranslationDomains {
  settings: string; subtitle: string; appearance: string;
  colorMode: string; colorModeDesc: string; auto: string; light: string; dark: string;
  themeStyle: string; themeStyleDesc: string; desktopView: string; desktopViewDesc: string;
  typography: string; typographyDesc: string;
  appUiFont: string; bodyFont: string; headingFont: string; quoteFont: string; codeFont: string; mermaidFont: string;
  fontDefault: string; fontDefaultDescription: string; fontSystem: string; fontImported: string;
  fontImport: string; fontRemove: string;
  fontApply: string; fontApplyConfirmTitle: string; fontApplyConfirmBody: string; fontApplyChanges: string;
  fontSearchPlaceholder: string; fontNoResults: string; fontVariant: string;
  fontResetRole: string; fontResetAll: string; fontNormal: string; fontItalic: string;
  focus: string; tabs: string; sidebarLabels: string; sidebarLabelsDesc: string;
  fileTabs: string; fileTabsDesc: string; bookmarksEnabled: string; bookmarksEnabledDesc: string;
  bookmarks: {
    tab: string; searchPlaceholder: string; sortLabel: string;
    sortNameAsc: string; sortNameDesc: string; sortNewest: string; sortOldest: string;
    expandAll: string; collapseAll: string; toggleSelection: string; selectAll: string;
    deleteSelected: string; deleteSelectedTitle: string; deleteSelectedConfirm: string;
    selectBookmark: string; empty: string; noResults: string; menuLabel: string;
    goTo: string; editName: string; delete: string; addSelection: string;
    dialogAddTitle: string; dialogEditTitle: string; nameLabel: string; namePlaceholder: string;
    save: string; cancel: string; targetUnavailable: string; workspaceUnavailable: string; fileUnavailable: string;
    savedSuccess: string; saveFailed: string; renamedSuccess: string; renameFailed: string; storageUnavailable: string;
  };
  maxPinnedItems: string; maxPinnedItemsDesc: string;
  documentConversion: string; documentConversionDesc: string;
  htmlPreview: string; htmlPreviewDesc: string;
  htmlCodeBlockPreview: string; htmlCodeBlockPreviewDesc: string;
  htmlLocalFirstWarningTitle: string; htmlLocalFirstWarningBody: string; htmlLocalFirstWarningOk: string;
  htmlLocalFirstBlockedRemoteStyles: string; htmlLocalFirstBlockedRemoteScripts: string;
  htmlLocalFirstAllowedRemoteImages: string; htmlLocalFirstAllowedRemoteFonts: string; htmlLocalFirstAllowedRemoteMedia: string;
  htmlLocalFirstBlockedNetworkApis: string; htmlLocalFirstBlockedLocalReferences: string; htmlLocalFirstMissingLocalReferences: string;
  resetShortcutsConfirmTitle: string; resetShortcutsConfirmBody: string; cancelResetShortcuts: string; confirmResetShortcuts: string;
  csvPreview: string; csvPreviewDesc: string;
  importJson: string; exportJson: string; importJsonTooltip: string; exportJsonTooltip: string;
  updateBackup: string; updateBackupDesc: string; applicationUpdate: string; checkForUpdate: string;
  settingsBackup: string; settingsBackupDesc: string; latestVersionStatus: string; newerVersionStatus: string;
  updateLater: string; updateSkipVersion: string; updateChecking: string;
  shortcuts: string; shortcutsHint: string; resetShortcuts: string; closeSettings: string;
  openInBrowser: string; showHtmlPreview: string; showMarkdownView: string; openContainingFolder: string;
  sidebarItemActions: string; htmlPreviewEnabled: string; htmlPreviewDisabled: string;
  htmlDocumentPreviewError: string; htmlPreviewExperienceNotice: string;
  themeStyles: {
    themesLabel: string; themesDesc: string; themesMenuLabel: string; chooseTheme: string;
    defaultLabel: string; defaultDesc: string; glassLabel: string; glassDesc: string;
    bentoLabel: string; bentoDesc: string; vercelLabel: string; vercelDesc: string;
    tokyoNightLabel: string; tokyoNightDesc: string; neonVoltageLabel: string; neonVoltageDesc: string;
    rawGridLabel: string; rawGridDesc: string; petsLabel: string; petsDesc: string;
    petsMenuLabel: string; choosePetTheme: string; whiteShibaLabel: string; kInkLabel: string;
    catLabel: string; hamsterLabel: string; corgiLabel: string;
    customThemesLabel: string; customThemesDesc: string; customThemesMenuLabel: string;
    chooseCustomTheme: string; themeRemixLabel: string;
  };
  actions: {
    editCurrentDocument: string; searchCurrent: string; searchAllTabs: string; loadMore: string; findCurrentFile: string;
    back: string; forward: string; welcome: string; settings: string; toggleTheme: string;
    toggleHtmlPreview: string; refresh: string; collapseAll: string; expandAll: string;
    workspaceSelection: string; toggleSidebar: string; openBookmarks: string; toggleToc: string;
    zoomIn: string; zoomOut: string; locateFile: string; toggleDesktopViewMode: string;
    openCurrentDocumentLocation: string; toggleFocusMode: string; toggleFullscreen: string; toggleFullscreenTooltip: string;
  };
  topbar: {
    home: string; welcomePage: string; themeLabel: string; moreActions: string; closeFolder: string;
    goBack: string; goForward: string; refresh: string; searchPlaceholder: string;
    expandAll: string; collapseAll: string; edit: string; editLabel: string; copy: string;
    theme: string; switchToDarkMode: string; switchToLightMode: string; settings: string; settingsUpdate: string; sidebar: string;
  };
  tooltips: {
    switchLanguage: string; minimize: string; maximize: string; restore: string; closeApp: string; close: string;
    removeFromRecents: string; previous: string; next: string; zoomIn: string; zoomOut: string; resetZoom: string;
    scrollToTop: string; newTab: string; closeModal: string; closeTab: string; openChangelog: string; locateFile: string; cancelScan: string;
  };
  previewActions: {
    openInBrowser: string; openAsModal: string; showCode: string; showPreview: string; copyCode: string; plainText: string;
    csvPreviewTitle: string; tsvPreviewTitle: string; csvMalformedQuote: string; csvUnevenRows: string;
    modalTitle: string; closeModal: string; openError: string; linkMenu: string; copyLink: string; copyImage: string;
    saveImagePng: string; imageSaved: string; imageSaveFailed: string;
    linkCopied: string; imageCopied: string; unableToOpenLink: string; copyFailed: string;
  };
  tabContextMenu: {
    menuLabel: string; moveTabLeft: string; moveTabRight: string; closeThisTab: string;
    closeTabsToRight: string; closeOtherTabs: string; closeAllTabs: string;
    showInFileExplorer: string; openInFinder: string; revealInFinder: string; showInFileManager: string;
  };
  documentPreview: {
    convertedTitle: string; textTitle: string; convertedWarning: string; legacyBestEffortWarning: string;
    conversionFailedWarning: string; textWarning: string; preparedLocally: string; loadedCachedConversion: string;
    durationMeta: string; currentFileChangedOnDisk: string; refreshCurrentFile: string; currentFileChangedSuffix: string;
  };
  recentWorkspaces: {
    title: string; subtitle: string; searchPlaceholder: string; noWorkspaces: string; lastOpened: string;
  };
  workspaceUnavailable: {
    title: string; description: string; tabHint: string; openAgain: string; deleteHistory: string; removedHistory: string;
  };
  settingsData: {
    groupLabel: string; imported: string; importFailed: string; invalidJson: string; missingData: string;
    wrongFile: string; unknownSchema: string; exported: string; exportFailed: string;
  };
  search: {
    dialogLabel: string; modalTitleCurrent: string; modalTitleAllTabs: string; queryLabel: string;
    currentWorkspacePlaceholder: string; allWorkspacesPlaceholder: string; indexingPlaceholder: string;
    workspaces: string; allWorkspaces: string; results: string; preview: string; matchCase: string;
    statusOn: string; statusOff: string; searchingContents: string; noMatches: string; openResult: string;
    previewEmptyTitle: string; previewEmptyBody: string; matchPreview: string; fileNameOrPathMatch: string;
    findDialogLabel: string; findPlaceholder: string; findInputLabel: string; previousMatch: string; nextMatch: string;
    closeFind: string; sidebarPlaceholder: string; sidebarInputLabel: string; minimumCharacters: string;
    searchingWorkspace: string; includeWorkspace: string; excludeWorkspace: string; checkAllWorkspaces: string;
    uncheckAllWorkspaces: string; resizeWorkspaces: string; resizePreview: string; loadingPreview: string; previewUnavailable: string;
  };
  sidebar: {
    files: string; search: string; filterPlaceholder: string; filterAriaLabel: string;
    scopeFocus: string; clearScopeFocus: string; checkAll: string; uncheckAll: string;
    collapseAllFolders: string; expandAllFolders: string; clearPinnedItems: string; sortFiles: string;
    sortNameAsc: string; sortNameDesc: string; sortModifiedDesc: string; sortModifiedAsc: string;
    pinThisFile: string; pinThisFolder: string; unpinItem: string; pinned: string; noScopeFiles: string; noFiles: string;
  };
  toc: {
    onThisPage: string; returnToTop: string; sections: string;
  };
  update: {
    availableTitle: string; availableDescription: string; viewChangelog: string; downloadButton: string;
    downloading: string; applying: string; scheduled: string; updateOnExit: string; restartAndUpdate: string;
    restartPromptTitle: string; restartPromptBody: string; downloadFailed: string; installFailed: string; stagedMissing: string;
  };
  bannedShortcutTitle: string;
  bannedShortcutDismiss: string;
  bannedShortcutImeMessage: string;
}
