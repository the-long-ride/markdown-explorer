---
timestamp: '2026-08-01T22:54:00+07:00'
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
test_scope:
- tests/unit/ui/contexts/constants.test.ts
- tests/unit/ui/settings-import-export.test.ts
- tests/unit/ui/contexts/state-utils.test.ts
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
| `documentConversion` | `boolean` | `false` | Include/convert supported binary documents |
| `scopeFocus` | `Record<string,string[]>` | `{}` | Browsing focus paths by workspace |
| `searchScopeFocus` | `Record<string,string[]>` | `{}` | Search focus paths by workspace |
| `desktopViewMode` | `focus \| tabs` | `focus` | Desktop workspace-tab presentation |
| `keybindings` | `Record<string,string>` | runtime defaults | Custom shortcut map |
| `disabledKeybindings` | `Record<string,boolean>` | `{}` | Disabled action map |
| `language` | `string` | `en` | Application locale |
| `customThemes` | `CustomTheme[]` | `[]` | Validated custom remixes |
| `activeCustomThemeId` | `string?` | unset | Selected custom theme |

## Normalization

- Boolean defaults are applied field-by-field; invalid values never replace the entire settings object.
- `desktopViewMode` accepts `tabs`; every other value normalizes to `focus`.
- `language` import is trimmed and limited; unsupported locale presentation falls back to English.
- Scope keys and paths are trimmed, deduplicated, capped, and reconciled to current workspaces.
- Custom themes and active IDs use dedicated validators.
- `documentConversion` capability is runtime-dependent; Chromium does not support it.

## Import coverage

The active importer restores core booleans, `scopeFocus`, `desktopViewMode`, `keybindings`, `language`, custom themes, and active custom-theme ID. It does not currently return imported `searchScopeFocus` or `disabledKeybindings`; the reducer merge therefore preserves their existing values.

## Persistence

Settings persist through the selected `PlatformBridge` state adapter. Local layout/tab fragments use the separate storage catalog.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/themeTypes.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/appStateConstants.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/appStateModel.ts` | Active behavior or contract |
| Implementation | `ui/src/settings/settingsImportExport.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/contexts/constants.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/settings-import-export.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/contexts/state-utils.test.ts` | Automated expectation |

---

[← Host-to-UI Message Catalog](02-host-to-ui-message-catalog.md) · [Documentation index](../README.md) · [Keyboard Shortcut Catalog →](04-shortcut-catalog.md)
