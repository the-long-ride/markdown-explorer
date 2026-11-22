---
schema_version: 1
id: "feature.local-editing-and-split-view"
title: "Local Editing, Dirty State, and Split View"
kind: "feature"
status: "verified"
summary: "In-app source editing, dirty-buffer tracking and save flows, and synchronized side-by-side editor/preview split view."
tags: ["editor", "split-view", "dirty-state", "save", "scroll-sync"]
source_paths: ["ui/src/editor/NativeCloseGuardBridge.tsx", "ui/src/editor/documentSession.ts", "ui/src/editor/documentWorkingCopy.ts", "ui/src/editor/editingFeature.ts", "ui/src/editor/editorSessionStore.ts", "ui/src/editor/editorUx.ts", "ui/src/editor/inlineEdit.ts", "ui/src/editor/markdownFormatting.ts", "ui/src/editor/markdownHighlight.ts", "ui/src/editor/nativeCloseApproval.ts", "ui/src/editor/saveDocument.ts", "ui/src/editor/tableCellEditing.ts", "ui/src/editor/tableContextMenu.ts", "ui/src/editor/tableEditor.ts", "ui/src/editor/tableIcons.ts", "ui/src/editor/tableSelection.ts", "ui/src/editor/tableVisualPlugin.ts", "ui/src/editor/unsavedGuards.ts", "ui/src/editor/useDocumentConflictResolution.tsx", "ui/src/editor/useNativeCloseGuard.ts", "ui/src/editor/useUnsavedChangesGuard.tsx", "ui/src/split-view/documentRenderRevision.ts", "ui/src/split-view/paneSelectors.ts", "ui/src/split-view/paneState.ts", "ui/src/split-view/splitPointerDrag.ts", "ui/src/split-view/splitViewReducer.ts", "ui/src/split-view/usePaneRenderRevision.ts", "ui/src/split-view/useSplitDropHandler.ts"]
related_specs: ["architecture.ui-state-and-runtimes", "feature.markdown-rendering-and-tables", "feature.git-history-and-diff"]
last_doc_update_at: "2026-11-21T23:54:00Z"
last_verified_at: "2026-11-21T23:54:00Z"
last_verified_code_commit: "f068b48112d1e850767ce2d82c3234d9d2e64585"
last_source_change_commit: "c691d3b7344c8c7f3725fac69c468dfe9aceea79"
last_source_change_at: "2026-11-21T23:30:33Z"
source_fingerprint: "sha256:0402ccf196df878ad933d9dce143c982379cef08dbb3680daedcb756a38676df"
---

# Local Editing, Dirty State, and Split View

## Purpose and boundaries

Enables in-app source, inline, and visual-table editing of workspace Markdown and text files, caches CodeMirror editor sessions across tab/view transitions, tracks unsaved dirty buffers with conflict and native close guards, and provides a resizable split view with synchronized pane state. Out of scope: read-only mode when `markdownEditingEnabled` is disabled.

## Observable behavior

- **Editing availability**: `editingFeature.ts` (`isMarkdownEditingAvailable`, `isDocumentViewModeAllowed`) gates `'inline-edit'` and `'plain'` modes on `settings.markdownEditingEnabled === true`.
- **CodeMirror session caching & conflict reload**:
  - `editorSessionStore.ts` maintains an in-memory LRU cache (`MAX_EDITOR_SESSIONS = 15`) of `CachedEditorSession` records (`state`, `editableCompartment`, `wrapCompartment`, `scroll`) accessed via `getEditorSession`, `setEditorSession` (`setCachedEditorSession`), `clearEditorSession`, and `clearAllEditorSessions`.
  - `useDocumentConflictResolution.tsx` clears the cached CodeMirror session (`clearEditorSession(session.filePath)`) before dispatching `RESOLVE_DOCUMENT_CONFLICT_RELOAD` so reloading disk content never restores stale editor state, and dispatches `DOCUMENT_COMPARE_REQUEST_EVENT` (`markdown-explorer-document-compare-request`) when comparing conflicting buffers.
- **Source editing, formatting, syntax highlighting & UX preferences**:
  - Loads raw file text into the editor buffer (`documentSession.ts`, `documentWorkingCopy.ts`), tracks dirty state against disk content, and writes changes back via the runtime bridge (`saveDocument.ts`, `Cmd/Ctrl+S`) with conflict resolution (`useDocumentConflictResolution.tsx`) and unsaved/native close guards (`unsavedGuards.ts`, `useUnsavedChangesGuard.tsx`, `useNativeCloseGuard.ts`, `nativeCloseApproval.ts`, `NativeCloseGuardBridge.tsx`).
  - `markdownFormatting.ts` (`applyMarkdownFormat`, `parseMarkdownLinkSelection`, `applyMarkdownLink`) supports toggling inline wraps (`toggleWrap` for `bold` `**` and `inline-code` `` ` ``, `toggleItalic` for `*` without colliding with `**`, and `toggleUnderline` for `<u>...</u>`), toggling or inserting line prefixes (`heading-1`..`heading-6`, `quote`, `bullet-list`, `numbered-list`, `task-list` with `isSingleEmptyLine`/`formatEmptyLine` prefix insertion on empty cursor lines and `allMatch` prefix stripping when all selected non-empty lines already match), inserting fenced `code-block`, `table`, and YAML frontmatter `properties` blocks (`---\nname: "..."\n---`), and parsing/applying `[label](url)` links.
  - `editorUx.ts` resolves customizable editor keyboard shortcuts (`EDITOR_SHORTCUT_COMMANDS`, `EDITOR_FONT_SIZE_SHORTCUT_ACTIONS`, `DEFAULT_EDITOR_KEYBINDINGS`, `matchesEditorShortcut`, `formatCommandForChord`, `fontSizeActionForChord`, `isUndoChord`, `isRedoChord`, and platform-formatted labels via `getEditorCommandShortcutLabel` / `getEditorFontSizeShortcutLabel`), and persists plain-editor word wrap (`EDITOR_WORD_WRAP_STORAGE_KEY = 'markdown-explorer-plain-editor-wrap'`, default `true`) and clamped editor font size (`EDITOR_FONT_SIZE_STORAGE_KEY = 'markdown-explorer-editor-font-size'`, clamped to `8..32` px with default `14` and broadcasting `EDITOR_FONT_SIZE_EVENT`).
  - `inlineEdit.ts` provides block range splicing (`replaceMarkdownBlockRange`), heading anchor resolution (`anchorFor`), auto-sized textarea row calculation (`rowsFor`, clamped to `MIN_INLINE_ROWS = 3`..`MAX_INLINE_ROWS = 24`), table target detection (`isTableTarget` checking `.mdn-table-source` or `findTableRanges`), and immutable textarea undo/redo history (`INITIAL_TEXTAREA_HISTORY`, `pushTextareaSnapshot`, `undoTextareaStep`, `redoTextareaStep`).
  - `markdownHighlight.ts` defines `markdownCustomLanguageExtension` (`ListMark` -> `markdownListMarkTag` styled as `.cm-md-list-mark`) and theme-token-backed `markdownHighlightStyle` / `markdownSyntaxHighlighting`.
- **Interactive CodeMirror visual table editor (`tableEditor.ts`, `tableCellEditing.ts`, `tableVisualPlugin.ts`, `tableSelection.ts`, `tableContextMenu.ts`, `tableIcons.ts`)**:
  - `tableEditor.ts` detects, parses, and serializes pipe tables outside fenced code blocks (`findTableRanges` tracking the opening fence string `^\s*(\`{3,}|~{3,})` and closing via CommonMark `isClosingCodeFence` from `ui/src/markdown/parser.ts` so fences indented up to 3 spaces or shorter inner fence lines are handled accurately, `parseMarkdownTable`, `serializeMarkdownTable`, `splitPipeCells` respecting escaped `\|` and backtick code spans, `isPipeTableSeparator`, `buildCustomTable` clamped to `1..50` rows and `1..20` columns, and immutable table operations `insertRow`, `deleteRow`, `insertColumn`, `deleteColumn`, `updateCell`, `clearCells`, `tablesEqual`).
  - `tableCellEditing.ts` (`markdownCellToDisplayText`, `displayTextToMarkdownCell`, `getCellSelectionOffsets`, `setCellCaretOffset`, `applyCellShiftEnter`, `applyCellAltEnter`, `normalizeCellLiveInput`, `toggleCellBulletList`, `formatFocusedTableCell`, `handleTableCellKeyDown`, `focusTableCellAtEdge`, `createTableBoundaryKeymap`, `TABLE_CELL_COMMIT_EVENT`) converts `<br>` / `<br/>` and `<ul><li>...</li></ul>` to visual multi-line or `• ` bulleted text while masking inline backtick spans, serializes multi-line cells back to `<br>` and contiguous bullet runs (`• `, `- `, `* `, `+ `) into `<ul><li>...</li></ul>`, inserts line breaks or bullet continuations on `Shift+Enter`, inserts a blank line (or `• ` item) below the current line without splitting trailing text and moves the caret to the new line on `Alt+Enter`, normalizes live `- ` / `* ` line starts into `• `, formats focused `.cm-table-cell` elements for `bullet-list` and inline formatting (`bold`, `italic`, `underline`, `inline-code`), handles direct vertical `ArrowDown`/`ArrowUp` movement (`exitTableAbove` from headers, `exitTableToNewLine` from the last row), row-wrapping `Alt+ArrowLeft`/`Alt+ArrowRight` cell navigation, `Tab`/`Shift+Tab` traversal, and exports `createTableBoundaryKeymap` (`Prec.high` `ArrowDown` from the line immediately above into header cell `(−1, 0)`, `ArrowUp` from the line immediately below into the last cell, and `Backspace` from an empty line below into the last cell).
  - `tableVisualPlugin.ts` (`createTableVisualExtension`) replaces pipe table ranges in CodeMirror with interactive `TableWidget` block decorations (`[data-testid="cm-table-widget"]` with `data-table-from`) featuring a header bar with row/column dimensions (`formatTableDimensions`) and a per-table raw Markdown toggle (`toggleTableRawEffect`, `rawTableOffsetsField`, `RawTableBannerWidget`), `contentEditable` header (`data-row="-1"`) and body cells rendered via `createCell`, unmodified-cell blur preservation, focus preservation across widget rebuilds on navigation/commit (`TABLE_CELL_COMMIT_EVENT`), `isUndoChord`/`isRedoChord` forwarding to CodeMirror `undo`/`redo`, `clickBelowHandler`, and `createTableBoundaryKeymap(rawTableOffsetsField)`.
  - `tableSelection.ts` (`TableSelectionController`, `getRectangularRange`) manages mouse-drag, `Shift+Click`, `Ctrl/Cmd+Click`, and `Shift+Arrow` rectangular multi-cell selection (`.is-multi-selected`, persisted across widget rebuilds via a `WeakMap<EditorView, PersistedSelection>`), `Escape` selection clearing, and bulk cell clearing on `Backspace`/`Delete`.
  - `tableContextMenu.ts` (`showContextMenu`) and `tableIcons.ts` (`TABLE_ICON_PATHS`, `createSvgIcon`, `createTableGridIcon`) render the localized `.cm-table-context-menu` for row/column insertion and deletion, inserting a new line below the table, and toggling raw Markdown view.
- **Split view**: `ui/src/split-view/` manages side-by-side split pane state, pointer-drag divider ratios (`splitPointerDrag.ts`), drop handling (`useSplitDropHandler.ts`), and per-pane render revisions (`documentRenderRevision.ts`, `usePaneRenderRevision.ts`).

## Code map

- `ui/src/editor/editingFeature.ts`, `documentSession.ts`, `documentWorkingCopy.ts`, `editorSessionStore.ts`, `saveDocument.ts` — feature availability gate, editable session state and working copy management, LRU CodeMirror session store (`MAX_EDITOR_SESSIONS = 15`), and host save bridge.
- `ui/src/editor/markdownFormatting.ts`, `editorUx.ts`, `inlineEdit.ts`, `markdownHighlight.ts` — Markdown formatting commands (including `underline`, `properties`, link parsing, and toggleable wraps/lists/quotes/headings), customizable shortcut matching and word-wrap/font-size persistence, inline block editing and textarea undo/redo history, and Lezer/CodeMirror syntax highlighting.
- `ui/src/editor/tableEditor.ts`, `tableCellEditing.ts`, `tableVisualPlugin.ts`, `tableSelection.ts`, `tableContextMenu.ts`, `tableIcons.ts` — Markdown pipe-table parser/serializer and mutations, multi-line/bullet-list cell editing and keyboard boundary navigation, CodeMirror visual table widget and raw-table banner extension, multi-cell selection controller, right-click context menu, and SVG table action icons.
- `ui/src/editor/useDocumentConflictResolution.tsx`, `unsavedGuards.ts`, `useUnsavedChangesGuard.tsx`, `useNativeCloseGuard.ts`, `nativeCloseApproval.ts`, `NativeCloseGuardBridge.tsx` — external disk conflict detection/reload/compare flows and in-app/native window close guards for unsaved changes.
- `ui/src/split-view/splitViewReducer.ts`, `paneState.ts`, `paneSelectors.ts`, `splitPointerDrag.ts`, `documentRenderRevision.ts`, `usePaneRenderRevision.ts`, `useSplitDropHandler.ts` — split-pane reducer, pane state/selectors, divider pointer drag, render revision tracking, and drag-and-drop file opening into split panes.

## Verification

- Covered by `tests/unit/ui/editor/*.test.{ts,tsx}` (`document-session`, `editor-ux`, `inline-edit`, `markdown-formatting`, `markdown-highlight`, `table-editor`, `table-visual-plugin`, `save-document`, `conflict-*`, `unsaved-*`, `native-close-guard`) and `tests/unit/ui/split-view/*.test.{ts,tsx}`.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [Markdown Rendering, Media Embeds, and Interactive Data Tables](markdown-rendering-and-tables.md)
- [Git History and Diff Viewer](git-history-and-diff.md)

## Known limitations and open questions

- None found beyond settings-gated availability (`markdownEditingEnabled`).
