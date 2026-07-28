// =============================================================================
// contexts/translations.ts — UI Translations for Supported Languages
// =============================================================================

export interface Translations {
  settings: string;
  subtitle: string;
  appearance: string;
  colorMode: string;
  colorModeDesc: string;
  auto: string;
  light: string;
  dark: string;
  themeStyle: string;
  themeStyleDesc: string;
  viewPrefs: string;
  desktopView: string;
  desktopViewDesc: string;
  focus: string;
  tabs: string;
  sidebarLabels: string;
  sidebarLabelsDesc: string;
  fileTabs: string;
  fileTabsDesc: string;
  documentConversion: string;
  documentConversionDesc: string;
  htmlPreview: string;
  htmlPreviewDesc: string;
  htmlCodeBlockPreview: string;
  htmlCodeBlockPreviewDesc: string;
  htmlLocalFirstWarningTitle: string;
  htmlLocalFirstWarningBody: string;
  htmlLocalFirstWarningOk: string;
  htmlLocalFirstBlockedRemoteStyles: string;
  htmlLocalFirstBlockedRemoteScripts: string;
  htmlLocalFirstAllowedRemoteImages: string;
  htmlLocalFirstAllowedRemoteFonts: string;
  htmlLocalFirstAllowedRemoteMedia: string;
  htmlLocalFirstBlockedNetworkApis: string;
  htmlLocalFirstBlockedLocalReferences: string;
  htmlLocalFirstMissingLocalReferences: string;
  resetShortcutsConfirmTitle: string;
  resetShortcutsConfirmBody: string;
  cancelResetShortcuts: string;
  confirmResetShortcuts: string;
  csvPreview: string;
  csvPreviewDesc: string;
  importJson: string;
  exportJson: string;
  importJsonTooltip: string;
  exportJsonTooltip: string;
  shortcuts: string;
  shortcutsHint: string;
  resetShortcuts: string;
  closeSettings: string;
  openInBrowser: string;
  showHtmlPreview: string;
  showMarkdownView: string;
  openContainingFolder: string;
  sidebarItemActions: string;
  htmlPreviewEnabled: string;
  htmlPreviewDisabled: string;
  htmlDocumentPreviewError: string;
  htmlPreviewExperienceNotice: string;
  themeStyles: {
    themesLabel: string;
    themesDesc: string;
    themesMenuLabel: string;
    chooseTheme: string;
    defaultLabel: string;
    defaultDesc: string;
    glassLabel: string;
    glassDesc: string;
    bentoLabel: string;
    bentoDesc: string;
    vercelLabel: string;
    vercelDesc: string;
    tokyoNightLabel: string;
    tokyoNightDesc: string;
    neonVoltageLabel: string;
    neonVoltageDesc: string;
    rawGridLabel: string;
    rawGridDesc: string;
    petsLabel: string;
    petsDesc: string;
    petsMenuLabel: string;
    choosePetTheme: string;
    whiteShibaLabel: string;
    kInkLabel: string;
    catLabel: string;
    hamsterLabel: string;
    corgiLabel: string;
    customThemesLabel: string;
    customThemesDesc: string;
    customThemesMenuLabel: string;
    chooseCustomTheme: string;
    themeRemixLabel: string;
  };
  actions: {
    searchCurrent: string;
    searchAllTabs: string;
    loadMore: string;
    findCurrentFile: string;
    back: string;
    forward: string;
    welcome: string;
    settings: string;
    toggleTheme: string;
    toggleHtmlPreview: string;
    refresh: string;
    collapseAll: string;
    expandAll: string;
    workspaceSelection: string;
    toggleSidebar: string;
    toggleToc: string;
    zoomIn: string;
    zoomOut: string;
    locateFile: string;
    toggleDesktopViewMode: string;
    openCurrentDocumentLocation: string;
    toggleFocusMode?: string;
    toggleFullscreen: string;
    toggleFullscreenTooltip: string;
  };
  topbar: {
    home: string;
    welcomePage: string;
    themeLabel: string;
    moreActions: string;
    closeFolder: string;
    goBack: string;
    goForward: string;
    refresh: string;
    searchPlaceholder: string;
    expandAll: string;
    collapseAll: string;
    edit: string;
    editLabel: string;
    copy: string;
    theme: string;
    switchToDarkMode: string;
    switchToLightMode: string;
    settings: string;
    settingsUpdate: string;
    sidebar: string;
  };
  tooltips: {
    switchLanguage: string;
    minimize: string;
    maximize: string;
    restore: string;
    closeApp: string;
    close: string;
    removeFromRecents: string;
    previous: string;
    next: string;
    zoomIn: string;
    zoomOut: string;
    resetZoom: string;
    scrollToTop: string;
    newTab: string;
    showToolbar: string;
    minimizeToolbar: string;
    moveToolbar: string;
    closeModal: string;
    closeTab: string;
    openChangelog: string;
    locateFile: string;
    cancelScan: string;
  };
  previewActions: {
    openInBrowser: string;
    openAsModal: string;
    showCode: string;
    showPreview: string;
    copyCode: string;
    plainText: string;
    csvPreviewTitle: string;
    tsvPreviewTitle: string;
    csvMalformedQuote: string;
    csvUnevenRows: string;
    modalTitle: string;
    closeModal: string;
    openError: string;
    linkMenu: string;
    copyLink: string;
    linkCopied: string;
    unableToOpenLink: string;
    copyFailed: string;
  };
  tabContextMenu: {
    menuLabel: string;
    moveTabLeft: string;
    moveTabRight: string;
    closeThisTab: string;
    closeTabsToRight: string;
    closeOtherTabs: string;
    closeAllTabs: string;
    showInFileExplorer: string;
    openInFinder: string;
    revealInFinder: string;
    showInFileManager: string;
  };
  documentPreview: {
    convertedTitle: string;
    textTitle: string;
    convertedWarning: string;
    legacyBestEffortWarning: string;
    conversionFailedWarning: string;
    textWarning: string;
    preparedLocally: string;
    loadedCachedConversion: string;
    durationMeta: string;
    currentFileChangedOnDisk: string;
    refreshCurrentFile: string;
    currentFileChangedSuffix: string;
  };
  recentWorkspaces: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    noWorkspaces: string;
    lastOpened: string;
  };
  workspaceUnavailable: {
    title: string;
    description: string;
    tabHint: string;
    openAgain: string;
    deleteHistory: string;
    removedHistory: string;
  };
  settingsData: {
    groupLabel: string;
    imported: string;
    importFailed: string;
    invalidJson: string;
    missingData: string;
    wrongFile: string;
    unknownSchema: string;
    exported: string;
    exportFailed: string;
  };
  sidebar: {
    files: string;
    search: string;
    filterPlaceholder: string;
    filterAriaLabel: string;
    scopeFocus: string;
    clearScopeFocus: string;
    checkAll: string;
    uncheckAll: string;
    noScopeFiles: string;
    noFiles: string;
  };
  toc: {
    onThisPage: string;
    returnToTop: string;
    sections: string;
  };
  update: {
    availableTitle: string;
    availableDescription: string;
    viewChangelog: string;
    downloadButton: string;
    downloading: string;
    applying: string;
    scheduled: string;
    updateOnExit: string;
    restartAndUpdate: string;
    restartPromptTitle: string;
    restartPromptBody: string;
    downloadFailed: string;
    installFailed: string;
    stagedMissing: string;
  };
  bannedShortcutTitle: string;
  bannedShortcutDismiss: string;
  bannedShortcutImeMessage: string;
}


export const LANGUAGE_OPTIONS = [
  { id: "en", label: "English" },
  { id: "vi", label: "Tiếng Việt" },
  { id: "fr", label: "Français" },
  { id: "es", label: "Español" },
  { id: "zh", label: "中文" },
  { id: "no", label: "Norsk" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "ru", label: "Русский" },
] as const;

export type AppLanguage = (typeof LANGUAGE_OPTIONS)[number]["id"];


// ── Inline English translations for instant first-render availability ────
// Full multi-language translations are lazy-loaded from translationsData.ts
// after the initial render to keep the critical startup bundle lean.

let _TRANSLATIONS: Record<string, Translations> = {
  en: {
    settings: "Settings",
    subtitle: "Customize your Markdown Explorer experience",
    appearance: "Appearance",
    colorMode: "Color Mode",
    colorModeDesc: "Choose automatic, light, or dark rendering.",
    auto: "Auto",
    light: "Light",
    dark: "Dark",
    themeStyle: "Theme Style",
    themeStyleDesc: "Pick the surface language for panels, spacing, and strokes.",
    viewPrefs: "View Preferences",
    desktopView: "Desktop View",
    desktopViewDesc: "Switch between Focus and workspace Tabs. Toggle anytime with {shortcut}.",
    focus: "Focus",
    tabs: "Tabs",
    sidebarLabels: "Sidebar File Labels",
    sidebarLabelsDesc: "Show document titles/H1 headers instead of raw filenames in the sidebar tree.",
    fileTabs: "Open Files in Tabs",
    fileTabsDesc: "When enabled, opening a file creates or activates a document tab. When disabled, it replaces the current panel.",
    documentConversion: "Read DOCX, PDF, Office, and text files",
    documentConversionDesc: "Converts DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, and RTF to Markdown for preview. Converted previews can lose layout or formatting quality.",
    htmlPreview: "Default HTML Preview",
    htmlPreviewDesc: "Open .html and .htm documents as interactive previews by default. Toggle the active HTML document with ({shortcut}).",
    htmlCodeBlockPreview: "Default HTML Code Block Preview",
    htmlCodeBlockPreviewDesc: "Open fenced HTML code blocks as interactive previews by default.",
    htmlLocalFirstWarningTitle: "Local-first HTML preview",
    htmlLocalFirstWarningBody: "Markdown Explorer prepared this HTML document using local-first rules. Remote CSS and scripts, script-initiated network requests, and unsafe local references were ignored; allowed remote media may still load.",
    htmlLocalFirstWarningOk: "OK",
    htmlLocalFirstBlockedRemoteStyles: "Blocked remote stylesheets",
    htmlLocalFirstBlockedRemoteScripts: "Blocked remote scripts",
    htmlLocalFirstAllowedRemoteImages: "Allowed remote images",
    htmlLocalFirstAllowedRemoteFonts: "Allowed remote fonts",
    htmlLocalFirstAllowedRemoteMedia: "Allowed remote audio or video",
    htmlLocalFirstBlockedNetworkApis: "Blocked script network APIs",
    htmlLocalFirstBlockedLocalReferences: "Blocked local references outside the workspace",
    htmlLocalFirstMissingLocalReferences: "Missing or unreadable local references",
    resetShortcutsConfirmTitle: "Reset keyboard shortcuts?",
    resetShortcutsConfirmBody: "Every customized and disabled shortcut will be restored to its default value.",
    cancelResetShortcuts: "Cancel",
    confirmResetShortcuts: "Reset Shortcuts",
    csvPreview: "Default CSV Code Block View",
    csvPreviewDesc: "Show CSV and TSV code blocks as interactive data tables by default. Otherwise, show the source code.",
    importJson: "Import JSON",
    exportJson: "Export JSON",
    importJsonTooltip: "Import all user settings from JSON",
    exportJsonTooltip: "Export all user settings to JSON",
    shortcuts: "Keyboard Shortcuts",
    shortcutsHint: "Click a field and press your new keys.",
    resetShortcuts: "Reset to Default Shortcuts",
    closeSettings: "Close Settings - (Esc)",
    openInBrowser: "Open in Browser",
    showHtmlPreview: "Show HTML Preview",
    showMarkdownView: "Show Markdown View",
    openContainingFolder: "Open containing folder",
    sidebarItemActions: "Actions for {name}",
    htmlPreviewEnabled: "HTML Preview shown",
    htmlPreviewDisabled: "Markdown View shown",
    htmlDocumentPreviewError: "Unable to render this HTML document preview.",
    htmlPreviewExperienceNotice: "HTML Preview may not match the full browser experience. For the best result, right-click the document tab or use the file’s three-dot menu in Files, then choose Open in Browser.",
    themeStyles: {
      themesLabel: "Themes",
      themesDesc: "Built-in visual systems for the whole workspace",
      themesMenuLabel: "Built-in themes",
      chooseTheme: "Choose theme",
      defaultLabel: "Default",
      defaultDesc: "Compact reader surfaces with the original Markdown Explorer balance",
      glassLabel: "Aurora Glass",
      glassDesc: "Translucent panels, soft blur, and layered pastel light",
      bentoLabel: "Bento Grids",
      bentoDesc: "Modular blocks, stronger structure, and denser scan-friendly spacing",
      vercelLabel: "Vercel",
      vercelDesc: "High-contrast monochrome, sharp borders, and geometric focus",
      tokyoNightLabel: "Tokyo Night",
      tokyoNightDesc: "Synthwave cyber aesthetic with vibrant neon highlights and deep night contrast",
      neonVoltageLabel: "Neon Voltage",
      neonVoltageDesc: "Deep black surfaces with electric coral, teal, and purple glow",
      rawGridLabel: "Raw Grid",
      rawGridDesc: "Visible structure, asymmetric panels, and mechanical borders",
      petsLabel: "Pet themes",
      petsDesc: "Anime PNG companions and playful reading surfaces",
      petsMenuLabel: "Pet themes",
      choosePetTheme: "Choose pet theme",
      whiteShibaLabel: "White Shiba",
      kInkLabel: "K-Ink (app author's dog)",
      catLabel: "Cat",
      hamsterLabel: "Hamster",
      corgiLabel: "Corgi",
      customThemesLabel: "Your custom themes",
      customThemesDesc: "Saved remixes and personal visual systems",
      customThemesMenuLabel: "Custom themes",
      chooseCustomTheme: "Choose custom theme",
      themeRemixLabel: "Theme Remix",
    },
    actions: {
      searchCurrent: "Search current workspace",
      searchAllTabs: "Search all tabs",
      loadMore: "Load more",
      findCurrentFile: "Find in current file",
      back: "Back to previous file",
      forward: "Go to next file",
      welcome: "Go to welcome page",
      settings: "Toggle settings modal",
      toggleTheme: "Toggle light/dark mode",
      toggleHtmlPreview: "Toggle active HTML document view",
      refresh: "Refresh current file",
      collapseAll: "Collapse all headings",
      expandAll: "Expand all headings",
      workspaceSelection: "Go to workspace selection",
      toggleSidebar: "Toggle sidebar visibility",
      toggleToc: "Toggle TOC",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      locateFile: "Locate current file",
      toggleDesktopViewMode: "Toggle Tabs/Focus view",
      openCurrentDocumentLocation: "Open current document folder",
      toggleFocusMode: "Toggle focus mode",
      toggleFullscreen: "Show full screen",
      toggleFullscreenTooltip: "Toggle native full screen window",
    },
    topbar: {
      home: "Home",
      welcomePage: "Welcome Page",
      themeLabel: "Theme",
      moreActions: "More actions",
      closeFolder: "Close Folder (Return to Workspace Selector)",
      goBack: "Go Back",
      goForward: "Go Forward",
      refresh: "Refresh",
      searchPlaceholder: "Search docs...",
      expandAll: "Expand All",
      collapseAll: "Collapse",
      edit: "Open current file in editor",
      editLabel: "Edit",
      copy: "Copy file content",
      theme: "Toggle light/dark mode",
      switchToDarkMode: "Switch to Dark mode",
      switchToLightMode: "Switch to Light mode",
      settings: "Settings",
      settingsUpdate: "Settings - update available",
      sidebar: "Toggle Sidebar",
    },
    tooltips: {
      switchLanguage: "Switch Language",
      minimize: "Minimize",
      maximize: "Maximize",
      restore: "Restore",
      closeApp: "Close App",
      close: "Close",
      removeFromRecents: "Remove from recents",
      previous: "Previous",
      next: "Next",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      resetZoom: "Reset Zoom",
      scrollToTop: "Scroll to Top",
      newTab: "New workspace tab",
      showToolbar: "Show toolbar actions",
      minimizeToolbar: "Minimize toolbar actions",
      moveToolbar: "Move toolbar",
      closeModal: "Close modal (Esc)",
      closeTab: "Close Tab",
      openChangelog: "Click to open the change logs",
      locateFile: "Locate file",
      cancelScan: "Cancel scan",
    },
    previewActions: {
      openInBrowser: "Open in browser",
      openAsModal: "Open as modal",
      showCode: "Show code",
      showPreview: "Show preview",
      copyCode: "Copy code",
      plainText: "Plain text",
      csvPreviewTitle: "CSV Preview",
      tsvPreviewTitle: "TSV Preview",
      csvMalformedQuote: "Some quoted fields are malformed. Review the source code.",
      csvUnevenRows: "Some rows have a different number of columns.",
      modalTitle: "HTML preview",
      closeModal: "Close HTML preview",
      openError: "Unable to open HTML preview",
      linkMenu: "Link actions",
      copyLink: "Copy link",
      linkCopied: "Link copied",
      unableToOpenLink: "Unable to open link",
      copyFailed: "Unable to copy link",
    },
    tabContextMenu: {
      menuLabel: "Document tab actions",
      moveTabLeft: "Move tab left",
      moveTabRight: "Move tab right",
      closeThisTab: "Close this tab",
      closeTabsToRight: "Close tabs to the right",
      closeOtherTabs: "Close other tabs",
      closeAllTabs: "Close all tabs",
      showInFileExplorer: "Show in File Explorer",
      openInFinder: "Open in Finder",
      revealInFinder: "Reveal in Finder",
      showInFileManager: "Show in File Manager",
    },
    documentPreview: {
      convertedTitle: "Converted {sourceLabel} preview",
      textTitle: "{sourceLabel} preview",
      convertedWarning: "This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file.",
      legacyBestEffortWarning: "This legacy document uses best-effort conversion. Some content, formatting, formulas, or embedded objects may be missing.",
      conversionFailedWarning: "Markdown Explorer could not convert this file. The details are shown below.",
      textWarning: "Plain text is rendered through Markdown Explorer, so Markdown-like syntax may be formatted.",
      preparedLocally: "Prepared locally",
      loadedCachedConversion: "Loaded cached conversion",
      durationMeta: "{status} in {duration}",
      currentFileChangedOnDisk: "Current file has been changed. Click",
      refreshCurrentFile: "Refresh",
      currentFileChangedSuffix: "button to see new changes.",
    },
    recentWorkspaces: {
      title: "Recent Workspaces",
      subtitle: "Search and manage your recently opened workspaces",
      searchPlaceholder: "Search workspaces by name or path...",
      noWorkspaces: "No matching workspaces found",
      lastOpened: "Last opened",
    },
    workspaceUnavailable: {
      title: "Workspace not found",
      description: "The current path no longer exists or is locked. Please open the workspace again.",
      tabHint: "Tab view: choose a replacement folder to reuse this tab.",
      openAgain: "Open Workspace Again",
      deleteHistory: "Delete from History",
      removedHistory: "Removed from History",
    },
    settingsData: {
      groupLabel: "Settings data",
      imported: "Imported settings and workspace history.",
      importFailed: "Import failed.",
      invalidJson: "The selected file is not valid JSON.",
      missingData: "The selected file does not contain settings data.",
      wrongFile: "This is not a Markdown Explorer settings file.",
      unknownSchema: "This settings file uses an unknown schema version.",
      exported: "Settings exported.",
      exportFailed: "Export failed.",
    },
    sidebar: {
      files: "Files",
      search: "Search",
      filterPlaceholder: "Filter files…",
      filterAriaLabel: "Filter file list",
      scopeFocus: "Scope Focus",
      clearScopeFocus: "Clear focusing scope",
      checkAll: "Check all",
      uncheckAll: "Uncheck all",
      noScopeFiles: "No files selected for this scope",
      noFiles: "No matching files",
    },
    toc: {
      onThisPage: "On This Page",
      returnToTop: "Return to top",
      sections: "Sections",
    },
    update: {
      availableTitle: "New version {version} available",
      availableDescription: "Current version {version}. Release notes:",
      viewChangelog: "see changelog on GitHub",
      downloadButton: "Download new version",
      downloading: "Downloading update... {progress}%",
      applying: "Applying update...",
      scheduled: "Update will be installed when you close the app.",
      updateOnExit: "Update when I close",
      restartAndUpdate: "Restart now",
      restartPromptTitle: "Install downloaded update",
      restartPromptBody: "Version {version} is ready. Choose whether to install it now or when you close the app.",
      downloadFailed: "Unable to download update.",
      installFailed: "Unable to install update.",
      stagedMissing: "The downloaded update is no longer available.",
    },
    bannedShortcutTitle: "Banned Shortcut",
    bannedShortcutDismiss: "Dismiss",
    bannedShortcutImeMessage: "Ctrl+Space triggers the IME (Input Method Editor) in Chromium and cannot be used as an app shortcut.",
  },
};

// Lazy-load full translations (non-blocking).
import("./translationsData").then(m => {
  _TRANSLATIONS = m.TRANSLATIONS;
}).catch(() => {
  // Keep English-only fallback silently.
});

export function getTranslations(langCode: string): Translations {
  const code = (langCode || "en").toLowerCase() as AppLanguage;
  return _TRANSLATIONS[code] || _TRANSLATIONS["en"];
}



