---
timestamp: '2026-08-05T06:40:23+07:00'
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
test_scope:
- tests/unit/ui/contexts/state-utils.test.ts
- tests/unit/ui/components/content-tabs-pure.test.ts
- tests/node/bookmarks.test.mjs
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
| `MdFile` / `FolderNode` | flat file identity and hierarchical workspace tree |

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

## Preview and updates

| Model | Values |
|---|---|
| `DocumentPreviewInfo.kind` | converted or text |
| `DocumentPreviewInfo.qualityCode` | converted-preview, legacy-best-effort, conversion-failed |
| `UpdateState.status` | idle/downloading/downloaded/scheduled-on-exit/applying/error |

## Model rule

Paths are identities; labels/titles/aliases are presentation. Do not substitute one for another in host commands, tab keys, cache keys, or search routing.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/content.ts` | Active behavior or contract |
| Implementation | `ui/src/types/files.ts` | Active behavior or contract |
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/settings.ts` | Active behavior or contract |
| Implementation | `ui/src/themeTypes.ts` | Active behavior or contract |
| Implementation | `ui/src/bookmarks/types.ts` | Bookmark persistence and workspace group models |
| Verification | `tests/unit/ui/contexts/state-utils.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/components/content-tabs-pure.test.ts` | Automated expectation |
| Verification | `tests/node/bookmarks.test.mjs` | Bookmark model behavior and persisted shape |

---

[← Localization Catalog](10-localization-catalog.md) · [Documentation index](../README.md) · [Source Traceability Index →](12-source-traceability-index.md)
