---
timestamp: '2026-08-05T06:40:23+07:00'
name: Storage Catalog
topic: Exact bridge, local-storage, and IndexedDB keys and ownership
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../01-architecture/07-persistence-and-storage.md
related_docs:
- 03-settings-catalog.md
- 08-limits-catalog.md
source_scope:
- ui/src/constants/storage.ts
- ui/src/App.tsx
- ui/src/platform/electron.ts
- ui/src/platform/chrome.ts
- ui/src/platform/web.ts
- ui/src/useAppLayoutEffects.ts
- ui/src/hooks/useResize.ts
- ui/src/contexts/appStateModel.ts
- ui/src/contexts/reducers/settingsUiReducer.ts
- ui/src/settings/settingsImportExport.ts
- ui/src/bookmarks/bookmarkStore.ts
- chromium-xtension/src/file-access.ts
test_scope:
- tests/node/product-constants.test.mjs
- tests/unit/ui/settings-import-export.test.ts
- tests/unit/chromium/file-access.test.ts
- tests/unit/ui/desktop-tabs.test.ts
- tests/node/bookmarks.test.mjs
runtime_scope:
- shared
keywords:
- storage
- persistence
---

# Storage Catalog

| Key or store | Owner | Contents |
|---|---|---|
| `markdown-explorer-ui-state` | Electron/shared adapter | Persisted app settings/theme state |
| `markdown-explorer-chrome-state` | Chromium adapter | Persisted app settings/theme state |
| `markdown-explorer-web-state` | Website adapter | Persisted app settings/theme state |
| `markdown-explorer-terms-accepted` | Shared local storage | First-run terms acknowledgement |
| `markdown-explorer-theme-onboarding-complete` | Shared local storage | Theme onboarding completion |
| `markdown-explorer-sidebar-width` | Shared local storage | Numeric sidebar width |
| `markdown-explorer-toc-width` | Shared local storage | Numeric TOC width |
| `markdown-explorer-toc-collapsed` | Shared local storage | TOC panel collapsed flag |
| `markdown-explorer-desktop-tabs-v1` | Shared desktop storage | Desktop workspace-tab snapshot |
| `markdown-explorer-workspace-aliases-v1` | Shared desktop storage | Canonical workspace identity to alias map |
| `markdown-explorer-bookmarks-v1` | Shared local storage | Version-2 source-anchored text/object bookmarks; version-1 records migrate in place |
| `<app-data>/fonts/` | Electron/Tauri native font service | Validated imported `.ttf`/`.otf` copies grouped by managed family id |
| IndexedDB `markdown-explorer-db` / `workspaces` | Chromium | Directory/file handles and recent browser workspaces |

## Managed font storage

Desktop font imports are copied into app data and are independent of the original chosen file path. Settings/export JSON stores only normalized font references. The Tauri `local-file://` protocol may read only canonical files beneath this managed font root (plus its existing active-workspace scope).

## Storage rules

- Parse failures fall back safely; corrupt storage must not prevent launch.
- Widths are finite positive numbers and are rounded/bounded by layout logic.
- Imported local UI JSON fragments are limited to 350,000 serialized characters.
- Browser handles are never serialized into plain local storage.
- Clearing onboarding flags repeats onboarding only; it must not erase workspace files.
- Versioned key suffixes permit future migration without ambiguous shapes.
- Unknown/corrupt bookmark documents load as `{ version: 2, items: [] }`; version-1 items migrate deterministically; disabling Bookmarks preserves the key.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/constants/storage.ts` | Stable storage and export identifiers |
| Implementation | `ui/src/App.tsx` | First-run storage consumers |
| Implementation | `ui/src/platform/electron.ts` | Active behavior or contract |
| Implementation | `ui/src/platform/chrome.ts` | Active behavior or contract |
| Implementation | `ui/src/platform/web.ts` | Active behavior or contract |
| Implementation | `ui/src/useAppLayoutEffects.ts` | Restores persisted layout widths |
| Implementation | `ui/src/hooks/useResize.ts` | Persists resized layout widths |
| Implementation | `ui/src/contexts/appStateModel.ts` | Restores TOC collapsed state |
| Implementation | `ui/src/contexts/reducers/settingsUiReducer.ts` | Persists TOC collapsed state |
| Implementation | `ui/src/settings/settingsImportExport.ts` | Active behavior or contract |
| Implementation | `ui/src/bookmarks/bookmarkStore.ts` | Bookmark CRUD, parsing, and persistence |
| Implementation | `chromium-xtension/src/file-access.ts` | Active behavior or contract |
| Verification | `tests/node/product-constants.test.mjs` | Stable storage identifiers |
| Verification | `tests/unit/ui/settings-import-export.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/file-access.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/desktop-tabs.test.ts` | Automated expectation |
| Verification | `tests/node/bookmarks.test.mjs` | Bookmark persistence and corrupt-data recovery |

---

[← Supported Files and Conversion Catalog](06-supported-files-and-conversion.md) · [Documentation index](../README.md) · [Limits and Thresholds Catalog →](08-limits-catalog.md)
