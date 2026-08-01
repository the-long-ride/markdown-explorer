---
timestamp: '2026-08-01T22:54:00+07:00'
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
test_scope:
- tests/unit/ui/contexts/state-utils.test.ts
- tests/unit/ui/components/content-tabs-pure.test.ts
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
| Verification | `tests/unit/ui/contexts/state-utils.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/components/content-tabs-pure.test.ts` | Automated expectation |

---

[← Localization Catalog](10-localization-catalog.md) · [Documentation index](../README.md) · [Source Traceability Index →](12-source-traceability-index.md)
