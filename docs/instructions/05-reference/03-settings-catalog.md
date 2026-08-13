---
timestamp: '2026-08-05T06:40:23+07:00'
name: Settings Catalog
topic: Exact active application settings, defaults, normalization, and effects
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../03-features/12-settings-preferences-import-export.md
related_docs:
- 04-shortcut-catalog.md
- 05-theme-catalog.md
- 07-storage-catalog.md
source_scope:
- ui/src/themeTypes.ts
- ui/src/contexts/appStateConstants.ts
- ui/src/contexts/appStateModel.ts
- ui/src/settings/settingsImportExport.ts
- ui/src/components/Settings/SettingsPreferencesPanel.tsx
- ui/src/components/Settings/SettingsModal.tsx
- ui/src/components/Settings/SettingsOutlineButton.tsx
- ui/src/components/Settings/DesktopTypographySettings.tsx
- ui/src/styles/global/global-settings-typography.css
test_scope:
- tests/unit/ui/contexts/constants.test.ts
- tests/unit/ui/settings-import-export.test.ts
- tests/unit/ui/contexts/state-utils.test.ts
- tests/node/bookmarks.test.mjs
- tests/node/settings-ux-followup-contract.test.mjs
- tests/node/localization-settings-doc-sync-contract.test.mjs
runtime_scope:
- shared
keywords:
- settings
- defaults
---

# Settings Catalog

| Setting | Type | Default | Effect |
|---|---|---|---|
| `showTitle` | `boolean` | `false` | Display document title in content shell |
| `defaultHtmlPreview` | `boolean` | `true` | Default `.html` to sandbox preview |
| `defaultHtmlCodeBlockPreview` | `boolean` | `true` | Default HTML fences to preview |
| `defaultCsvPreview` | `boolean` | `true` | Default delimited data to table preview |
| `fileTabs` | `boolean` | `false` | Enable document content tabs |
| `bookmarksEnabled` | `boolean` | `false` | **Enable Bookmark feature**: show mixed-text/object capture actions and the Bookmarks tab; disabling preserves stored records |
| `documentConversion` | `boolean` | `false` | Include/convert supported binary documents |
| `scopeFocus` | `Record<string,string[]>` | `{}` | Browsing focus paths by workspace |
| `searchScopeFocus` | `Record<string,string[]>` | `{}` | Search focus paths by workspace |
| `desktopViewMode` | `focus \| tabs` | `focus` | Desktop workspace-tab presentation |
| `keybindings` | `Record<string,string>` | runtime defaults | Custom shortcut map |
| `disabledKeybindings` | `Record<string,boolean>` | `{}` | Disabled action map |
| `language` | `string` | `en` | Application locale |
| `maxPinnedItems` | `number` | `10` | Limit pinned files and folders per workspace (1–15) |
| `customThemes` | `CustomTheme[]` | `[]` | Validated custom remixes |
| `fontBindings` | `DesktopFontBindings?` | role defaults | Electron/Tauri/VS Code App UI, Body, Heading, Quote, and Code font family/style/weight bindings |
| `activeCustomThemeId` | `string?` | unset | Selected custom theme |

## Typography font bindings

A `DesktopFontBinding` stores `source: default | system | imported`, bounded optional `family`/`id`, `style: normal | italic`, and a numeric `weight`. `DesktopFontBindings` contains `appUi`, `body`, `heading`, `quote`, and `code`. Font import is role-targeted in the UI draft: a correlated `desktopFontsResult.importedId` updates only the role that initiated the request, and persistence does not occur until Apply writes `fontBindings`. Unknown sources, unavailable variants, or malformed values normalize to that role's default. Legacy `appFont`/`codeFont` fields are read only for migration.

## Settings modal interaction

Settings navigation shows an icon before each section label. The **Appearance** pane renders its preference controls directly beneath the section title/description and does not render a secondary **View Preferences** heading. Outline actions share one themed button component for consistent hover, pointer, focus, tooltip, icon, and shortcut-keycap behavior. In **Typography**, the section header and Apply button remain fixed while only the font-role list scrolls; importing a font targets the initiating role in the draft and remains unsaved until Apply. The action-level circle-check icon is locked to a 14 px square with component-owned sizing so every theme renders Apply consistently.

The close control renders `Esc` as a keycap in its tooltip. **Update & Backup** reuses its cloud icon on **Check for update**.

Electron/Tauri and VS Code expose Typography. VS Code uses extension global storage for imported fonts and `asWebviewUri` for webview-safe font resources; Chromium/Web does not enumerate/import native fonts.

## Normalization

- Boolean defaults are applied field-by-field; invalid values never replace the entire settings object.
- `maxPinnedItems` is normalized via `normalizeMaxPinnedItems` to an integer clamped between `1` and `15` (default `10`).
- `desktopViewMode` accepts `tabs`; every other value normalizes to `focus`.
- `language` import is trimmed and limited; unsupported locale presentation falls back to English.
- Scope keys and paths are trimmed, deduplicated, capped, and reconciled to current workspaces.
- Custom themes and active IDs use dedicated validators.
- `documentConversion` capability is runtime-dependent; Chromium does not support it.

## Import coverage

The active importer restores core booleans including `bookmarksEnabled`, `scopeFocus`, `desktopViewMode`, `keybindings`, `language`, custom themes, and active custom-theme ID. It does not currently return imported `searchScopeFocus` or `disabledKeybindings`; the reducer merge therefore preserves their existing values.

## Persistence

Settings persist through the selected `PlatformBridge` state adapter. Local layout/tab fragments use the separate storage catalog.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/themeTypes.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/appStateConstants.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/appStateModel.ts` | Active behavior or contract |
| Implementation | `ui/src/settings/settingsImportExport.ts` | Active behavior or contract |
| Implementation | `ui/src/components/Settings/SettingsPreferencesPanel.tsx` | Bookmark preference switch |
| Implementation | `ui/src/components/Settings/SettingsModal.tsx` | Settings navigation, host-scoped shortcuts, close tooltip |
| Implementation | `ui/src/components/Settings/SettingsOutlineButton.tsx` | Shared themed outline action |
| Implementation | `ui/src/components/Settings/DesktopTypographySettings.tsx` | Role-targeted font draft controls and local scrolling |
| Implementation | `ui/src/styles/global/global-settings-typography.css` | Typography-only layout and scroll containment |
| Verification | `tests/unit/ui/contexts/constants.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/settings-import-export.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/contexts/state-utils.test.ts` | Automated expectation |
| Verification | `tests/node/bookmarks.test.mjs` | Bookmark setting, import, UI, and localization contract |
| Verification | `tests/node/settings-ux-followup-contract.test.mjs` | Settings outline, typography scroll, icons, Edit host behavior, docs |
| Verification | `tests/node/localization-settings-doc-sync-contract.test.mjs` | Appearance heading removal, Apply icon invariant, localization wiring, and current-state docs |

---

[← Host-to-UI Message Catalog](02-host-to-ui-message-catalog.md) · [Documentation index](../README.md) · [Keyboard Shortcut Catalog →](04-shortcut-catalog.md)
