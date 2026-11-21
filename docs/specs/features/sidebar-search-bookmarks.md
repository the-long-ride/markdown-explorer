---
schema_version: 1
id: "feature.sidebar-search-bookmarks"
title: "Sidebar Navigation, File Tree, Search, and Bookmarks"
kind: "feature"
status: "verified"
summary: "File tree explorer, document heading outline, full-text and fuzzy search, and bookmark management in the primary sidebar."
tags: ["sidebar", "file-tree", "search", "bookmarks", "outline", "navigation"]
source_paths: ["ui/src/bookmarks/bookmarkCommands.ts", "ui/src/bookmarks/bookmarkDefaultName.ts", "ui/src/bookmarks/bookmarkDomAnchors.ts", "ui/src/bookmarks/bookmarkModel.ts", "ui/src/bookmarks/bookmarkStore.ts", "ui/src/bookmarks/types.ts", "ui/src/bookmarks/useBookmarks.ts", "ui/src/components/Bookmarks/BookmarkBatchDeleteDialog.tsx", "ui/src/components/Bookmarks/BookmarkDialog.tsx", "ui/src/components/Bookmarks/BookmarkIcons.tsx", "ui/src/components/Bookmarks/BookmarkItemMenu.tsx", "ui/src/components/Bookmarks/BookmarkSelectionMenu.tsx", "ui/src/components/Bookmarks/BookmarksPanel.tsx", "ui/src/components/Search/FindInFilePanel.tsx", "ui/src/components/Search/SearchDocumentPreview.tsx", "ui/src/components/Search/SearchOverlay.tsx", "ui/src/components/Search/SearchOverlayResults.tsx", "ui/src/components/Search/SearchOverlayWorkspaceList.tsx", "ui/src/components/Search/searchOverlayModel.tsx", "ui/src/components/Search/useSearchOverlayResize.ts", "ui/src/components/Sidebar/FileNode.tsx", "ui/src/components/Sidebar/Sidebar.tsx", "ui/src/components/Sidebar/SidebarConfirmDialog.tsx", "ui/src/components/Sidebar/SidebarDeleteDialog.tsx", "ui/src/components/Sidebar/SidebarEntryRenameInput.tsx", "ui/src/components/Sidebar/SidebarFilesActions.tsx", "ui/src/components/Sidebar/SidebarInlineEntryInput.tsx", "ui/src/components/Sidebar/SidebarItemMenu.tsx", "ui/src/components/Sidebar/SidebarScopeControls.tsx", "ui/src/components/Sidebar/SidebarSearch.tsx", "ui/src/components/Sidebar/SidebarSelectionActions.tsx", "ui/src/components/Sidebar/SidebarSortMenu.tsx", "ui/src/components/Sidebar/SidebarTabsHeader.tsx", "ui/src/components/Sidebar/SidebarTreeCheckboxes.tsx", "ui/src/components/Sidebar/TreeNode.tsx", "ui/src/components/Sidebar/sidebarActiveFolders.ts", "ui/src/components/Sidebar/sidebarEntryIcons.tsx", "ui/src/components/Sidebar/sidebarItemMenuItems.tsx", "ui/src/components/Sidebar/sidebarItemMenuPosition.ts", "ui/src/components/Sidebar/sidebarPinIcons.tsx", "ui/src/components/Sidebar/sidebarRenameIcon.tsx", "ui/src/components/Sidebar/sidebarSearchResultTree.ts", "ui/src/components/Sidebar/sidebarSearchScope.ts", "ui/src/components/Sidebar/sidebarSearchTree.tsx", "ui/src/components/Sidebar/sidebarTabs.ts", "ui/src/components/Sidebar/sidebarTreeContext.ts", "ui/src/components/Sidebar/sidebarTreeFiltering.ts", "ui/src/components/Sidebar/sidebarTreeModel.ts", "ui/src/components/Sidebar/sidebarTreeOrdering.ts", "ui/src/components/Sidebar/sidebarWorkspacePreferences.ts", "ui/src/components/Sidebar/useFolderExpansionCommand.ts", "ui/src/components/Sidebar/useLocateActiveFile.ts", "ui/src/components/Sidebar/useSidebarCursorNavigation.ts", "ui/src/components/Sidebar/useSidebarEntryActions.tsx", "ui/src/components/Sidebar/useSidebarEntryCreation.ts", "ui/src/components/Sidebar/useSidebarEntryDeletion.ts", "ui/src/components/Sidebar/useSidebarFileOps.tsx", "ui/src/components/Sidebar/useSidebarPinnedSorting.ts", "ui/src/components/Sidebar/useSidebarScopeFocus.ts", "ui/src/components/Sidebar/useSidebarSelectionMode.ts", "ui/src/components/TOC/TableOfContents.tsx"]
related_specs: ["architecture.ui-state-and-runtimes", "feature.markdown-rendering-and-tables", "feature.git-history-and-diff"]
last_doc_update_at: "2026-11-21T22:29:00Z"
last_verified_at: "2026-11-21T22:29:00Z"
last_verified_code_commit: "f0818d86f926ee15c5508b3bc186e1ddf18f50b8"
last_source_change_commit: "dde19b3e52ed8be2afbf56416a42373871a06301"
last_source_change_at: "2026-11-18T04:36:06+07:00"
source_fingerprint: "sha256:2f4ea4fe0baa52dbdb6e9618c3c0b2c20ae6b8f66847005259d0bbf2dd083910"
---

# Sidebar Navigation, File Tree, Search, and Bookmarks

## Purpose and boundaries

Provides the left sidebar navigation surface across desktop (`electron`, `tauri`), `vscode`, and `web` runtimes: recursive workspace file tree with filtering and sorting, active-document and revision-snapshot heading outline, workspace-wide text/fuzzy search, and persistent bookmarks. Out of scope: document body rendering, Git history snapshot rendering (`feature.git-history-and-diff`), and export pipelines.

## Observable behavior

- **Memoized file tree & entry context (`Sidebar.tsx`, `FileNode.tsx`, `TreeNode.tsx`, `sidebarTreeContext.ts`)**:
  - Renders nested folders and supported documents (`md`, `csv`, `tsv`, `json`, `txt`, etc.), supports expand/collapse all, active-file reveal, pinning/sorting, and file creation/rename/delete actions.
  - `FileNode` and `FolderNodeView` are memoized (`React.memo`) and read `currentFile`, `showTitle`, and `navigate` from `SidebarTreeEntryContext` (`treeEntryContextValue` memoized in `Sidebar.tsx`, with `useResolvedSidebarTreeEntry()` falling back to `useAppState()` when rendered standalone), preventing unrelated `AppState` updates from re-rendering every tree row.
  - Native `title` attributes across tree rows, pin badges, item menu buttons, sort status badges, and bookmark group headers are migrated to `data-hover-tooltip` portals.
- **Runtime-aware sidebar actions & item menus (`Sidebar.tsx`, `SidebarTabsHeader.tsx`, `SidebarItemMenu.tsx`, `sidebarItemMenuItems.tsx`, `sidebarEntryIcons.tsx`, `useSidebarEntryDeletion.ts`)**:
  - Gates History tab and file-revision item menu availability to `!isWebRuntime()` (`window.__webBus`, showing `(Web unavailable)` and guarding disabled clicks in `SidebarItemMenu.tsx`), and exposes typed 9-locale `t.sidebar.downloadFile`, `t.sidebar.downloadFolderZip`, and `t.sidebar.downloadWorkspaceZip` (`DownloadIcon`) actions in web mode.
  - Adds **Copy Relative Path** (`copy-relative-path`) and **Copy Full Path** (`copy-full-path`) item-menu actions that copy via `bridge.copyToClipboard` (with `navigator.clipboard` fallback) and dispatch `markdown-explorer-action-notice`.
  - `useSidebarEntryDeletion.ts` discards dirty buffers and closes deleted tabs across hosts (checking `state.appRuntime !== 'web'` for workspace-match guarding).
- **Workspace search & jump across live and revision snapshot modes (`Sidebar.tsx`, `SidebarSearch.tsx`, `sidebarSearchTree.tsx`, `SearchDocumentPreview.tsx`, `SearchOverlayResults.tsx`, `SearchOverlayWorkspaceList.tsx`)**:
  - **Live workspace jump (`sidebarSearchTree.tsx`)**: Clicking a match dispatches `search-jump` with `{ filePath, query, matchOrdinal, matchIndex, lineNumber, excerpt, matchCase }` and skips redundant `navigate(file.fsPath)` calls when the target file is already the active live loaded document (including the active split-view pane, compared via `normalizePathKey` when `!isLoading && !notFoundHref && !staleContentFilePath && Boolean(contentHtml)`). Match rows and file headers render right-docked `data-hover-tooltip` hints.
  - **Revision snapshot search (`Sidebar.tsx`, `SidebarSearch.tsx`)**: When browsing a Git revision snapshot, `Sidebar.tsx` constructs a referentially stable `revisionSearch` via `createRevisionSidebarSearch(repositoryView, () => activeSnapshotPathRef.current, searchRevision, openSnapshotFile)` (from `ui/src/utils/snapshotSearchJump.ts`, avoiding re-running commit search when switching active snapshot files); clicking a regular file in revision mode clears any pending jump via `clearPendingSnapshotSearchJump()`. `RevisionSidebarSearch` supports `openResult?(match, query, matchCase)` (with fallback to optional `openPath?`), which queues a snapshot search jump with `lineNumber`, `excerpt`, and 0-based `matchOrdinal` and avoids reloading the active snapshot file. Live workspace jumps triggered while in revision mode coordinate with `useAppSearchEffects.ts` (`architecture.ui-state-and-runtimes`) to call `returnToHead()` before opening/scrolling the live file.
  - **Search overlay & preview (`SearchDocumentPreview.tsx`, `SearchOverlayResults.tsx`, `SearchOverlayWorkspaceList.tsx`)**: Cross-workspace `SearchOverlay` (`scope === 'all-tabs'`) is gated to desktop multi-workspace mode (`openWorkspaceTabs.length >= 2`); invoking it with one workspace tab focuses the primary sidebar Search tab (`openSidebarSearch()`). `SearchDocumentPreview` forwards `{ lineNumber, excerpt }` to `scrollToRenderedSearchMatchInRoot()` when `item.lineNumber !== undefined` (and omits the retired `__chromeExtBus` column-menu workaround). `SearchOverlayResults` adds bottom `data-hover-tooltip` path cues (`tabLabel • relativePath` for cross-tab items), and `SearchOverlayWorkspaceList` uses `.search-overlay-workspace__checkbox` with `data-hover-tooltip`.
- **Table of Contents (`TableOfContents.tsx`)**:
  - Supports both `'panel'` and `'compact'` variants with left-docked `data-hover-tooltip` portals (`data-hover-tooltip-pos="left"`), explicit `entries?: readonly TocEntry[]`, `rootId?: DocumentRootId` (e.g., `rootId="snapshot"` for Git History commit snapshots), and `documentKey?: string | number`.
  - `useActiveTocId` subscribes to `subscribeDocumentRoots()` (`ui/src/document/activeDocumentRoot.ts`) so scroll/resize active-heading listeners reattach automatically whenever the targeted document root mounts or changes, and compact menu state resets when `state.currentFile` or `documentKey ?? state.renderVersion` changes.
- **Scope controls, tab shortcuts & keyboard-accessible dialogs (`SidebarScopeControls.tsx`, `SidebarTabsHeader.tsx`, `sidebarTabs.ts`, `SidebarConfirmDialog.tsx`, `BookmarkDialog.tsx`, `BookmarkBatchDeleteDialog.tsx`, `BookmarksPanel.tsx`)**:
  - `Sidebar.tsx` passes enabled `openFiles` (`Ctrl+Shift+E`), `searchCurrent`, and `openBookmarks` keybindings via `buildVisibleSidebarTabs` (`sidebarTabs.ts`) to `SidebarTabsHeader.tsx` (`TooltipButton` `shortcut`), aligning the first tab tooltip left and the last right so keycaps do not clip.
  - `SidebarScopeControls` accepts optional `narrowed?: boolean`, applies `.is-scope-narrowed` / `data-scope-narrowed="true"`, and shows localized `applyScopeFocus` bottom tooltip while editing an active focus scope.
  - `BookmarkDialog`, `BookmarkBatchDeleteDialog`, and `SidebarConfirmDialog` wire Escape/Enter keyboard shortcuts via `useDialogKeyboard` (`SidebarConfirmDialog` also avoids confirming on Enter when Cancel or another non-confirm button has focus).

## Code map

- `ui/src/components/Sidebar/` — sidebar shell (`Sidebar.tsx`), memoized tree/file nodes (`FileNode.tsx`, `TreeNode.tsx`, `sidebarTreeContext.ts`), item menus (`SidebarItemMenu.tsx`, `sidebarItemMenuItems.tsx`, `sidebarEntryIcons.tsx`), `SidebarSearch.tsx` & `sidebarSearchTree.tsx` (live + revision jump payload), `SidebarTabsHeader.tsx` & `sidebarTabs.ts`, `SidebarScopeControls.tsx`, `SidebarConfirmDialog.tsx`, and entry creation/deletion hooks.
- `ui/src/components/Search/` — `SearchOverlay.tsx`, `SearchOverlayResults.tsx`, `SearchOverlayWorkspaceList.tsx`, `SearchDocumentPreview.tsx`, `FindInFilePanel.tsx`, and search overlay model/resize hooks.
- `ui/src/components/Bookmarks/` & `ui/src/bookmarks/` — bookmark store, commands, DOM anchors, keyboard-accessible dialogs (`BookmarkDialog.tsx`, `BookmarkBatchDeleteDialog.tsx`), and `BookmarksPanel.tsx`.
- `ui/src/components/TOC/TableOfContents.tsx` — active-document and `rootId`-scoped (e.g., `'snapshot'`) heading outline with `subscribeDocumentRoots` reactivity.

## Verification

- Verified by `tests/unit/ui/history/snapshot-search-jump.test.tsx`, `tests/unit/ui/history/repository-snapshot-content.test.tsx`, `tests/unit/ui/searchJump-regression.test.ts`, `tests/unit/ui/components/` (`toc-render.test.tsx`, `sidebar-render.test.tsx`, `sidebar-item-menu.test.tsx`, `sidebar-scope-controls.test.tsx`, `sidebar-tabs-header.test.tsx`, `sidebar-tree-entry-context.test.tsx`, `sidebar-webdemo-download.test.tsx`, `sidebar-file-ops.test.tsx`, `dialog-keyboard-accessibility.test.tsx`), `tests/unit/ui/workspace/workspace-entry-capability.test.ts`, and `tests/node/bookmarks.test.mjs`.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [Markdown Rendering, Media Embeds, and Interactive Data Tables](markdown-rendering-and-tables.md)
- [Git History and Diff Viewer](git-history-and-diff.md)

## Known limitations and open questions

- Recursive workspace search depth and speed depend on the underlying runtime bridge's file-reading throughput; in revision mode, search operates over the checked-out commit tree via `searchRevision` without live scope-focus filtering.
