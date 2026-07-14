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
  shortcuts: string;
  shortcutsHint: string;
  resetShortcuts: string;
  closeSettings: string;
  themeStyles: {
    defaultLabel: string;
    defaultDesc: string;
    glassLabel: string;
    glassDesc: string;
    bentoLabel: string;
    bentoDesc: string;
    vercelLabel: string;
    vercelDesc: string;
    petsLabel: string;
    petsDesc: string;
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
    refresh: string;
    collapseAll: string;
    expandAll: string;
    workspaceSelection: string;
    toggleSidebar: string;
    toggleToc: string;
    zoomIn: string;
    zoomOut: string;
    locateFile: string;
    toggleFocusMode?: string;
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
  };
  tabContextMenu: {
    closeThisTab: string;
    closeTabsToRight: string;
    closeOtherTabs: string;
    closeAllTabs: string;
  };
  documentPreview: {
    convertedTitle: string;
    textTitle: string;
    convertedWarning: string;
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
    subtitle: "Customize your Markdown Explorer view preferences",
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
    desktopViewDesc: "Focus keeps the current single-workspace layout. Tabs lets each workspace live in its own tab.",
    focus: "Focus",
    tabs: "Tabs",
    sidebarLabels: "Sidebar File Labels",
    sidebarLabelsDesc: "Show document titles/H1 headers instead of raw filenames in the sidebar tree.",
    fileTabs: "Open Files in Tabs",
    fileTabsDesc: "When enabled, opening a file creates or activates a document tab. When disabled, it replaces the current panel.",
    documentConversion: "Read DOCX, PDF, Office, and text files",
    documentConversionDesc: "Converts DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, and RTF to Markdown for preview. Converted previews can lose layout or formatting quality.",
    htmlPreview: "Default HTML Code Block View",
    htmlPreviewDesc: "Show HTML code blocks as interactive previews by default. Otherwise, shows the raw HTML code.",
    shortcuts: "Keyboard Shortcuts",
    shortcutsHint: "Click a field and press your new keys.",
    resetShortcuts: "Reset to Default Shortcuts",
    closeSettings: "Close Settings [Esc]",
    themeStyles: {
      defaultLabel: "Default",
      defaultDesc: "Compact reader surfaces with the original Markdown Explorer balance",
      glassLabel: "Evolved Glass",
      glassDesc: "Layered translucent panels, softer strokes, and airy document rhythm",
      bentoLabel: "Bento Grids",
      bentoDesc: "Modular blocks, stronger structure, and denser scan-friendly spacing",
      vercelLabel: "Vercel",
      vercelDesc: "High-contrast monochrome, sharp borders, and geometric focus",
      petsLabel: "Pets",
      petsDesc: "Anime PNG pet companions, playful background buddies, and soft animated reading surfaces",
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
      refresh: "Refresh current file",
      collapseAll: "Collapse all headings",
      expandAll: "Expand all headings",
      workspaceSelection: "Go to workspace selection",
      toggleSidebar: "Toggle sidebar visibility",
      toggleToc: "Toggle TOC",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      locateFile: "Locate current file",
      toggleFocusMode: "Toggle focus mode",
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
      closeModal: "Close modal [Esc]",
      closeTab: "Close Tab",
      openChangelog: "Click to open the change logs",
      locateFile: "Locate file",
    },
    tabContextMenu: {
      closeThisTab: "Close this tab",
      closeTabsToRight: "Close tabs to the right",
      closeOtherTabs: "Close other tabs",
      closeAllTabs: "Close all tabs",
    },
    documentPreview: {
      convertedTitle: "Converted {sourceLabel} preview",
      textTitle: "{sourceLabel} preview",
      convertedWarning: "This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file.",
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
      updateOnExit: "Update on Exit",
      restartAndUpdate: "Restart and Update",
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



