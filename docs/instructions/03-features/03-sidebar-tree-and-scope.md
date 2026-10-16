---
timestamp: '2026-10-07T00:00:00+07:00'
name: Sidebar Tree, Filtering, and Scope
topic: Sidebar Tree, Filtering, Scope, and repository History
document_type: specification
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../../git-history-diff.md
- ../../superpowers/specs/2026-09-17-pr48-as-built-sync.md
- ../../sidebar-file-ops-design.md
- ../02-use-cases/UC-032-create-and-delete-workspace-entries.md
source_scope:
- ui/src/components/Sidebar/Sidebar.tsx
- ui/src/components/Sidebar/SidebarSearch.tsx
- ui/src/components/Sidebar/SidebarTabsHeader.tsx
- ui/src/components/Sidebar/sidebarSearchScope.ts
- ui/src/components/Sidebar/TreeNode.tsx
- ui/src/components/Sidebar/SidebarFilesActions.tsx
- ui/src/components/Sidebar/SidebarSortMenu.tsx
- ui/src/components/Sidebar/SidebarScopeControls.tsx
- ui/src/components/Sidebar/sidebarItemMenuItems.tsx
- ui/src/components/Sidebar/sidebarTreeFiltering.ts
- ui/src/components/Sidebar/sidebarTreeOrdering.ts
- ui/src/components/Sidebar/sidebarPinIcons.tsx
- ui/src/components/Sidebar/sidebarWorkspacePreferences.ts
- ui/src/components/Sidebar/sidebarActiveFolders.ts
- ui/src/components/Sidebar/useSidebarCursorNavigation.ts
- ui/src/components/Sidebar/useSidebarPinnedSorting.ts
- ui/src/components/Sidebar/useSidebarScopeFocus.ts
- ui/src/components/Sidebar/useSidebarFileOps.tsx
- ui/src/components/Sidebar/useSidebarEntryCreation.ts
- ui/src/components/Sidebar/useSidebarEntryDeletion.ts
- ui/src/components/Sidebar/useSidebarSelectionMode.ts
- ui/src/components/Sidebar/SidebarInlineEntryInput.tsx
- ui/src/components/Sidebar/SidebarSelectionActions.tsx
- ui/src/components/Sidebar/SidebarConfirmDialog.tsx
- ui/src/components/Sidebar/SidebarTreeCheckboxes.tsx
- ui/src/components/Sidebar/sidebarTreeContext.ts
- ui/src/components/Sidebar/sidebarEntryIcons.tsx
- ui/src/workspace/workspaceEntryName.ts
- ui/src/workspace/workspaceEntryCapability.ts
- ui/src/workspace/workspaceEntriesClient.ts
- ui/src/workspace/workspaceEntryPaths.ts
- ui/src/workspace/workspaceEntryMessages.ts
- ui/src/components/History/RepositoryHistoryPanel.tsx
- ui/src/components/History/GitCommitGraph.tsx
- ui/src/history/revisionWorkspace.ts
- ui/src/history/repositoryView.ts
- ui/src/hooks/useResize.ts
- ui/src/styles/global/global-sidebar-search-controls.css
test_scope:
- tests/node/sidebar-pinning-sorting.test.mjs
- tests/node/sidebar-focus-search-layout.test.mjs
- tests/node/repository-history-pagination-contract.test.mjs
- tests/unit/ui/components/sidebar-tree-ordering.test.ts
- tests/unit/ui/components/sidebar-render.test.tsx
- tests/unit/ui/components/sidebar-search-pure.test.ts
- tests/unit/ui/components/sidebar-tabs-header.test.tsx
- tests/unit/ui/history/repository-history-panel.test.tsx
- tests/unit/ui/history/git-graph-layout.test.ts
- tests/unit/ui/history/revision-workspace.test.ts
- tests/unit/ui/hooks/useResize.test.ts
- tests/unit/ui/components/sidebar-file-ops.test.tsx
- tests/unit/ui/components/sidebar-entry-creation.test.tsx
- tests/unit/ui/components/sidebar-entry-deletion.test.tsx
- tests/unit/ui/components/sidebar-selection-mode.test.tsx
- tests/unit/ui/components/sidebar-selection-actions.test.tsx
- tests/unit/ui/components/sidebar-inline-entry-input.test.tsx
- tests/unit/ui/components/sidebar-confirm-dialog.test.tsx
- tests/unit/ui/components/sidebar-tree-entry-context.test.tsx
- tests/unit/ui/workspace
runtime_scope:
- all
- native/editor-hosts
- browser-hosts
keywords:
- sidebar tree
- filtering
- scope
- repository history
- pagination
- file operations
- selection mode
- empty folders
---

# Sidebar Tree, Filtering, and Scope

## Feature intent

Specify hierarchical file navigation, search/filter rendering, cursor navigation, context menus, resizing, per-workspace scope focus, and the capability-aware repository History sidebar.

## Capability contract

| Capability | Required behavior | User result |
|---|---|---|
| Tree | Render folder/file hierarchy and active item. | Workspace structure is understandable. |
| Filter | Retain matching descendants and required ancestors. | Large trees are narrowed without losing context. |
| Cursor mode | Move, expand, collapse, and open by keyboard. | Tree is usable without pointer. |
| Scope focus | Limit navigation and workspace search to selected files/folders per workspace. | Users concentrate on relevant documentation. |
| History | Show paged/searchable repository commits and read-only revision files only when local Git is supported. | Repository history is browsable without checkout or working-tree mutation. |
| Resize | Persist bounded sidebar width. | Layout matches reader preference. |

## Tree-node behavior

- Folder expansion is independent from text filtering.
- The active document remains visually identifiable when its node is visible.
- File and folder context menus are built from target type and host capability.
- File targets expose **Open in Split View** when split opening is available.
- File rows can carry the Markdown Explorer document drag payload consumed by the document shell; folder rows do not masquerade as document drags.
- Filter matching is case/Unicode aware through shared utilities where applicable.
- Scope maps are reconciled when files/folders disappear.

## Tree ordering, sorting, and pin controls

- Default `name-asc` ordering keeps unpinned folders before files at each directory level; each group is sorted alphabetically.
- `SidebarSortMenu` offers `name-asc`, `name-desc`, and `modified-desc`.
- Pinned nested items are hoisted to the root-level pinned area.
- Selecting the active sort mode again resets to `DEFAULT_SIDEBAR_SORT_MODE` (`name-asc`).
- Toolbar action order is, in the left group, the sort status followed by New File, New Folder, and Select (see Creating files and folders), and, in the right group, Sort, Clear Pins, Locate, Collapse All, Expand All.
- Pinned rows use the stroke-only `PinIcon`. Per-row unpin and Clear Pins use the shared `UnpinIcon` design.
- Scope-focus and TOC count badges use theme-aware radius tokens.

## Creating files and folders

Use case: [UC-032](../02-use-cases/UC-032-create-and-delete-workspace-entries.md). Design: [sidebar-file-ops-design.md](../../sidebar-file-ops-design.md).

- **Buttons**: **New File** (file-plus icon, `sidebar__files-action--new-file`) and **New Folder** (folder-plus icon, `--new-folder`) sit on the left of the Files action bar, followed by the **Entry selection mode** toggle (`--select`). The folder context menu adds **New File…** and **New Folder…** (`newFileMenu`, `newFolderMenu`) that target that folder.
- **Capability**: `getWorkspaceEntryCapability` gives Electron, Tauri, and VS Code `{ create: true, deleteMode: 'trash' }`, the Chromium extension and website `{ create: true, deleteMode: 'permanent' }`, and no open workspace `{ create: false, deleteMode: null }`. Historical revision mode hides mutations. The default website demo supports localStorage-backed simulated mutations; website `?mode=file` uses real handles. A single-file workspace still shows the controls; its host answers `unsupported` and the input shows the message.
- **Target resolution**, first match wins: the last focused folder row; the parent folder of the last focused file row; the workspace root. Clicking empty tree space clears the focus memory, so the next create targets the root. The target folder is forced open before the input appears; a root target renders the input above the tree.
- **Inline input** (`SidebarInlineEntryInput`: `.sidebar-entry-input` with `--file`/`--folder`, `__row`, `__message`, `.is-error`; accessible names `newFileInputLabel` and `newFolderInputLabel`): a file draft is prefilled with `.md` and the caret placed before the dot; a folder draft starts empty. The committed name is trimmed; a file name without any `.` gets `.md` appended. While the request is in flight the input is read-only (`aria-busy`).
- **Validation** (inline, `role="alert"`, blocks the request): empty name, an existing sibling in the loaded tree (case-insensitive unless the host platform is Linux), `.`/`..` or trailing dot/space or a control character or one of `<>:"/\|?*` (`entryErrorInvalid`), a reserved Windows device name (`entryErrorReserved`), and a `.git` name (`entryErrorProtected`). **Enter on the untouched `.md` prefill shows the name-required error** (`entryErrorEmpty`) and sends nothing. A host failure keeps the input open with the message mapped from the failure reason (see the Error and Reason Catalog).
- **Enter / Escape / blur**: Enter commits (ignored during IME composition); Escape cancels; blur commits a valid, non-empty name and otherwise cancels (the untouched `.md` prefill counts as empty). Cancel and blur are ignored while a request is in flight.
- **Draft lifetime**: collapsing a folder that hosts the open input cancels the draft (`onFolderCollapsed` on the tree context; **Collapse All** cancels it too, because an unmounted input fires no blur). A workspace change drops the draft; starting a create exits selection mode.
- **Unlisted-type hint**: Markdown (`.md`, `.mdx`, `.markdown`) is always listed; any other extension is listed only when the tree already lists that extension. Otherwise the input shows the hint `entryUnlistedType` ("This file type won't appear in the Files tree"); creation still proceeds and the file is not opened.
- **On success**: a created file opens once it appears in the file list (the open is retried on each list change, because the watcher refresh can race the reply); a Markdown file opens in `inline-edit` mode (re-applied when its document session appears); the parent folder expands. A created folder is revealed, expanded, and becomes the focused folder.

## Selection mode

- The **Entry selection mode** button toggles selection mode (`selectMode`). Every row shows a checkbox (`.sidebar-entry-checkbox`, accessible name `selectItem` with `{name}`); selected rows carry `is-selected` on `.tree-file` and `.tree-folder__header`.
- Row click toggles selection instead of opening a file (Enter on a focused file row does the same; folder headers also respond to Enter and Space); a folder header no longer expands on click, but its chevron still expands and collapses it. Selection keys are `file:<fsPath>` and `folder:<path>`. Known gap: the chevron is mouse-only, so a keyboard-only user expands or collapses folders in selection mode with the toolbar **Expand all** / **Collapse all** buttons.
- Selection mode and scope-focus editing are mutually exclusive: entering selection mode leaves scope editing, and toggling scope editing exits selection mode. Entering selection mode cancels any open create draft.
- The toolbar (`.sidebar__files-actions--selection`, `role="toolbar"`) replaces the action bar: **Expand all**, **Collapse all**, **Unpin selected (n)** (`--unpin-selected`; n counts only the selected pinned items, and the button is disabled until one is selected), **Delete selected (n)** (`--delete-selected`, present only when the capability has a delete mode, disabled at zero), the live selected count (`.sidebar__selection-count`), and **X** (`--exit-selection`). The count in the toolbar and in Delete selected (n) is the pruned entry count: a selected folder plus its selected children counts once.
- Escape (a window key handler that ignores already-handled events) or **X** exits and clears the selection; the selection also resets when the workspace changes. **Escape inside a confirm dialog closes only the dialog** (it stops propagation and prevents default) and leaves selection mode active. **Escape inside an item context menu closes only the menu** (the menu prevents default), so selection mode stays active too.

## Unpin and delete selected

- **Unpin selected** opens a default confirm dialog (title `unpinSelected`, body `unpinSelectedConfirmBody`); confirming removes the pins of the selected pinned entries (`removePins` in `useSidebarPinnedSorting`).
- **Delete selected** opens a destructive confirm dialog (`SidebarConfirmDialog variant="destructive"`, class `sidebar-confirm-dialog--destructive`): the title states the count (`deleteTrashTitle` or `deletePermanentTitle`), the list shows the first 5 base names then `deleteMore` ("and n more"), and a `role="note"` warning `deleteUnsavedWarning` ("n files have unsaved changes that will be lost") appears when any selected file, or file under a selected folder, has unsaved edits. Trash runtimes say **Move to Trash** (`deleteTrashConfirm`); permanent runtimes say `deletePermanentBody` ("Permanently delete — this cannot be undone") with the confirm label **Delete permanently**. Escape, the backdrop, or Cancel close the dialog without deleting.
- Selecting a folder implies its subtree: selected descendants of a selected folder are pruned before the request (`resolveSelectionEntries`), and paths are sent workspace-relative.
- After the reply, for every removed file path (or path under a removed folder) the tab's unsaved changes are discarded and the tab closes, and pins for removed files and folders are removed. The host has already refreshed the tree. A partial failure shows an error action notice (`deleteFailed`) listing the failed names while succeeded entries are still cleaned up. Selection mode exits after the delete finishes when at least one entry was deleted and the user did not leave and re-enter selection mode meanwhile (a newer selection is never cleared; the pins of the deleted entries are still removed); when every entry fails the selection is kept so the user can retry. While a delete is in flight a second delete request is ignored and **Unpin selected** and **Delete selected** are disabled (`busy`, toolbar `aria-busy`). The pin cleanup reads the latest pins at the time of the reply (`removePins` keeps its identity and reads the current pins and settings), so a pin change made during the request is not overwritten; it is skipped when the workspace changed meanwhile. A 15-second UI timeout reports every path as `failed`; a synchronous `postMessage` failure is reported the same way at once and releases the reply listener and timer.

## Empty folders

- Scanners on every runtime record truly empty directories (zero entries on disk; the workspace root is excluded) and pass them to their tree builder, which creates folder nodes with zero files and zero children (`FolderNode` may now be empty).
- A folder that holds only unsupported files, or only ignored entries, is not empty and is not listed. Ignored folders (`.git`, `node_modules`, configured excludes) are never descended into or shown.
- Intermediate incremental snapshots are built from files only; the final tree is published even when the file count did not change if it contains an empty folder, so empty folders appear when the scan completes. A workspace that contains only empty folders still lists them in the Files tree (the sidebar shows no "no files" message), while the main content area keeps its no-documents state because the file list is empty.

## Scope separation

| Setting | Effect |
|---|---|
| `scopeFocus` | Visible/browsable workspace focus |
| `searchScopeFocus` | Workspace-search candidate focus |

The two maps may differ and must not overwrite each other.

## Sidebar tab header contract

- Files, Search, Bookmarks, and capability-aware History are produced from one visible-tab descriptor list.
- With three or fewer visible tabs, controls show icon + translated label. With more than three, controls switch to icon-only presentation.
- Every tab button uses Markdown Explorer tooltip behavior (`TooltipButton`) and retains an accessible name in both layouts; native browser `title` alone is not the tooltip contract.
- The animated indicator is measured from the rendered visible-tab order, so optional Bookmarks/History tabs cannot shift it onto the wrong control.
- Files and Search keep consistent search-field height. Files may render scope controls on a second row.
- Workspace search filters results against the current search-focus set. Changing focus while a query is active reruns focus-aware search.

## Repository History sidebar

### Visibility and routing

- `historySidebarEnabled` defaults to true. History always renders and reminds users that it needs Git installed and a Git-tracked workspace; a failed load shows the reason and a Retry button.
- **More Actions → History** calls the centralized repository-history action, expands the sidebar if necessary, selects History, and lets the visible panel start lazy loading.
- Opening History never checkout/restores/resets/switches branches or otherwise mutates Git state.

### Graph, search, and paging

- Repository history initially requests 50 commits.
- The panel loads older pages as the user approaches the bottom through an `IntersectionObserver` sentinel, with a deterministic scroll-near-bottom fallback.
- Additional pages use `offset = loaded commit count`; appended pages are de-duplicated by full OID and preserve order.
- A short page marks history exhausted.
- Search matches full SHA, short SHA, author, or subject/message case-insensitively.
- While a query is active and no loaded commit matches, the panel may continue loading older pages until a match is found or history is exhausted.
- Commit rows show continuous graph lanes, subject, short SHA, author, refs, merge parents, and the exact `HEAD` marker.

### Historical workspace projection

- Selecting a commit can activate the whole-workspace historical view without checkout.
- Revision Files shows only document-eligible paths: Markdown/MDX and TXT always; convertible document formats only when document conversion is enabled. Arbitrary source files such as `.ts` are excluded.
- Historical workspace search reads revision text sources, not the live filesystem search route.
- Selecting a revision file opens an isolated read-only snapshot while live content tabs, editor sessions, split panes, scroll state, and unsaved working copies stay mounted.
- Persisted revision selections are keyed per workspace. A saved revision is not treated as stale merely because it is absent from the initial 50-commit page; validation may page older history.
- **Back to current HEAD** clears repository-view state/persistence only and reveals the exact already-mounted live view.
- Chromium and Website runtimes keep History unavailable because they explicitly report `unsupported-runtime` and never execute a local process.

## States and failure behavior

| State | Required presentation | Exit condition |
|---|---|---|
| Expanded | Children visible | Collapse |
| Collapsed | Children hidden | Expand |
| Filtered | Matching subtree only | Clear query |
| Cursor mode | One visible node focused | Exit/move/open |
| Scoped | Selected roots applied | Edit/clear scope |
| History loading | Initial repository page is loading | Result/error |
| History loading-more | Older page is loading | Page/error |
| History filtered | Loaded/paged commits filtered by query | Clear/change query |
| Snapshot | Historical file is rendered read-only above live content | Back to current HEAD |

## Runtime behavior

| Runtime | Specification |
|---|---|
| All | Shared tree, filtering, scope, tab header, context-menu, and document-drag behavior. |
| Electron / Tauri / VS Code | History can page/search repository commits and browse read-only snapshots through installed Git. |
| Chromium / Website | Git History remains hidden/unsupported; no local process execution. |
| Native/editor hosts | Reveal/open-in-editor actions enabled where the runtime supports them. |
| Browser hosts | Filesystem shell actions unavailable. |
| Electron / Tauri / VS Code | Create file/folder and Delete selected move entries to the OS Trash. |
| Chromium / Website file mode | Create file/folder and Delete selected (permanent, with a warning). Website demo mode manages simulated entries in localStorage only. |
| All | Truly empty folders appear in the Files tree. |

## Non-functional requirements

- All actions remain keyboard reachable.
- A failed enhancement must not prevent the base document from rendering.
- Host-facing inputs are validated before filesystem, shell, or network access.
- Repository snapshot browsing must not mutate live document/editor/split state or the Git working tree.
- History paging must remain bounded per request and must not refetch the same prefix repeatedly.

## Acceptance criteria

- [ ] Ancestors remain visible for matching descendants.
- [ ] Cursor navigation never focuses hidden nodes.
- [ ] Scope state is reconciled after workspace change.
- [ ] Sidebar width remains within layout bounds.
- [ ] Sidebar tab tooltips/accessibility remain available in icon-only mode.
- [ ] History is visible only when the setting is enabled and local Git capability is supported.
- [ ] More Actions → History selects the repository History sidebar.
- [ ] Commit search matches SHA, author, and subject.
- [ ] Older commits load with true offset pagination and append without duplicate OIDs.
- [ ] Revision Files excludes non-document source files.
- [ ] Selecting repository revisions does not checkout or dirty the working tree.
- [ ] Back to current HEAD restores the previous live view without reconstructing its editor session.
- [ ] New File and New Folder create into the focused folder, the parent of the focused file, or the root, and never overwrite an existing entry.
- [ ] Enter on the untouched `.md` prefill shows the name-required error and sends nothing.
- [ ] Collapsing a folder that hosts the open input cancels the draft.
- [ ] Selection mode exits on Escape and X, not on Escape inside a confirm dialog.
- [ ] Delete selected prunes descendants, warns about unsaved changes, closes tabs, and removes pins; a partial failure is reported.
- [ ] Trash runtimes say Move to Trash; Chromium and website say the delete is permanent.
- [ ] Truly empty folders are shown; ignored folders never are.

## Rename, keyboard focus, and deletion modes

- Clicked or keyboard-focused Files rows show a thin inset outline. F2 renames the focused entry; Delete opens its confirmation. Inputs, dialogs, menus, modifiers, and active mutations isolate these shortcuts from document editing.
- Rename uses an inline input, validates names/collisions, and waits for the host result. Enter commits; Escape or blur cancels. Unchanged Enter restores row focus without a host mutation. Native hosts guard workspace/protected paths; browser hosts use move when available or complete-copy-before-remove fallback.
- Success migrates tabs, unsaved buffers, bookmarks, pins, scope and split-pane paths, including descendants. A timed-out rename remains pending for late reconciliation rather than allowing a duplicate mutation.
- Native deletion defaults to Trash. Permanently Delete switches the title, warning, action and request mode; browser deletion fixes that choice to permanent. Single-entry and selection actions share the same dialog and unsaved-change warning.
- Creation toolbar buttons, context menu actions, and inline rows reuse FilePlusIcon/FolderPlusIcon at 14 pixels. Files and Bookmarks share accessible checkbox styling and show selection counts.
- Demo mode stores entry metadata in `markdown-explorer.demo-workspace.v1`, referring to bundled sample content after rename. Empty/nested folders and deleted samples survive reload; clearing that key restores samples on the next page load. Storage failures do not publish a successful mutation.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/components/Sidebar/Sidebar.tsx` | Sidebar tabs and active panel behavior |
| Implementation | `ui/src/components/Sidebar/TreeNode.tsx` | File/folder rows and document drag entrypoint |
| Implementation | `ui/src/components/Sidebar/sidebarItemMenuItems.tsx` | File context actions including split opening |
| Implementation | `ui/src/components/Sidebar/SidebarTabsHeader.tsx` | Visible-tab order, indicator, tooltip buttons |
| Implementation | `ui/src/components/History/RepositoryHistoryPanel.tsx` | History search and progressive page loading |
| Implementation | `ui/src/components/History/GitCommitGraph.tsx` | Commit graph rendering |
| Implementation | `ui/src/history/revisionWorkspace.ts` | Historical file filtering/search |
| Implementation | `ui/src/history/repositoryView.ts` | Commit filtering and per-workspace persisted revision selection |
| Implementation | `ui/src/components/Sidebar/useSidebarFileOps.tsx` | File-operation toolbar, tree context, capability gating, and create/delete wiring |
| Implementation | `ui/src/components/Sidebar/useSidebarEntryCreation.ts` | Inline draft, target resolution, commit/cancel/blur, open-after-create |
| Implementation | `ui/src/components/Sidebar/useSidebarSelectionMode.ts` | Selected set, Escape exit, workspace reset |
| Implementation | `ui/src/components/Sidebar/useSidebarEntryDeletion.ts` | Delete request, unsaved count, tab and pin cleanup |
| Implementation | `ui/src/components/Sidebar/SidebarInlineEntryInput.tsx` | Inline name input row |
| Implementation | `ui/src/components/Sidebar/SidebarSelectionActions.tsx` | Selection toolbar and unpin/delete dialogs |
| Implementation | `ui/src/components/Sidebar/SidebarConfirmDialog.tsx` | Shared default/destructive confirm dialog |
| Implementation | `ui/src/components/Sidebar/sidebarTreeContext.ts` | Tree-row context for draft and selection state |
| Implementation | `ui/src/workspace/workspaceEntryName.ts` | Name rules and `.md` defaulting |
| Verification | `tests/unit/ui/components/sidebar-tabs-header.test.tsx` | Tooltip/header expectation |
| Verification | `tests/unit/ui/history/repository-history-panel.test.tsx` | Repository history UI expectation |
| Verification | `tests/unit/ui/history/revision-workspace.test.ts` | Historical file filtering |
| Verification | `tests/node/repository-history-pagination-contract.test.mjs` | Cross-runtime history contract |
| Verification | `tests/unit/ui/components/sidebar-file-ops.test.tsx` | Create, selection, delete, and capability integration through the Sidebar |
| Verification | `tests/unit/ui/components/sidebar-entry-creation.test.tsx` | Target resolution, validation, commit/blur/cancel, open-after-create |
| Verification | `tests/unit/ui/components/sidebar-entry-deletion.test.tsx` | Delete cleanup of tabs and pins |
| Verification | `tests/unit/ui/components/sidebar-selection-mode.test.tsx` | Selection state and Escape exit |
| Verification | `tests/unit/ui/components/sidebar-confirm-dialog.test.tsx` | Confirm dialog variants |

---

[← Desktop Workspace Tabs](02-desktop-workspace-tabs.md) · [Documentation index](../README.md) · [Content Tabs and Document Shell →](04-content-tabs-and-document-shell.md)
