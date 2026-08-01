---
timestamp: '2026-08-01T22:54:00+07:00'
name: Limits and Thresholds Catalog
topic: Operational, validation, performance, and security limits
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../03-features/20-performance-enhancement-scheduling.md
related_docs:
- 06-supported-files-and-conversion.md
- 07-storage-catalog.md
source_scope:
- electron/workspace/scanner.js
- electron/search/search-worker-controller.js
- ui/src/components/Content/scheduleContentEnhancements.ts
- ui/src/components/Modal/MediaModal.tsx
- ui/src/settings/settingsImportExport.ts
- ui/src/theme/customThemes.ts
- tauri/src/local_file.rs
test_scope:
- tests/node/performance-table-tauri-contracts.test.mjs
- tests/node/content-enhancement-scheduler.test.mjs
- tests/unit/ui/settings-import-export.test.ts
runtime_scope:
- shared
keywords:
- limits
- performance
- security
---

# Limits and Thresholds Catalog

## Workspace and search

| Limit | Value |
|---|---:|
| Incremental partial reveal | about 3 seconds |
| Cumulative scan batch | 32 files |
| Electron title read concurrency | 32 |
| Electron title read timeout | 250 ms |
| Electron title enrichment deadline | 1500 ms |
| Scan title prefix | 8 KiB |
| Workspace search items | 10,000 maximum |
| Workspace content indexing | skip bodies above 2 MiB |
| Electron cross-tab default max results | 2,000 |
| Cross-tab index prime batch | 5 |
| UI search page | 100 |
| Chromium active-file poll | about 3000 ms |

## Rendering and preview

| Limit | Value |
|---|---:|
| Enhancement retry delays | 60, 180, 500, 1000, 2000 ms |
| Mermaid concurrency | 2 |
| Table enhancement concurrency | 3 |
| Initial table collapse | more than 15 rows |
| Line chart point markers hidden | more than 200 rows |
| Media zoom | 0.25–20 |
| Zoom button step | 0.25 |
| Zoom wheel step | about 0.15 |
| Standalone HTML document | about 8 MiB maximum |
| Preview inactivity/heartbeat cleanup | about 2 minutes |
| Preview maximum lifetime | about 24 hours |
| Tauri unrestricted local full read | reject above 256 MiB |
| Tauri archive/XML member | 32 MiB maximum |

## Import and themes

| Limit | Value |
|---|---:|
| Recent workspaces | 100 |
| Scope workspace key/path length | 1000 characters |
| Scope paths per workspace | 10,000 |
| Keybinding imported length | 48 characters |
| Language imported length | 12 characters |
| Imported local JSON fragment | 350,000 serialized characters |
| Custom themes | 24 |
| Custom theme ID/name | 64 / 48 characters |
| Theme background Data URL | 900,000 characters |
| Radius / stroke | 0–18 / 0–3 |
| Content padding / section gap | 16–64 / 4–28 |
| Background opacity / blur | 0–0.5 / 0–18 |
| Background position | 48 characters |

## Rule

Limits are product contracts only where active source enforces them. Changes require matching source, tests, feature/use-case docs, and this catalog.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `electron/workspace/scanner.js` | Active behavior or contract |
| Implementation | `electron/search/search-worker-controller.js` | Active behavior or contract |
| Implementation | `ui/src/components/Content/scheduleContentEnhancements.ts` | Active behavior or contract |
| Implementation | `ui/src/components/Modal/MediaModal.tsx` | Active behavior or contract |
| Implementation | `ui/src/settings/settingsImportExport.ts` | Active behavior or contract |
| Implementation | `ui/src/theme/customThemes.ts` | Active behavior or contract |
| Implementation | `tauri/src/local_file.rs` | Active behavior or contract |
| Verification | `tests/node/performance-table-tauri-contracts.test.mjs` | Automated expectation |
| Verification | `tests/node/content-enhancement-scheduler.test.mjs` | Automated expectation |
| Verification | `tests/unit/ui/settings-import-export.test.ts` | Automated expectation |

---

[← Storage Catalog](07-storage-catalog.md) · [Documentation index](../README.md) · [Error and Reason Catalog →](09-error-and-reason-catalog.md)
