---
schema_version: 1
id: "feature.workspace-tabs-and-settings"
title: "Workspace Selection, Desktop Tabs, Settings, and Themes"
kind: "feature"
status: "verified"
summary: "Recent workspace switching, multi-tab desktop session state, settings modal and persistence, theme/accent presets, and embedded mini-games."
tags: ["workspace", "tabs", "settings", "themes", "modals", "games"]
source_paths: ["ui/src/components/Desktop/DesktopTabBar.tsx", "ui/src/components/Desktop/DesktopTabContextMenu.tsx", "ui/src/components/Desktop/DesktopTabItem.tsx", "ui/src/components/Desktop/useTabBarScrollbar.ts", "ui/src/components/Settings/AvailableUpdateDialog.tsx", "ui/src/components/Settings/DesktopTypographySettings.tsx", "ui/src/components/Settings/FeatureSettingRow.tsx", "ui/src/components/Settings/FontSearchDropdown.tsx", "ui/src/components/Settings/FontVariantDropdown.tsx", "ui/src/components/Settings/PreferenceDescriptionTooltip.tsx", "ui/src/components/Settings/SettingsFeaturesIcon.tsx", "ui/src/components/Settings/SettingsFeaturesSection.tsx", "ui/src/components/Settings/SettingsModal.tsx", "ui/src/components/Settings/SettingsModalDialogs.tsx", "ui/src/components/Settings/SettingsOutlineButton.tsx", "ui/src/components/Settings/SettingsPreferencesPanel.tsx", "ui/src/components/Settings/SettingsShortcutsPanel.tsx", "ui/src/components/Settings/SettingsUpdateBackupPanel.tsx", "ui/src/components/Settings/SettingsVersionFooter.tsx", "ui/src/components/Settings/TableAlignmentInfoDialog.tsx", "ui/src/components/Settings/ThemePickerIcons.tsx", "ui/src/components/Settings/ThemeRemixDropdown.tsx", "ui/src/components/Settings/ThemeRemixModal.tsx", "ui/src/components/Settings/ThemeStylePicker.tsx", "ui/src/components/Settings/desktopTypographyChanges.ts", "ui/src/components/Settings/keyboardShortcutSearch.ts", "ui/src/components/Settings/settingsActions.ts", "ui/src/components/Settings/settingsModalData.ts", "ui/src/components/Settings/settingsRowIcons.tsx", "ui/src/components/Settings/shortcutGroups.ts", "ui/src/components/Settings/themeRemixModel.ts", "ui/src/components/Settings/themeRemixTranslations.ts", "ui/src/components/Settings/useThemeRemixActions.ts", "ui/src/components/Settings/useThemeRemixStatus.ts", "ui/src/components/Workspace/BrowserFlagGuideModal.tsx", "ui/src/components/Workspace/RecentWorkspaceItem.tsx", "ui/src/components/Workspace/RecentWorkspacesModal.tsx", "ui/src/components/Workspace/WorkspaceSelection.tsx", "ui/src/components/Workspace/WorkspaceWindowControls.tsx", "ui/src/components/Workspace/workspaceSelectionUtils.ts", "ui/src/desktop/desktopTabSnapshot.ts", "ui/src/desktop/desktopTabs.ts", "ui/src/desktop/fonts/applyDesktopTypography.ts", "ui/src/desktop/fonts/fontModel.ts", "ui/src/desktop/shellLocation.ts", "ui/src/desktop/types.ts", "ui/src/desktop/workspaceOperations.ts", "ui/src/hooks/useDesktopTabManagement.ts", "ui/src/hooks/useDesktopTabSearchSync.ts", "ui/src/hooks/useDesktopTabs.ts", "ui/src/settings/settingsImportExport.ts", "ui/src/settings/settingsImportExportBase.ts", "ui/src/theme/customThemes.ts", "ui/src/utils/themeMode.ts", "ui/src/utils/themeTransition.ts", "ui/src/workspace/workspaceEntriesClient.ts", "ui/src/workspace/workspaceEntryCapability.ts", "ui/src/workspace/workspaceEntryMessages.ts", "ui/src/workspace/workspaceEntryName.ts", "ui/src/workspace/workspaceEntryPaths.ts", "ui/src/workspace/workspaceEntryRenameState.ts"]
related_specs: ["architecture.ui-state-and-runtimes", "architecture.ui-theming-and-styles", "feature.sidebar-search-bookmarks", "feature.git-history-and-diff", "feature.local-editing-and-split-view"]
last_doc_update_at: "2026-11-17T04:52:00Z"
last_verified_at: "2026-11-17T04:52:00Z"
last_verified_code_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_at: "2026-11-17T04:52:00Z"
source_fingerprint: "sha256:381be40507c3c922094b8af61d0a0fa8d215de2c947049ea4f0751989f7c2e0a"
---

# Workspace Selection, Desktop Tabs, Settings, and Themes

## Purpose and boundaries

Covers workspace onboarding and recents management, multi-tab desktop/web workspace sessions with tab-bar interactions, the settings modal with persistent UI/editor/table preferences, theme/accent switching and custom theme remixing, and desktop typography configuration.

- **In scope**: `ui/src/components/Workspace/*`, `ui/src/workspace/*`, `ui/src/components/Desktop/*`, `ui/src/desktop/*`, `ui/src/hooks/useDesktop*`, `ui/src/components/Settings/*`, `ui/src/settings/*`, `ui/src/theme/*`, `ui/src/utils/{themeMode,themeTransition}.ts`.
- **Out of scope**: Global `AppState` reducer/effects (`architecture.ui-state-and-runtimes`) and CSS token/layer definitions (`architecture.ui-theming-and-styles`).

## Observable behavior

- **Workspace selection (`WorkspaceSelection.tsx`)**: Opens directories/files via the active runtime bridge, maintains recent workspaces with pinning/removal, and surfaces empty-state onboarding. In `web` runtime (`__webBus` / `appRuntime === 'web'`), renders an inline File System Access flag hint (`open-folder-flag-hint` -> `BrowserFlagGuideModal`) and a virtual workspace creation button; the legacy `chrome://flags` `showBrowserGuide` panel was removed.
- **Desktop tabs (`DesktopTabBar.tsx`, `DesktopTabContextMenu.tsx`, `desktopTabs.ts`)**: Supports multi-tab navigation, tab pinning/closing/reordering, keyboard shortcuts, and persisted per-workspace tab state across `tauri`, `electron`, and `web` (`__webBus`). `DesktopTabBar` passes `homeLabel={t.topbar.homeGetHelp || t.topbar.home}` to `ToolbarActionMenu`, connects `editShortcut` and `plainShortcut` to `MarkdownEditingHeaderActions`, and renders `WebDemoNavActions` when `isWebRuntime()` is true (omitting native window controls). Right-clicking content tabs invokes `DesktopTabContextMenu` with close commands and shell-location actions.
- **Settings & preferences (`SettingsModal.tsx`, `SettingsFeaturesSection.tsx`, `SettingsPreferencesPanel.tsx`, `SettingsShortcutsPanel.tsx`, `SettingsUpdateBackupPanel.tsx`, `DesktopTypographySettings.tsx`, `settingsImportExportBase.ts`, `settingsImportExport.ts`)**:
  - `SettingsModal` enables typography and editor sections for `desktop`, `vscode`, and `web`, and hides `reloadWindow` in `web`.
  - Feature defaults and import/export normalization (`settingsImportExportBase.ts`, `settingsImportExport.ts`): `bookmarksEnabled` defaults ON (`raw.bookmarksEnabled !== false`), `historySidebarEnabled` defaults OFF (`raw.historySidebarEnabled === true`), `fileTabs` defaults ON (`raw.fileTabs !== false`), `markdownEditingEnabled` defaults ON (`raw.markdownEditingEnabled !== false`), and `tableColumnAlignment` defaults to `'intelligent'`.
  - `SettingsFeaturesSection` wraps feature groups in `.settings-features-section__scroll` with a fixed header and disables `historySidebarEnabled` in `web` (`(Web unavailable)`).
  - `SettingsPreferencesPanel` exposes the `desktopView` control when `isDesktop || __webBus || appRuntime === 'web'` and binds the Intelligent table alignment option to typed 9-locale `t.alignIntelligent`.
  - `SettingsUpdateBackupPanel` hides update checks/downloads in `web` and displays `t.webVersionStatus`.
  - `DesktopTypographySettings` renders the `px` unit inside `.desktop-font-size-stepper` alongside the input.
  - `settingsRowIcons.tsx` renders unified SVG icons for typography roles, appearance rows, feature toggles, and shortcut actions.
- **Keyboard shortcuts (`settingsActions.ts`, `keyboardShortcutSearch.ts`, `appStateConstants.ts`)**: `openFiles` defaults to `Ctrl+Shift+E` on Desktop (`Alt+Shift+E` fallback) while `plainEditCurrentDocument` defaults to `Ctrl+Alt+E` on Desktop (`Ctrl+Alt+Shift+E` on web/VS Code). Dedicated Markdown editor formatting actions (`editorBold`, `editorItalic`, `editorIncreaseFontSize`, etc.) live in mission `'markdownEditor'` and allow cross-mission keybindings without conflicting with general app shortcuts.
- **Theme & accent switching (`ThemeStylePicker.tsx`, `ThemeRemixModal.tsx`, `themeMode.ts`, `themeTransition.ts`)**: Resolves `auto`/`light`/`dark` modes and theme presets (`raw-grid` labeled `'Default'`, `default` labeled `'Explorer Classic'`, `bento`, `vercel`, `tokyo-night`, `neon-voltage`, `cyberpunk`, plus 2 pet themes: `pet-white-shiba` "Nika" and `pet-k-ink` "K-Ink") with animated View Transitions when supported.
- **Embedded mini-games**: Includes theme-aware offline games (e.g., Snake styled with default/active theme tokens) accessible from the workspace UI.

## Code map

- `ui/src/components/Workspace/*`, `ui/src/workspace/*` — workspace selection, recent items, flag guide, and entry path/rename helpers.
- `ui/src/components/Desktop/*`, `ui/src/desktop/*`, `ui/src/hooks/useDesktop*` — desktop tab bar, tab context menu, snapshot/session state, and desktop typography application.
- `ui/src/components/Settings/*`, `ui/src/settings/*` — settings modal, preferences/features/shortcuts/typography/update-backup panels, row icons (`settingsRowIcons.tsx`), action catalogs, theme picker/remix modal, and settings import/export.
- `ui/src/theme/customThemes.ts`, `ui/src/utils/{themeMode,themeTransition}.ts` — custom theme normalization and DOM theme/transition helpers.

## Verification

- Covered by `tests/unit/ui/components/` suites (`workspace-render.test.tsx`, `desktop-tabbar-interactions.test.tsx`, `settings-render.test.tsx`, `settings-features-section.test.tsx`, `settings-appearance-descriptions.test.tsx`, `settings-modal-deep.test.tsx`, `settings-shortcut-groups.test.tsx`, `theme-modals-render.test.tsx`, `snake-sandbox-theme.test.ts`) and `tests/node/bookmarks.test.mjs`.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [UI Theming, CSS Architecture, and Style Contracts](../architecture/ui-theming-and-styles.md)
- [Sidebar Navigation, File Tree, Search, and Bookmarks](sidebar-search-bookmarks.md)
- [Local Editing, Dirty State, and Split View](local-editing-and-split-view.md)
- [Git History and Diff Viewer](git-history-and-diff.md)
- [Markdown Rendering, Sandboxes, and Interactive Data Tables](markdown-rendering-and-tables.md)

## Known limitations and open questions

- Multi-tab desktop session features are active in desktop and web runtimes (`tauri`, `electron`, `web`) and omitted or simplified in VS Code single-document contexts.
