/** Typed translation domains covered by the renderer-wide localization audit. */
export interface AuditedUiTranslationDomains {
  ui: {
    languages: string; settingsSections: string; updateAvailable: string;
    resizeSidebar: string; resizeToc: string; workspaceTabs: string; closeTab: string; tableOfContents: string;
    documentProperties: string; properties: string; propertySingular: string; propertyPlural: string; anotherTip: string;
    scanningFiles: string; loadingDocs: string; dropOpenTitle: string; dropOpenSupported: string;
    fileNotFound: string; noSupportedDocuments: string; noMarkdownDocuments: string; addSupportedDocuments: string; addMarkdownDocuments: string;
    enableDocumentConversion: string; preparingHtmlPreview: string; closeWarning: string; warningMascotAlt: string;
    shortcutSearchPlaceholder: string; shortcutSearchLabel: string; shortcutSearchClear: string; shortcutDisable: string; shortcutEnable: string;
    shortcutRecordPlaceholder: string; shortcutPressKeys: string; shortcutAlreadyAssigned: string; renameWorkspace: string; tabActions: string;
    sidebarCursorDetails: string; sidebarCursorMode: string; sidebarCursorUse: string; sidebarCursorToMove: string; sidebarCursorToExpandOpen: string; sidebarCursorToLeave: string; markdownThemLinkLabel: string;
    fileNavigation: string; fileNavigationCursorMode: string;
  };
  terms: {
    logoAlt: string; welcomeTitle: string; introBefore: string; privacyPolicy: string; conjunction: string; termsOfService: string; introAfter: string; agreement: string; continue: string;
  };
  onboarding: { title: string; description: string; skip: string; };
  workspaceSelection: {
    subtitle: string; openFolder: string; openFile: string; dragFileTip: string; dragFolderOrFileTip: string; workspaces: string; renameTip: string; showMore: string;
    browserConfigTitle: string; browserConfigIntro: string; browserConfigOpen: string; browserConfigOr: string; browserConfigSearch: string; browserConfigEnable: string;
    macosInstallTitle: string; macosInstallBody: string; confirmTitle: string; confirmBody: string; cancel: string; confirm: string;
  };
  themeRemix: {
    close: string; title: string; description: string; newTheme: string; duplicate: string; delete: string; name: string; baseLayout: string; colorMode: string; applyTheme: string;
    layout: string; density: string; radius: string; stroke: string; contentPadding: string; sectionGap: string; background: string; chooseImage: string; removeImage: string;
    imageOpacity: string; imageFit: string; blur: string; colors: string; colorSchemes: string; unlockPrompt: string; compact: string; comfortable: string; spacious: string; cover: string; contain: string;
    customThemeLimit: string; createdTheme: string; duplicatedTheme: string; deletedTheme: string; appliedTheme: string; chooseImageFile: string; backgroundImageAdded: string; imageTooLarge: string;
    remixName: string; copySuffix: string; backgroundPreview: string; colorAccent: string; colorAccentText: string; colorBg: string; colorSurface: string; colorElevated: string; colorHover: string;
    colorActive: string; colorCode: string; colorText: string; colorTextMuted: string; colorTextSoft: string; colorTextSubtle: string; colorBorder: string; colorBorderStrong: string; colorSuccess: string; colorDanger: string;
    colorChart1: string; colorChart2: string; colorChart3: string; colorChart4: string;
  };
  rendererUi: {
    copy: string; copySectionContent: string; copied: string; showMore: string; showLess: string;
    filterByValues: string; searchTable: string; filterRows: string; wrapTableText: string; unwrapTableText: string; wrap: string; unwrap: string;
    filterValues: string; all: string; noValues: string; rowsCount: string; filteredRowsCount: string;
    table: string; barChart: string; lineChart: string; pieChart: string; tableViewType: string; noDataForChart: string; series: string;
    video: string; openVideo: string; youtubeVideo: string; watchOnYouTube: string;
  };
}
