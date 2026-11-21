---
schema_version: 1
id: "feature.workspace-tabs-and-settings"
title: "Workspace Selection, Desktop Tabs, Settings, and Themes"
kind: "feature"
status: "verified"
summary: "Recent workspace switching, multi-tab desktop session state, settings modal and persistence, theme/accent presets, and embedded mini-games."
tags: ["workspace", "tabs", "settings", "themes", "modals", "games"]
source_paths: ["ui/src/components/Desktop/DesktopTabBar.tsx", "ui/src/components/Desktop/DesktopTabContextMenu.tsx", "ui/src/components/Desktop/DesktopTabItem.tsx", "ui/src/components/Desktop/useTabBarScrollbar.ts", "ui/src/components/Settings/AvailableUpdateDialog.tsx", "ui/src/components/Settings/DesktopTypographySettings.tsx", "ui/src/components/Settings/FeatureSettingRow.tsx", "ui/src/components/Settings/FontSearchDropdown.tsx", "ui/src/components/Settings/FontVariantDropdown.tsx", "ui/src/components/Settings/PreferenceDescriptionTooltip.tsx", "ui/src/components/Settings/SettingsFeaturesIcon.tsx", "ui/src/components/Settings/SettingsFeaturesSection.tsx", "ui/src/components/Settings/SettingsModal.tsx", "ui/src/components/Settings/SettingsModalDialogs.tsx", "ui/src/components/Settings/SettingsOutlineButton.tsx", "ui/src/components/Settings/SettingsPreferencesPanel.tsx", "ui/src/components/Settings/SettingsShortcutsPanel.tsx", "ui/src/components/Settings/SettingsUpdateBackupPanel.tsx", "ui/src/components/Settings/SettingsVersionFooter.tsx", "ui/src/components/Settings/TableAlignmentInfoDialog.tsx", "ui/src/components/Settings/ThemePickerIcons.tsx", "ui/src/components/Settings/ThemeRemixDropdown.tsx", "ui/src/components/Settings/ThemeRemixModal.tsx", "ui/src/components/Settings/ThemeStylePicker.tsx", "ui/src/components/Settings/desktopTypographyChanges.ts", "ui/src/components/Settings/keyboardShortcutSearch.ts", "ui/src/components/Settings/settingsActions.ts", "ui/src/components/Settings/settingsModalData.ts", "ui/src/components/Settings/settingsRowIcons.tsx", "ui/src/components/Settings/shortcutGroups.ts", "ui/src/components/Settings/themeRemixModel.ts", "ui/src/components/Settings/themeRemixTranslations.ts", "ui/src/components/Settings/useThemeRemixActions.ts", "ui/src/components/Settings/useThemeRemixStatus.ts", "ui/src/components/Workspace/BrowserFlagGuideModal.tsx", "ui/src/components/Workspace/RecentWorkspaceItem.tsx", "ui/src/components/Workspace/RecentWorkspacesModal.tsx", "ui/src/components/Workspace/WorkspaceSelection.tsx", "ui/src/components/Workspace/WorkspaceWindowControls.tsx", "ui/src/components/Workspace/workspaceSelectionUtils.ts", "ui/src/desktop/desktopTabSnapshot.ts", "ui/src/desktop/desktopTabs.ts", "ui/src/desktop/fonts/applyDesktopTypography.ts", "ui/src/desktop/fonts/fontModel.ts", "ui/src/desktop/shellLocation.ts", "ui/src/desktop/types.ts", "ui/src/desktop/workspaceOperations.ts", "ui/src/hooks/useDesktopTabManagement.ts", "ui/src/hooks/useDesktopTabSearchSync.ts", "ui/src/hooks/useDesktopTabs.ts", "ui/src/settings/settingsImportExport.ts", "ui/src/settings/settingsImportExportBase.ts", "ui/src/theme/customThemes.ts", "ui/src/utils/themeMode.ts", "ui/src/utils/themeTransition.ts", "ui/src/workspace/workspaceEntriesClient.ts", "ui/src/workspace/workspaceEntryCapability.ts", "ui/src/workspace/workspaceEntryMessages.ts", "ui/src/workspace/workspaceEntryName.ts", "ui/src/workspace/workspaceEntryPaths.ts", "ui/src/workspace/workspaceEntryRenameState.ts"]
related_specs: ["architecture.ui-state-and-runtimes", "architecture.ui-theming-and-styles", "feature.sidebar-search-bookmarks", "feature.git-history-and-diff", "feature.local-editing-and-split-view", "feature.markdown-rendering-and-tables"]
last_doc_update_at: "2026-11-20T11:30:45Z"
last_verified_at: "2026-11-20T11:30:45Z"
last_verified_code_commit: "f0818d86f926ee15c5508b3bc186e1ddf18f50b8"
last_source_change_commit: "f0818d86f926ee15c5508b3bc186e1ddf18f50b8"
last_source_change_at: "2026-11-20T14:51:38+07:00"
source_fingerprint: "sha256:2a51300ecfa9b10bf77bc294c1c97c9f2e336ab1b6e60b4d498f01feb9a56f20"
---

# Workspace Selection, Desktop Tabs, Settings, and Themes

## Purpose and boundaries

Covers workspace onboarding and recents management, multi-tab desktop/web workspace sessions with tab-bar interactions, the settings modal with persistent UI/editor/table preferences, theme/accent switching and custom theme remixing, and desktop typography configuration.

- **In scope**: `ui/src/components/Workspace/*`, `ui/src/workspace/*`, `ui/src/components/Desktop/*`, `ui/src/desktop/*`, `ui/src/hooks/useDesktop*`, `ui/src/components/Settings/*`, `ui/src/settings/*`, `ui/src/theme/*`, `ui/src/utils/{themeMode,themeTransition}.ts`.
- **Out of scope**: Global `AppState` reducer/effects (`architecture.ui-state-and-runtimes`) and CSS token/layer definitions (`architecture.ui-theming-and-styles`).

## Observable behavior

- **Workspace selection (`WorkspaceSelection.tsx`, `BrowserFlagGuideModal.tsx`, `WorkspaceWindowControls.tsx`, `workspaceEntryCapability.ts`)**:
  - Opens directories/files via the active runtime bridge behind `useDirtyDocumentsGuard()`, maintains searchable inline recent workspaces (in a two-column `.workspace-selection__panel--split` layout when recents or the macOS Electron install guide are present) with alias renaming and removal, and dispatches `open-homepage` from `WorkspaceWindowControls` (whose theme button uses `executeThemeTransition`).
  - In `web` runtime (`window.__webBus` / `appRuntime === 'web'`), renders an inline File System Access flag hint (`open-folder-flag-hint` -> `BrowserFlagGuideModal`), a **New Virtual Workspace** button (`createVirtualWorkspace` command when `__webBus` is active), and `WebDemoNavActions`; the legacy `chrome://flags` sidebar column was removed.
  - `getWorkspaceEntryCapability()` uses `'permanent'` deletion for `appRuntime === 'web'` and `'trash'` for desktop/VS Code hosts; `isWebDemoTestMode()` checks `isWebRuntime()` + `?mode=test`.
- **Desktop tabs & session state (`DesktopTabBar.tsx`, `DesktopTabItem.tsx`, `DesktopTabContextMenu.tsx`, `desktopTabs.ts`, `desktopTabSnapshot.ts`, `useDesktopTabs.ts`, `useDesktopTabSearchSync.ts`, `desktop/types.ts`)**:
  - Supports multi-tab workspace navigation, animated tab closing, drag reordering, alias editing, keyboard shortcuts, and persisted per-workspace tab state across `tauri`, `electron`, and `web` (`__webBus`, starting at `['home']` in `?mode=test` mode).
  - `DesktopTabBar` reads `useRepositorySnapshot()` to compute `effectiveToc = isRevisionMode ? (snapshotContext.activeToc ?? []) : state.toc`, keeping the `ToolbarActionMenu` Toggle TOC action active/enabled during Git History revision snapshots even when no live `state.currentFile` is open. It passes `homeLabel={t.topbar.homeGetHelp || t.topbar.home}` to `ToolbarActionMenu`, connects `editShortcut` and `plainShortcut` to `MarkdownEditingHeaderActions`, and renders `WebDemoNavActions` instead of native window controls when `isWebRuntime()` is true. `DesktopTabItem` uses `data-hover-tooltip` and portal `TooltipButton` close controls; right-clicking tabs invokes `DesktopTabContextMenu`.
  - `useDesktopTabs` skips persisting `TOUR_DEMO_WORKSPACE_PATH`, dismisses active tour overlays on new tab creation, preserves already-loaded workspace state and restored `contentTabs`/`activeContentTabPath` across loading transitions (`desktopTabSnapshot.ts`), resets tab state cleanly when toggling `desktopViewMode`, and clears `pendingWorkspaceReplacementRef` on `readyAck`, `workspaceFilesChanged`, or `workspaceUnavailable` (`useDesktopTabSearchSync.ts`).
  - `PendingSearchJump` (`ui/src/desktop/types.ts`) carries optional `lineNumber?: number` and `excerpt?: string` alongside `query`, `matchOrdinal`, `matchIndex`, and `matchCase` so workspace search jumps preserve source-line and excerpt disambiguation across navigation and tab switches.
- **Settings, typography & preferences (`SettingsModal.tsx`, `SettingsFeaturesSection.tsx`, `SettingsPreferencesPanel.tsx`, `TableAlignmentInfoDialog.tsx`, `SettingsShortcutsPanel.tsx`, `SettingsUpdateBackupPanel.tsx`, `SettingsModalDialogs.tsx`, `AvailableUpdateDialog.tsx`, `DesktopTypographySettings.tsx`, `fontModel.ts`, `applyDesktopTypography.ts`, `settingsImportExportBase.ts`, `settingsImportExport.ts`)**:
  - `SettingsModal` enables typography and editor sections for `desktop`, `vscode`, and `web`, adds a top-bar Reload Window button (`reloadWebview` in VS Code, `window.location.reload()` otherwise), and hides `reloadWindow` from the shortcut list in `web`.
  - Feature defaults and import/export normalization (`settingsImportExportBase.ts`, `settingsImportExport.ts`): `bookmarksEnabled` defaults ON (`raw.bookmarksEnabled !== false`), `historySidebarEnabled` defaults OFF (`raw.historySidebarEnabled === true`), `fileTabs` defaults ON (`raw.fileTabs !== false`), `markdownEditingEnabled` defaults ON (`raw.markdownEditingEnabled !== false`), and `tableColumnAlignment` defaults to `'intelligent'`.
  - `SettingsFeaturesSection` wraps feature groups in `.settings-features-section__scroll` with a fixed header and disables `historySidebarEnabled` in `web` (`(Web unavailable)`).
  - `SettingsPreferencesPanel` exposes `desktopView` when `isDesktop || __webBus || appRuntime === 'web'`, wraps Color Mode switches in `executeThemeTransition`, and provides a quad `tableColumnAlignment` control (`left`, `center`, `right`, `intelligent`) with an info button opening `TableAlignmentInfoDialog` (documenting intelligent alignment rules and a sample preview).
  - `SettingsUpdateBackupPanel` resolves `'0.0.0'`/`(demo)` versions against bundled `package.json` (`resolveVersionNumber`), hides update checks/downloads in `web`, and displays `t.webVersionStatus`.
  - `DesktopTypographySettings`, `fontModel.ts`, and `applyDesktopTypography.ts` support per-role font `size` (`7–49px`; defaults `appUi: 13`, `body: 13`, `heading: 16`, `quote: 13`, `code: 12`, `mermaid: 13`) persisted in `DesktopFontBinding`, emitted to `--font-{ui,body,heading,quote,mono,mermaid}-size`, edited via `.desktop-font-size-stepper` with `px` unit, and shown in confirmation diffs (`desktopTypographyChanges.ts`).
  - `AvailableUpdateDialog`, `DesktopTypographySettings` apply confirmation, `SettingsModalDialogs`, and `TableAlignmentInfoDialog` bind Escape/Enter keyboard handling via `useDialogKeyboard`. `settingsRowIcons.tsx` renders unified SVG icons for appearance rows, feature toggles, typography roles, and shortcut actions.
- **Keyboard shortcuts (`settingsActions.ts`, `shortcutGroups.ts`, `keyboardShortcutSearch.ts`, `SettingsModal.tsx`)**:
  - Adds `openFiles` (`Ctrl+Shift+E` on Desktop, `Alt+Shift+E` fallback), `plainEditCurrentDocument` (`Ctrl+Alt+E` on Desktop, `Ctrl+Alt+Shift+E` on web/VS Code), `reloadWindow`, and 12 Markdown editor formatting/font-size actions (`editorBold`..`editorIncreaseFontSize`) under mission `'markdownEditor'` with localized group descriptions (`shortcutGroups.ts`).
  - Duplicate shortcut detection (`SettingsModal.tsx`) isolates `'markdownEditor'` actions from general app shortcuts (`isEditorShortcutAction`) and ignores disabled bindings.
- **Theme boot sync, style picker & View Transitions (`ThemeStylePicker.tsx`, `ThemePickerIcons.tsx`, `ThemeRemixModal.tsx`, `customThemes.ts`, `themeMode.ts`, `themeTransition.ts`)**:
  - Resolves `auto`/`light`/`dark` modes and 9 active styles (`raw-grid` labeled `'Default'`, `default` labeled `'Explorer Classic'`, `bento`, `vercel`, `tokyo-night`, `neon-voltage`, `cyberpunk`, plus 2 pet themes: `pet-white-shiba` "Nika" and `pet-k-ink` "K-Ink"; legacy cat/hamster/corgi pets removed).
  - `syncBootThemeToDocument(saved?, root?)` (`customThemes.ts`) synchronously normalizes and writes `data-theme`, `data-theme-style`, and active custom theme CSS overrides onto `document.documentElement` before initial React paint for a theme-aware boot splash.
  - `executeThemeTransition()` (`themeTransition.ts`) uses View Transitions (`document.startViewTransition` + `flushSync`) with `.theme-magic-overlay` radial reveal coordinates and a 450ms `data-theme-glitching="true"` pulse on `cyberpunk` (respecting `prefers-reduced-motion: reduce`), attaches rejection handlers to `ready`/`updateCallbackDone`, and writes `data-theme` / `data-theme-style` both before and after `updateThemeState()` so synchronous listeners (e.g., Mermaid theme re-renders) observe the incoming theme immediately.
- **Embedded mini-games**: Includes theme-aware offline games (e.g., Snake styled with default/active theme tokens) accessible from the workspace UI.

## Code map

- `ui/src/components/Workspace/*`, `ui/src/workspace/*` — workspace selection (`WorkspaceSelection.tsx`), `BrowserFlagGuideModal.tsx`, `WorkspaceWindowControls.tsx`, recent items, and entry path/capability/rename helpers.
- `ui/src/components/Desktop/*`, `ui/src/desktop/*`, `ui/src/hooks/useDesktop*` — `DesktopTabBar.tsx` (with revision-mode TOC integration), `DesktopTabItem.tsx`, `DesktopTabContextMenu.tsx`, `desktop/types.ts` (`PendingSearchJump`), tab snapshot/session persistence, and desktop typography model/application (`fontModel.ts`, `applyDesktopTypography.ts`).
- `ui/src/components/Settings/*`, `ui/src/settings/*` — settings modal, preferences/features/shortcuts/typography/update-backup panels, `TableAlignmentInfoDialog.tsx`, `ThemePickerIcons.tsx`, `settingsRowIcons.tsx`, action/group catalogs, theme picker/remix modal, and settings import/export.
- `ui/src/theme/customThemes.ts`, `ui/src/utils/{themeMode,themeTransition}.ts` — custom theme normalization, synchronous boot theme application (`syncBootThemeToDocument`), and View Transition / cyberpunk glitch theme switching (`executeThemeTransition`).

## Verification

- Covered by `tests/unit/ui/components/` suites (`workspace-render.test.tsx`, `workspace-selection-modal.test.tsx`, `desktop-tabbar-interactions.test.tsx`, `desktop-tabbar-deep.test.tsx`, `desktop-typography-settings.test.tsx`, `topbar-render.test.tsx`, `settings-render.test.tsx`, `settings-features-section.test.tsx`, `settings-appearance-descriptions.test.tsx`, `settings-modal-deep.test.tsx`, `settings-shortcut-groups.test.tsx`, `dialog-keyboard-accessibility.test.tsx`, `theme-modals-render.test.tsx`, `snake-sandbox-theme.test.ts`), `tests/unit/ui/custom-themes.test.ts`, `tests/unit/ui/utils/themeTransition.test.ts`, `tests/unit/ui/hooks/useDesktopTabs.test.ts`, `tests/unit/ui/desktop-tabs.test.ts`, `tests/unit/ui/settings-import-export.test.ts`, `tests/unit/ui/workspace/workspace-entry-capability.test.ts`, and `tests/node/bookmarks.test.mjs`.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [UI Theming, CSS Architecture, and Style Contracts](../architecture/ui-theming-and-styles.md)
- [Sidebar Navigation, File Tree, Search, and Bookmarks](sidebar-search-bookmarks.md)
- [Local Editing, Dirty State, and Split View](local-editing-and-split-view.md)
- [Git History and Diff Viewer](git-history-and-diff.md)
- [Markdown Rendering, Media Embeds, and Interactive Data Tables](markdown-rendering-and-tables.md)

## Known limitations and open questions

- Multi-tab desktop session features are active in desktop and web runtimes (`tauri`, `electron`, `web`) and omitted or simplified in VS Code single-document contexts.
