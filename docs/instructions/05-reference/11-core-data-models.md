---
timestamp: '2026-10-07T00:00:00+07:00'
name: Core Data Models
topic: Canonical workspace, document, search, preview, and update records
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../01-architecture/05-state-model.md
related_docs:
- 01-ui-to-host-command-catalog.md
- 02-host-to-ui-message-catalog.md
source_scope:
- ui/src/types/content.ts
- ui/src/types/files.ts
- ui/src/types/hostMessages.ts
- ui/src/types/settings.ts
- ui/src/themeTypes.ts
- ui/src/bookmarks/types.ts
- ui/src/workspace/workspaceEntryCapability.ts
test_scope:
- tests/unit/ui/contexts/state-utils.test.ts
- tests/unit/ui/components/content-tabs-pure.test.ts
- tests/node/bookmarks.test.mjs
- tests/unit/ui/workspace/workspace-entry-capability.test.ts
runtime_scope:
- shared
keywords:
- data models
- types
---

# Core Data Models

## Document and navigation

| Model | Required fields and role |
|---|---|
| `TocEntry` | level, text, ID |
| `Frontmatter` | string record |
| `RenderContentMessage` | HTML, sources, frontmatter, TOC, paths, title, file list, preview info, operation metadata |
| `ContentTab` | per-document stored render/source/TOC/preview and preview override |
| `MdFile` / `FolderNode` | flat file identity and hierarchical workspace tree; a `FolderNode` may have zero files and zero children (a truly empty folder on disk) |

## Workspace correlation

| Model | Role |
|---|---|
| `WorkspaceOperationMetadata` | optional operation and workspace-tab IDs |
| `RecentWorkspace` | name, canonical path/identity, last-opened metadata |
| `WorkspaceUnavailableReason` | missing or locked |

## Search

| Model | Distinguishing fields |
|---|---|
| `WorkspaceSearchResult` | file identity, title/path, excerpt, match index/ordinal/length/line |
| `CrossTabSearchResult` | adds tab ID and tab label |

## Bookmarks

| Model | Required fields and role |
|---|---|
| `BookmarkRecord` | ID/name, workspace/file identity, target kind, exact source anchor, rendered preview, optional object identity, compatibility fields, timestamps |
| `BookmarkSourceAnchor` | Source start/end, fragment fingerprint, occurrence, prefix, and suffix context |
| `BookmarkResolution` | Exact resolved source range/object kind or `targetChanged` |
| `BookmarkDocument` | Versioned `{ version: 2, items }` persistence envelope with v1 migration |
| `OpenBookmarkWorkspace` | Open workspace group identity used by Focus/Tabs rendering |

## Workspace entry operations

| Model | Required fields and role |
|---|---|
| `WorkspaceEntryKind` | `'file' \| 'folder'` |
| `WorkspaceEntryFailureReason` | `'exists' \| 'invalid-name' \| 'outside-workspace' \| 'protected' \| 'missing' \| 'permission-denied' \| 'unsupported' \| 'failed'` |
| `WorkspaceEntryDeleteMode` | `'trash' \| 'permanent'` |
| `WorkspaceEntryCapability` | `{ create: boolean; deleteMode: WorkspaceEntryDeleteMode \| null }` derived from `appRuntime` and whether a workspace is open (`getWorkspaceEntryCapability`); `desktop`/`tauri`/`vscode` give `{ create: true, deleteMode: 'trash' }`, `chrome` gives `{ create: true, deleteMode: 'permanent' }`, no workspace gives `{ create: false, deleteMode: null }` |
| `CreateWorkspaceEntryMessage` | `command: 'createWorkspaceEntry'`, `requestId`, `parentPath` ('/'-separated, '' = root), `name`, `kind: WorkspaceEntryKind` |
| `DeleteWorkspaceEntriesMessage` | `command: 'deleteWorkspaceEntries'`, `requestId`, `paths: readonly string[]` |
| `CreateWorkspaceEntryResultMessage` | `command: 'createWorkspaceEntryResult'`, `requestId`, `ok`, optional `path`, `kind`, `reason`, `error` |
| `DeleteWorkspaceEntriesResultMessage` | `command: 'deleteWorkspaceEntriesResult'`, `requestId`, `mode: WorkspaceEntryDeleteMode`, `deleted: readonly string[]`, `failed: readonly { path; reason }[]` |

## Export Center and Scope View

| Model | Required fields and role |
|---|---|
| `ExportJob` | `source`: `ExportSourceSelection`, `format`: `'html' \| 'pdf' \| 'site'`, `layout`: `'document' \| 'explorer'`, `batchMode`: `'separate' \| 'merged'` |
| `ExportSourceSelection` | `scope`: `'current' \| 'selected' \| 'folder' \| 'workspace'`, optional `selectedPaths`, `folderPath` |
| `ExportDocumentItem` | `file`: `MdFile`, `sourceText`: string, `renderedHtml`: string, `title`: string, `toc`: TocEntry[], `frontmatter`: Frontmatter |
| `ScopeHistoryEntry` | `file`: `MdFile`, `title`: string, `sourceText`: string, `renderedHtml`: string, `toc`: TocEntry[] |
| `ScopeHistoryState` | `entries`: `ScopeHistoryEntry[]` (max 10), `currentIndex`: number |

## Shell and external launch

| Model | Required fields and role |
|---|---|
| `ExternalOpenRequest` | `mode`: `'file' \| 'folder' \| 'file-with-parent-workspace'`, `filePath`?: string, `folderPath`?: string |

## Preview and updates

| Model | Values |
|---|---|
| `DocumentPreviewInfo.kind` | converted or text |
| `DocumentPreviewInfo.qualityCode` | converted-preview, legacy-best-effort, conversion-failed |
| `UpdateState.status` | idle/downloading/downloaded/scheduled-on-exit/applying/error |

## Model rule

Paths are identities; labels/titles/aliases are presentation. Do not substitute one for another in host commands, tab keys, cache keys, or search routing.

## Rename and demo entry models

| Model | Fields and role |
|---|---|
| `RenameWorkspaceEntryMessage` | `command: 'renameWorkspaceEntry'`, `requestId`, `path`, `name`, `kind` |
| `RenameWorkspaceEntryResultMessage` | `command: 'renameWorkspaceEntryResult'`, `requestId`, `ok`, optional `oldPath`, `path`, `kind`, `reason`, `error` |
| `DeleteWorkspaceEntriesMessage.mode` | Optional `'trash' \| 'permanent'`; native hosts default to Trash |
| `DemoEntry` | `path`, `kind`, optional `source` referencing a bundled sample; persisted under `markdown-explorer.demo-workspace.v1` |

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/content.ts` | Active behavior or contract |
| Implementation | `ui/src/types/files.ts` | Active behavior or contract |
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/settings.ts` | Active behavior or contract |
| Implementation | `ui/src/themeTypes.ts` | Active behavior or contract |
| Implementation | `ui/src/bookmarks/types.ts` | Bookmark persistence and workspace group models |
| Implementation | `ui/src/workspace/workspaceEntryCapability.ts` | Workspace entry capability derived from the runtime |
| Implementation | `ui/src/export/exportModel.ts` | Export Center job, source, layout, and batch models |
| Implementation | `ui/src/components/Modal/scopeHistory.ts` | Scope View bounded history model |
| Verification | `tests/unit/ui/contexts/state-utils.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/components/content-tabs-pure.test.ts` | Automated expectation |
| Verification | `tests/node/bookmarks.test.mjs` | Bookmark model behavior and persisted shape |
| Verification | `tests/unit/ui/workspace/workspace-entry-capability.test.ts` | Capability per runtime, no-workspace, and simulated demo capabilities |
| Verification | `tests/unit/ui/components/scope-history.test.ts` | Scope history model tests |

---

[← Localization Catalog](10-localization-catalog.md) · [Documentation index](../README.md) · [Source Traceability Index →](12-source-traceability-index.md)
