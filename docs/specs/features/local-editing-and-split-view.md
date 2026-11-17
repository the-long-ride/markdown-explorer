---
schema_version: 1
id: "feature.local-editing-and-split-view"
title: "Local Editing, Dirty State, and Split View"
kind: "feature"
status: "verified"
summary: "In-app source editing, dirty-buffer tracking and save flows, and synchronized side-by-side editor/preview split view."
tags: ["editor", "split-view", "dirty-state", "save", "scroll-sync"]
source_paths: ["ui/src/editor/NativeCloseGuardBridge.tsx", "ui/src/editor/documentSession.ts", "ui/src/editor/documentWorkingCopy.ts", "ui/src/editor/editingFeature.ts", "ui/src/editor/editorSessionStore.ts", "ui/src/editor/editorUx.ts", "ui/src/editor/inlineEdit.ts", "ui/src/editor/markdownFormatting.ts", "ui/src/editor/markdownHighlight.ts", "ui/src/editor/nativeCloseApproval.ts", "ui/src/editor/saveDocument.ts", "ui/src/editor/tableContextMenu.ts", "ui/src/editor/tableEditor.ts", "ui/src/editor/tableIcons.ts", "ui/src/editor/tableSelection.ts", "ui/src/editor/tableVisualPlugin.ts", "ui/src/editor/unsavedGuards.ts", "ui/src/editor/useDocumentConflictResolution.tsx", "ui/src/editor/useNativeCloseGuard.ts", "ui/src/editor/useUnsavedChangesGuard.tsx", "ui/src/split-view/documentRenderRevision.ts", "ui/src/split-view/paneSelectors.ts", "ui/src/split-view/paneState.ts", "ui/src/split-view/splitPointerDrag.ts", "ui/src/split-view/splitViewReducer.ts", "ui/src/split-view/usePaneRenderRevision.ts", "ui/src/split-view/useSplitDropHandler.ts"]
related_specs: ["architecture.ui-state-and-runtimes", "feature.markdown-rendering-and-tables"]
last_doc_update_at: "2026-11-16T09:05:00Z"
last_verified_at: "2026-11-16T09:05:00Z"
last_verified_code_commit: "67cbd21d100886bc1a8458636c968092ff30d72f"
last_source_change_commit: "4f38b2dbe45fbc969157f60247d6fbd1d1b32734"
last_source_change_at: "2026-11-12T17:46:34+07:00"
source_fingerprint: "sha256:e7b716c6e70e82e997c1da45a8890e6591eccc4096ac255b23be9c3031b56001"
---

# Local Editing, Dirty State, and Split View

## Purpose and boundaries

Enables in-app source and inline editing of workspace Markdown and text files, tracks unsaved dirty buffers with conflict and native close guards, and provides a resizable split view with synchronized pane state. Out of scope: read-only static web demo mode when `markdownEditingEnabled` is disabled.

## Observable behavior

- **Editing availability**: `editingFeature.ts` (`isMarkdownEditingAvailable`, `isDocumentViewModeAllowed`) gates `'inline-edit'` and `'plain'` modes on `settings.markdownEditingEnabled === true`.
- **Source editing, formatting & save**: Loads raw file text into the editor buffer (`documentSession.ts`, `documentWorkingCopy.ts`), supports line/selection formatting (`markdownFormatting.ts`, including `isSingleEmptyLine`/`formatEmptyLine` prefix insertion for `bullet-list`, `numbered-list`, `task-list`, `quote`, and `heading-*` on empty cursor lines without selection), tracks dirty state against disk content, and writes changes back via the runtime bridge (`saveDocument.ts`, `Cmd/Ctrl+S`) with conflict resolution (`useDocumentConflictResolution.tsx`) and unsaved/native close guards (`useUnsavedChangesGuard.tsx`, `useNativeCloseGuard.ts`).
- **Split view**: `ui/src/split-view/` manages side-by-side split pane state, pointer-drag divider ratios (`splitPointerDrag.ts`), drop handling (`useSplitDropHandler.ts`), and per-pane render revisions (`usePaneRenderRevision.ts`).

## Code map

- `ui/src/editor/` — `editingFeature.ts`, `documentSession.ts`, `documentWorkingCopy.ts`, `editorSessionStore.ts`, `saveDocument.ts`, `tableEditor.ts`, `tableVisualPlugin.ts`, `useDocumentConflictResolution.tsx`, `useNativeCloseGuard.ts`, `useUnsavedChangesGuard.tsx`
- `ui/src/split-view/` — `splitViewReducer.ts`, `paneState.ts`, `paneSelectors.ts`, `splitPointerDrag.ts`, `usePaneRenderRevision.ts`, `useSplitDropHandler.ts`

## Verification

- Covered by `tests/unit/ui/editor/` and `tests/unit/ui/components/` tests for editor dirty-state transitions, markdown formatting, table editor/visual plugin, and split-view behavior.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [Markdown Rendering and Data Tables](markdown-rendering-and-tables.md)
- [Git History and Diff Viewer](git-history-and-diff.md)

## Known limitations and open questions

- None found beyond settings-gated availability (`markdownEditingEnabled`).
