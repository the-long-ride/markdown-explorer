---
timestamp: '2026-08-05T13:14:00+07:00'
name: Source-Anchored Document Bookmarks
topic: Source-Anchored Document Bookmarks
document_type: specification
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../02-use-cases/UC-031-manage-bookmarks.md
source_scope:
- ui/src/bookmarks
- ui/src/utils/actionNotice.ts
- ui/src/components/Bookmarks
- ui/src/components/Content/useBookmarkSelection.ts
- ui/src/hooks/useBookmarkNavigation.ts
- ui/src/utils/bookmarkJump.ts
- ui/src/markdown/sourceMapping.ts
- ui/src/styles/global/global-bookmarks.css
- ui/src/styles/global/global-action-notice.css
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
keywords:
- bookmarks
- source range
- exact navigation
---

# Source-Anchored Document Bookmarks

## Feature intent

Provide an opt-in, local-first bookmark system for mixed Markdown selections and rendered objects. Persist source identity independently from the DOM so rerenders, repeated text, and modest edits do not redirect bookmarks to arbitrary matches.

## Component boundaries

| Unit | Responsibility |
|---|---|
| `types.ts` | Version-2 target, anchor, object identity, resolution, and workspace-group contracts. |
| `bookmarkModel.ts` | Migration, record creation, filtering/sorting/grouping, fingerprint/context resolver. |
| `bookmarkStore.ts` | Safe local persistence, read-back verification, subscription, CRUD, and atomic `removeMany`. |
| `bookmarkCommands.ts` | Verified save/rename commands with explicit target/storage failure results. |
| `bookmarkDefaultName.ts` | Mermaid entrypoint extraction for concise default diagram bookmark names. |
| `sourceMapping.ts` | Frontmatter-aware body/source offset mapping for parser tokens. |
| `bookmarkDomAnchors.ts` | Markdown projection, mixed DOM Range mapping, and whole-object source lookup. |
| `useBookmarkSelection.ts` | Selection/object right-click capture and menu lifecycle. |
| `useBookmarkNavigation.ts` | Workspace/file validation and bookmark-specific jump queue. |
| `bookmarkJump.ts` | Exact metadata lookup, scrolling, and transient highlight cleanup. |
| `actionNotice.ts` | Shared neutral/success/error notice event used by content and sidebar actions. |
| `BookmarksPanel.tsx` | Grouping, search, sorting, count, selection mode, batch deletion, menus, dialogs. |

## Data contract

```typescript
interface BookmarkSourceAnchor {
  start: number;
  end: number;
  fragment: string;
  fingerprint: string;
  occurrence: number;
  prefix: string;
  suffix: string;
}

type BookmarkTargetKind = 'text' | 'code' | 'math' | 'mermaid' | 'image' | 'link';

type BookmarkResolution =
  | { status: 'resolved'; sourceStart: number; sourceEnd: number; occurrence: number; kind: BookmarkTargetKind }
  | { status: 'targetChanged' };
```

`BookmarkRecord` additionally stores ID/name, workspace and file identity, rendered preview, optional math/Mermaid/URL/label/alt identity, compatibility fields, and timestamps.

## Persistence contract

- Storage key remains `markdown-explorer-bookmarks-v1` so existing installations are discovered.
- Document envelope is `{ version: 2, items: BookmarkRecord[] }`.
- Version-1 records migrate deterministically and idempotently.
- Unknown/corrupt data becomes an empty version-2 snapshot.
- Disabling the feature never clears the store.
- `removeMany(ids)` calculates and writes one next snapshot.
- Save and rename use verified persistence: the serialized snapshot is read back before the store publishes success. Silent or throwing storage failures leave the in-memory snapshot unchanged and return `storage-unavailable`.

## Renderer and capture contract

Block roots expose exact source offsets. Inline math/code/images/links expose target kind and identity. Mermaid wrappers retain source range and diagram source through enhancement. A selection may cross multiple rendered blocks; start/end roots map independently and produce one continuous source slice. The display preview removes formatting noise while the anchor preserves authored Markdown markers.

Whole-object capture applies when there is no broader selection:

- LaTeX: exact inline/display expression;
- Mermaid: exact fenced source block; the default name uses the Mermaid entrypoint node or first participant;
- image: exact source occurrence, URL, and alt;
- link: exact source occurrence, URL, and label, without altering normal left-click; the existing link context menu opens the naming dialog directly and never opens a redundant bookmark submenu;
- code: exact inline/fenced code object.

## Resolution contract

1. Exact range and fingerprint.
2. One exact fragment with compatible context.
3. Multiple fragments scored by prefix/suffix context and distance.
4. Saved occurrence for objects or context-free anchors.
5. Safe compatibility fallback.
6. `targetChanged` when confidence is insufficient.

A unique fragment with stored context is not accepted when that context has no meaningful overlap. This prevents a same-word occurrence elsewhere from being treated as the saved target.

## UI contract

- Three-tab sidebar uses a wider Bookmarks column and a 300px feature-enabled minimum width.
- Active Bookmarks tab shows saved count in the header.
- Search row aligns with Files/Search; actions use a second row.
- Batch selection reveals checkboxes and one warning confirmation dialog.
- Group rows use the shared SVG chevron behavior.
- Supplied bookmark and edit SVG paths use `currentColor`.
- Shortcut opens Bookmarks or focuses the disabled setting.
- Every new label is represented in all nine locale records.
- Successful save/rename actions show a translated green success toast; target or storage failures show a translated red error toast with the reason.
- Sidebar tabs fit icon-and-label content, share one animated indicator, and use one panel transition. Bookmark actions are icon-only where specified and expose translated tooltips.

## Verification contract

| Suite | Proof |
|---|---|
| `bookmark-source-anchor-model.test.mjs` | Migration, mixed source, repeated occurrences, edit relocation, ambiguity, objects, atomic delete |
| `bookmark-source-metadata.test.mjs` | Parser/renderer metadata and DOM/source projection |
| `bookmark-interactions.test.mjs` | Selection/object/link menus and lifecycle |
| `bookmark-navigation.test.mjs` | Exact offsets, object jumps, and target-changed behavior |
| `bookmark-sidebar-ui.test.mjs` | Width/count/icons/chevrons/batch operations |
| `bookmark-shortcut-settings.test.mjs` | Platform defaults, routing, setting focus, warning reset style |
| `bookmark-save-feedback.test.mjs` | Verified image/link saves, Mermaid entrypoint names, rename verification, direct-dialog flow, translated success/error feedback |
| `bookmarks.test.mjs` | Compatibility, storage, UI wiring, localization, coverage ownership |

---

[← Performance, Incremental Work, and Enhancement Scheduling](20-performance-enhancement-scheduling.md) · [Documentation index](../README.md) · [Electron Desktop Runtime →](../04-runtimes/01-electron-desktop.md)
