---
timestamp: '2026-09-17T00:00:00+07:00'
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
- Toolbar action order is Sort, Clear Pins, Locate, Collapse All, Expand All.
- Pinned rows use the stroke-only `PinIcon`. Per-row unpin and Clear Pins use the shared `UnpinIcon` design.
- Scope-focus and TOC count badges use theme-aware radius tokens.

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

- `historySidebarEnabled` defaults to true, but History is rendered only after `getGitCapability` reports local Git support for the active workspace.
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
| Verification | `tests/unit/ui/components/sidebar-tabs-header.test.tsx` | Tooltip/header expectation |
| Verification | `tests/unit/ui/history/repository-history-panel.test.tsx` | Repository history UI expectation |
| Verification | `tests/unit/ui/history/revision-workspace.test.ts` | Historical file filtering |
| Verification | `tests/node/repository-history-pagination-contract.test.mjs` | Cross-runtime history contract |

---

[← Desktop Workspace Tabs](02-desktop-workspace-tabs.md) · [Documentation index](../README.md) · [Content Tabs and Document Shell →](04-content-tabs-and-document-shell.md)
