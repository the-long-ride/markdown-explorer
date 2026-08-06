---
timestamp: '2026-08-05T13:14:00+07:00'
name: Save and Navigate Source-Anchored Bookmarks
topic: Use case UC-031
document_type: use-case
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../03-features/21-bookmarks.md
source_scope:
- ui/src/bookmarks/bookmarkModel.ts
- ui/src/bookmarks/bookmarkStore.ts
- ui/src/bookmarks/bookmarkCommands.ts
- ui/src/bookmarks/bookmarkDefaultName.ts
- ui/src/bookmarks/bookmarkDomAnchors.ts
- ui/src/components/Bookmarks/BookmarksPanel.tsx
- ui/src/components/Content/useBookmarkSelection.ts
- ui/src/hooks/useBookmarkNavigation.ts
- ui/src/utils/bookmarkJump.ts
test_scope:
- tests/node/bookmarks.test.mjs
- tests/node/bookmark-source-anchor-model.test.mjs
- tests/node/bookmark-source-metadata.test.mjs
- tests/node/bookmark-interactions.test.mjs
- tests/node/bookmark-navigation.test.mjs
- tests/node/bookmark-sidebar-ui.test.mjs
- tests/node/bookmark-shortcut-settings.test.mjs
- tests/node/bookmark-save-feedback.test.mjs
runtime_scope:
- shared
- electron/tauri-tabs
- focus-view-hosts
keywords:
- UC-031
- bookmarks
- source anchors
- objects
---

# Save and Navigate Source-Anchored Bookmarks

## Purpose

Let users save a named, persistent target from mixed Markdown text or a rendered object and return to the exact saved occurrence without silently choosing a duplicate.

| Property | Specification |
|---|---|
| Use-case ID | `UC-031` |
| Trigger | Enable **Enable Bookmark feature**, then right-click a selection, LaTeX formula, Mermaid diagram, image, code object, or link. |
| Preconditions | A rendered local document and `bookmarksEnabled=true`. |
| Success result | A version-2 bookmark is stored and later resolves to the exact source range/object. |
| Safe failure | Low-confidence relocation returns **Target changed** and does not scroll. |
| Scope exclusion | Cloud synchronization and opening closed Tabs-view workspaces automatically. |

## Capture flow

1. Text selection may cross lines, bold, italic, underline, strikethrough, inline/fenced code, symbols, links, and math.
2. Browser range boundaries map through `data-mdn-source-start`/`data-mdn-source-end` metadata to one continuous Markdown source range.
3. With no broader selection, right-click captures the complete LaTeX, Mermaid, image, code, or link object.
4. Link left-click behavior remains unchanged; its existing right-click menu gains **Add to saved bookmarks**.
5. The naming dialog defaults to a concise one-line rendered preview and rejects blank names; Mermaid diagrams use their entrypoint node or first participant as the default name.
6. Image and link actions open this dialog directly from their existing context menu, without a redundant second bookmark menu.
7. Saving performs verified persistence by writing and reading back one version-2 record in `markdown-explorer-bookmarks-v1`.
8. A translated green success toast confirms save; a translated red error toast identifies unavailable targets or storage failures. Rename uses the same verification and feedback contract.

## Exact navigation flow

1. Resolve the open workspace and verify the file remains available.
2. Resolve exact range/fingerprint first, then context-preserved relocation, object identity/occurrence, and safe legacy fallback.
3. Activate the matching open workspace tab when Tabs view is active.
4. Open the file, wait for rendering, find the element/range containing the resolved source offsets, and center it.
5. Apply a transient search-style highlight for text or themed outline for an object.
6. When the source changed ambiguously, show the translated target-changed notice and leave the viewport untouched.

A bookmark on the third of ten identical `Hello` values records occurrence `2` and returns to that saved source occurrence unless later context provides a stronger unambiguous relocation.

## Sidebar behavior

| Mode | Required behavior |
|---|---|
| Tabs | Group by every open workspace; current workspace starts expanded; other groups start collapsed; Expand/Collapse All is available. |
| Focus | Flat list for the current workspace only. |
| Selection mode | Show checkboxes, track a transient checked set, and enable **Delete selected** only when at least one item is checked. |
| Feature disabled | Hide capture/tab UI while retaining all stored records. |

The active Bookmarks header shows the visible saved count. Search occupies the first toolbar row. Sort, group controls, selection toggle, and batch deletion occupy the second row. Three-dot and right-click item menus retain Go, Edit name, and Delete.

## Keyboard and settings

- Desktop app variants: `Ctrl+Shift+B`.
- Other variants: `Alt+Shift+B`.
- Enabled feature: expand/select Bookmarks.
- Disabled feature: open Settings focused on **Enable Bookmark feature**.
- The setting description explains multiline/mixed-format text and complete LaTeX, Mermaid, image, and link targets.

## Persistence and migration

`BookmarkRecord` stores workspace/file identity, `targetKind`, exact `sourceAnchor`, readable preview, optional object identity, compatibility fields, and timestamps. Version-1 records migrate deterministically to version 2. Corrupt/unknown documents fall back to `{ version: 2, items: [] }`. Batch deletion persists one atomic snapshot.

## Failure flows

| Condition | Required behavior |
|---|---|
| Workspace not open | Translated workspace-unavailable notice. |
| File unavailable | Translated file-unavailable notice. |
| Exact target changed ambiguously | Translated target-changed notice; no wrong jump. |
| Invalid selection/name | Do not save; show translated red error toast when invoked from an object action. |
| Storage write/read-back mismatch | Return `storage-unavailable`, retain the previous snapshot, and show translated red error toast. |
| Corrupt storage | Load empty v2 document without blocking startup. |

## Acceptance criteria

- [x] Mixed-format and multiline selections save as one source-anchored target.
- [x] Whole LaTeX, Mermaid, image, code, and link objects can be bookmarked with verified save results.
- [x] Mermaid entrypoint naming, direct image/link dialogs, and green success/red error toast feedback are covered.
- [x] Repeated content resolves to the exact saved occurrence.
- [x] Batch selection/delete performs one store write.
- [x] Tabs/Focus scopes, count, search, sorting, menus, and dialogs remain themed.
- [x] Shortcut and all visible strings exist across nine locales.
- [x] Dependency-light model, metadata, interaction, navigation, sidebar, and shortcut tests cover the behavior.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Model | `ui/src/bookmarks/types.ts`, `bookmarkModel.ts` | v2 schema, migration, creation, relocation |
| Mapping | `ui/src/markdown/sourceMapping.ts`, `ui/src/bookmarks/bookmarkDomAnchors.ts` | Source offsets and DOM capture |
| Interaction | `ui/src/components/Content/useBookmarkSelection.ts`, `ui/src/components/shared/LinkContextMenu.tsx` | Text/object context actions |
| Navigation | `ui/src/hooks/useBookmarkNavigation.ts`, `ui/src/utils/bookmarkJump.ts` | Exact routing and highlight |
| UI | `ui/src/components/Bookmarks/*`, `ui/src/styles/global/global-bookmarks.css` | Sidebar, dialogs, icons, batch operations |
| Verification | `tests/node/bookmark-*.test.mjs`, `tests/node/bookmarks.test.mjs` | Feature and regression contracts |

---

[← Copy, Edit, Open in Browser, and Export Content](UC-030-copy-edit-browser-snapshot.md) · [Documentation index](../README.md) · [Workspace Selection and Application Shell →](../03-features/01-workspace-selection-shell.md)
