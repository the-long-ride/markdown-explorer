---
timestamp: '2026-08-01T22:54:00+07:00'
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
- ui/src/platform/electron.ts
- ui/src/platform/chrome.ts
- ui/src/platform/web.ts
- ui/src/desktop/constants.ts
- ui/src/useAppLayoutEffects.ts
- ui/src/settings/settingsImportExport.ts
- chromium-xtension/src/file-access.ts
test_scope:
- tests/unit/ui/settings-import-export.test.ts
- tests/unit/chromium/file-access.test.ts
- tests/unit/ui/desktop-tabs.test.ts
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
| IndexedDB `markdown-explorer-db` / `workspaces` | Chromium | Directory/file handles and recent browser workspaces |

## Storage rules

- Parse failures fall back safely; corrupt storage must not prevent launch.
- Widths are finite positive numbers and are rounded/bounded by layout logic.
- Imported local UI JSON fragments are limited to 350,000 serialized characters.
- Browser handles are never serialized into plain local storage.
- Clearing onboarding flags repeats onboarding only; it must not erase workspace files.
- Versioned key suffixes permit future migration without ambiguous shapes.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/platform/electron.ts` | Active behavior or contract |
| Implementation | `ui/src/platform/chrome.ts` | Active behavior or contract |
| Implementation | `ui/src/platform/web.ts` | Active behavior or contract |
| Implementation | `ui/src/desktop/constants.ts` | Active behavior or contract |
| Implementation | `ui/src/useAppLayoutEffects.ts` | Active behavior or contract |
| Implementation | `ui/src/settings/settingsImportExport.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/file-access.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/settings-import-export.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/file-access.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/desktop-tabs.test.ts` | Automated expectation |

---

[← Supported Files and Conversion Catalog](06-supported-files-and-conversion.md) · [Documentation index](../README.md) · [Limits and Thresholds Catalog →](08-limits-catalog.md)
