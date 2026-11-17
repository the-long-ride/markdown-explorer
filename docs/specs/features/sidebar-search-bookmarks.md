---
schema_version: 1
id: "feature.sidebar-search-bookmarks"
title: "Sidebar Navigation, File Tree, Search, and Bookmarks"
kind: "feature"
status: "verified"
summary: "File tree explorer, document heading outline, full-text and fuzzy search, and bookmark management in the primary sidebar."
tags: ["sidebar", "file-tree", "search", "bookmarks", "outline", "navigation"]
source_paths: ["ui/src/bookmarks/bookmarkCommands.ts", "ui/src/bookmarks/bookmarkDefaultName.ts", "ui/src/bookmarks/bookmarkDomAnchors.ts", "ui/src/bookmarks/bookmarkModel.ts", "ui/src/bookmarks/bookmarkStore.ts", "ui/src/bookmarks/types.ts", "ui/src/bookmarks/useBookmarks.ts", "ui/src/components/Bookmarks/BookmarkBatchDeleteDialog.tsx", "ui/src/components/Bookmarks/BookmarkDialog.tsx", "ui/src/components/Bookmarks/BookmarkIcons.tsx", "ui/src/components/Bookmarks/BookmarkItemMenu.tsx", "ui/src/components/Bookmarks/BookmarkSelectionMenu.tsx", "ui/src/components/Bookmarks/BookmarksPanel.tsx", "ui/src/components/Search/FindInFilePanel.tsx", "ui/src/components/Search/SearchDocumentPreview.tsx", "ui/src/components/Search/SearchOverlay.tsx", "ui/src/components/Search/SearchOverlayResults.tsx", "ui/src/components/Search/SearchOverlayWorkspaceList.tsx", "ui/src/components/Search/searchOverlayModel.tsx", "ui/src/components/Search/useSearchOverlayResize.ts", "ui/src/components/Sidebar/FileNode.tsx", "ui/src/components/Sidebar/Sidebar.tsx", "ui/src/components/Sidebar/SidebarConfirmDialog.tsx", "ui/src/components/Sidebar/SidebarDeleteDialog.tsx", "ui/src/components/Sidebar/SidebarEntryRenameInput.tsx", "ui/src/components/Sidebar/SidebarFilesActions.tsx", "ui/src/components/Sidebar/SidebarInlineEntryInput.tsx", "ui/src/components/Sidebar/SidebarItemMenu.tsx", "ui/src/components/Sidebar/SidebarScopeControls.tsx", "ui/src/components/Sidebar/SidebarSearch.tsx", "ui/src/components/Sidebar/SidebarSelectionActions.tsx", "ui/src/components/Sidebar/SidebarSortMenu.tsx", "ui/src/components/Sidebar/SidebarTabsHeader.tsx", "ui/src/components/Sidebar/SidebarTreeCheckboxes.tsx", "ui/src/components/Sidebar/TreeNode.tsx", "ui/src/components/Sidebar/sidebarActiveFolders.ts", "ui/src/components/Sidebar/sidebarEntryIcons.tsx", "ui/src/components/Sidebar/sidebarItemMenuItems.tsx", "ui/src/components/Sidebar/sidebarItemMenuPosition.ts", "ui/src/components/Sidebar/sidebarPinIcons.tsx", "ui/src/components/Sidebar/sidebarRenameIcon.tsx", "ui/src/components/Sidebar/sidebarSearchResultTree.ts", "ui/src/components/Sidebar/sidebarSearchScope.ts", "ui/src/components/Sidebar/sidebarSearchTree.tsx", "ui/src/components/Sidebar/sidebarTabs.ts", "ui/src/components/Sidebar/sidebarTreeContext.ts", "ui/src/components/Sidebar/sidebarTreeFiltering.ts", "ui/src/components/Sidebar/sidebarTreeModel.ts", "ui/src/components/Sidebar/sidebarTreeOrdering.ts", "ui/src/components/Sidebar/sidebarWorkspacePreferences.ts", "ui/src/components/Sidebar/useFolderExpansionCommand.ts", "ui/src/components/Sidebar/useLocateActiveFile.ts", "ui/src/components/Sidebar/useSidebarCursorNavigation.ts", "ui/src/components/Sidebar/useSidebarEntryActions.tsx", "ui/src/components/Sidebar/useSidebarEntryCreation.ts", "ui/src/components/Sidebar/useSidebarEntryDeletion.ts", "ui/src/components/Sidebar/useSidebarFileOps.tsx", "ui/src/components/Sidebar/useSidebarPinnedSorting.ts", "ui/src/components/Sidebar/useSidebarScopeFocus.ts", "ui/src/components/Sidebar/useSidebarSelectionMode.ts", "ui/src/components/TOC/TableOfContents.tsx"]
related_specs: ["architecture.ui-state-and-runtimes"]
last_doc_update_at: "2026-11-17T04:52:00Z"
last_verified_at: "2026-11-17T04:52:00Z"
last_verified_code_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_at: "2026-11-17T04:52:00Z"
source_fingerprint: "sha256:500cfa10d51e18fb42392aa65ff4197232b2640cf8a4089d903898bbdea4a9e5"
---

# Sidebar Navigation, File Tree, Search, and Bookmarks

## Purpose and boundaries

Provides the left sidebar navigation surface across desktop (`electron`, `tauri`), `vscode`, and `web` runtimes: recursive workspace file tree with filtering and sorting, active-document heading outline, workspace-wide text/fuzzy search, and persistent bookmarks. Out of scope: document body rendering and export pipelines.

## Observable behavior

- **File tree**: Renders nested folders and supported documents (`md`, `csv`, `tsv`, `json`, `txt`, etc.), supports expand/collapse all, active-file reveal, pinning/sorting, and file creation/rename/delete actions.
- **Runtime-aware sidebar actions**: `Sidebar.tsx` and `sidebarItemMenuItems.tsx` gate history availability (`!isWebRuntime()` via `window.__webBus`, showing `(Web unavailable)` when disabled) and expose typed 9-locale `t.sidebar.downloadFile`, `t.sidebar.downloadFolderZip`, and `t.sidebar.downloadWorkspaceZip` actions (`SidebarTabsHeader.tsx` `downloadWorkspaceLabel`) in web mode. `useSidebarEntryDeletion.ts` discards dirty buffers and closes deleted tabs across hosts (checking `state.appRuntime !== 'web'` for workspace-match guarding).
- **Workspace selection & entry capability**: `WorkspaceSelection.tsx` and `workspaceEntryCapability.ts` use `appRuntime === 'web'` (`window.__webBus`, `?mode=test` for simulated web test mode) instead of legacy `chrome` / `__webDemoBus` checks, removing the browser `chrome://flags` setup column while retaining the File System Access flag hint. `getWorkspaceEntryCapability()` uses `'permanent'` deletion for `'web'` and `'trash'` for other hosts.
- **Search & preview**: Searches file names and content with debounced query execution, match previews (`SearchDocumentPreview.tsx` with table view-select/collapse/codeblock/internal-link click handling, without legacy `__chromeExtBus` column-menu workarounds), and click-to-jump navigation. Cross-workspace `SearchOverlay` (`scope === 'all-tabs'`) is gated to desktop multi-workspace mode (`openWorkspaceTabs.length >= 2`); invoking it with one workspace tab focuses the primary sidebar Search tab (`openSidebarSearch()`) instead. `SearchOverlayWorkspaceList.tsx` and `SidebarTreeCheckboxes.tsx` use custom inner-shape square/chamfered checkboxes (`.search-overlay-workspace__checkbox`, `.scope-focus-checkbox`) and `data-hover-tooltip` portals.
- **Outline, bookmarks & tab shortcut tooltips**: Extracts heading hierarchies (`TableOfContents.tsx`) with left-docked `data-hover-tooltip` portals (`data-hover-tooltip-pos="left"`), lets users star/unstar and organize bookmarked files (`ui/src/bookmarks/`, `ui/src/components/Bookmarks/`), and passes enabled `openFiles` (`Ctrl+Shift+E`), `searchCurrent`, and `openBookmarks` keybindings from `Sidebar.tsx` via `sidebarTabs.ts` (`buildVisibleSidebarTabs`) to `SidebarTabsHeader.tsx` (`TooltipButton` `shortcut`). `SidebarTabsHeader` aligns the first tab's tooltip to the left (`tooltipAlign="left"`) and the last tab's tooltip to the right (`tooltipAlign="right"`) so shortcut keycaps do not clip outside the viewport. `SidebarScopeControls.tsx` surfaces localized `applyScopeFocus` tooltip on the apply action when editing active focus scope and marks narrowed scope state.

## Code map

- `ui/src/components/Sidebar/` — sidebar shell (`Sidebar.tsx`), tree/file nodes, item menus (`sidebarItemMenuItems.tsx`), scope/sort controls, and entry creation/deletion hooks
- `ui/src/components/Search/` — `SearchOverlay.tsx`, `SearchDocumentPreview.tsx`, `FindInFilePanel.tsx`, and search overlay model/resize hooks
- `ui/src/components/Bookmarks/` & `ui/src/bookmarks/` — bookmark store, commands, DOM anchors, dialogs, and `BookmarksPanel.tsx`
- `ui/src/components/TOC/TableOfContents.tsx` — active-document heading outline
- `ui/src/components/Workspace/WorkspaceSelection.tsx` & `ui/src/workspace/workspaceEntryCapability.ts` — workspace open/virtual-workspace actions and create/delete capability derivation

## Verification

- Verified by `tests/unit/ui/` and `tests/node/` suites covering sidebar item menus, file operations, web download actions, scope controls, search preview, and `workspaceEntryCapability`.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [Markdown Rendering and Data Tables](markdown-rendering-and-tables.md)

## Known limitations and open questions

- Recursive workspace search depth and speed depend on the underlying runtime bridge's file-reading throughput.
