# Focus, Split View, and History UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Focus mode reliably draggable, align revision browsing with normal document filtering, give each split pane independent tabs and stable scrolling/drop behavior, and add searchable paginated repository history that opens correctly from More Actions.

**Architecture:** Keep window-drag behavior runtime-specific but render the Focus drag surface inside the app shell where native window state is available. Promote split panes from a single `filePath` projection to pane-local tab collections with an active tab per pane; navigation targets `activePane`, while scroll state stays local during wheel/trackpad motion and is persisted only when leaving a document. Extend Git history requests with an offset so the sidebar can append pages and search across loaded pages without repeatedly refetching the same prefix.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Electron, Tauri, Git CLI-backed history adapters, CSS modules/global styles.

**Spec:** PR #48 approved design in the 2026-09-16 review conversation.

## Global Constraints

- Work only on `feature/editor-git-history-split-view`; do not merge PR #48.
- Preserve Electron, Tauri, VS Code, Chromium/Web behavior unless the approved design explicitly changes it.
- Closing split view keeps only the currently focused pane and its tabs.
- Revision Files view must expose the same document types as the normal Files view; source-code files such as `.ts` must not appear merely because Git contains them.
- Sidebar tab buttons use Markdown Explorer tooltip behavior, not browser-only `title` attributes.
- Ordinary split-pane scrolling must not dispatch global state on every scroll event or remount/re-render the document surface.
- History search matches commit SHA, author, or subject/message.
- History uses true pagination/offset loading and appends older commits as the user nears the bottom.
- More Actions → History expands the sidebar, selects History, and starts repository history loading.
- Follow test-first red/green/refactor for each behavior.

---

### Task 1: Focus Drag Surface and Sidebar/Revision UX

**Files:**
- Modify: `ui/src/AppShell.tsx`
- Modify: `ui/src/styles/global/global-electron-window-controls.css`
- Modify: `ui/src/styles/global/global-content-tabs-focus-search.css`
- Modify: `ui/src/components/Sidebar/SidebarTabsHeader.tsx`
- Modify: `ui/src/history/revisionWorkspace.ts`
- Test: `tests/node/focus-drag-region-contract.test.mjs`
- Test: `tests/unit/ui/history/revision-workspace.test.ts`
- Test: `tests/unit/ui/components/sidebar-tabs-header.test.tsx`

**Interfaces:**
- Produces: `FocusModeDragRegion` with a draggable body area and explicit no-drag control exclusion.
- Produces: `isRevisionDocumentPath(path, documentConversionEnabled)` used by revision projection filtering.
- Produces: sidebar tabs rendered through `TooltipButton` with labels available in both icon-only and labeled layouts.

- [ ] **Step 1: Write failing Focus drag tests**

```js
assert.match(appShell, /focus-mode-drag-region__surface/);
assert.match(css, /focus-mode-drag-region__surface[\s\S]*-webkit-app-region:\s*drag/);
assert.match(css, /focus-mode-drag-region__controls[\s\S]*-webkit-app-region:\s*no-drag/);
```

- [ ] **Step 2: Write failing revision-filter test**

```ts
const projection = buildRevisionWorkspaceProjection('a'.repeat(40), [
  { path: 'README.md' },
  { path: 'notes.txt' },
  { path: 'src/app.ts' },
]);
expect(projection.fileList.map((file) => file.relativePath)).toEqual(['notes.txt', 'README.md']);
```

- [ ] **Step 3: Write failing sidebar-tooltip test**

```tsx
render(<SidebarTabsHeader activeTab="files" tabs={tabs} searchStatus={idleStatus} onSelect={vi.fn()} />);
expect(screen.getByRole('button', { name: 'Files' }).querySelector('.tooltip-text')).toHaveTextContent('Files');
```

- [ ] **Step 4: Verify RED**

Run the PR UI/Node test jobs and confirm the new assertions fail because the current implementation has a 10px edge strip, includes `.ts` revision files, and uses native `title` for icon-only tabs.

- [ ] **Step 5: Implement minimal Focus drag surface**

```tsx
<div className="focus-mode-drag-region" aria-hidden="true">
  <div className="focus-mode-drag-region__surface" data-tauri-drag-region={isTauri ? '' : undefined} />
</div>
```

CSS keeps the surface below the resize hit area and marks interactive Focus controls `no-drag`.

- [ ] **Step 6: Filter revision projection to supported document types**

```ts
const MARKDOWN = /\.(?:md|mdx)$/i;
const TEXT = /\.txt$/i;
const CONVERTIBLE = /\.(?:doc|docx|pdf|html?|xls|xlsx|xlm|pptx|odt|odp|ods|rtf)$/i;
export function isRevisionDocumentPath(path: string, documentConversionEnabled = false) {
  return MARKDOWN.test(path) || TEXT.test(path) || (documentConversionEnabled && CONVERTIBLE.test(path));
}
```

Pass the document-conversion setting when building the revision workspace projection.

- [ ] **Step 7: Render sidebar tab controls with `TooltipButton`**

Use the existing localized tab label as `tooltip`, retain `aria-label`, and keep indicator measurement refs on the actual button element.

- [ ] **Step 8: Verify GREEN and commit**

Run targeted UI/Node tests, then the existing sidebar/history contract suite. Commit as `fix(ui): harden focus drag and revision sidebar UX`.

---

### Task 2: Pane-Owned Tabs and Stable Split Scrolling

**Files:**
- Modify: `ui/src/split-view/paneState.ts`
- Modify: `ui/src/split-view/splitViewReducer.ts`
- Modify: `ui/src/split-view/paneSelectors.ts`
- Modify: `ui/src/contexts/AppStateContext.tsx`
- Modify: `ui/src/contexts/appStateReducer.ts`
- Modify: `ui/src/components/Content/SplitContent.tsx`
- Modify: `ui/src/components/Content/ContentTabs.tsx`
- Modify: `ui/src/components/Content/SplitDocumentView.tsx`
- Modify: `ui/src/styles/components/split-view.css` or the existing split-view stylesheet
- Test: `tests/unit/ui/split-view/pane-state.test.ts`
- Test: `tests/unit/ui/components/split-content.test.tsx`
- Test: `tests/unit/ui/components/content-tabs.test.tsx`

**Interfaces:**
- Produces: `DocumentPaneState.tabs: readonly string[]` and `activeTabPath: string | null`.
- Produces: `openFileInPane(state, paneId, filePath, useTabs)` reducer behavior.
- Produces: pane-scoped tab activation/close functions in `AppStateContext`.
- Produces: `persistSplitPaneScroll(paneId, scrollTop)` called on document/pane lifecycle boundaries rather than every scroll event.

- [ ] **Step 1: Write failing pane-state tests**

```ts
const split = openSplit(createSplitViewState('/a.md'), '/b.md');
const next = openPaneDocument(split, 'primary', '/c.md', true);
expect(next.primary.tabs).toEqual(['/a.md', '/c.md']);
expect(next.primary.activeTabPath).toBe('/c.md');
expect(next.secondary.tabs).toEqual(['/b.md']);
```

Add a close-split test asserting the focused pane's tabs survive and the other pane is discarded.

- [ ] **Step 2: Write failing scroll-stability test**

```tsx
fireEvent.scroll(primaryScroll, { target: { scrollTop: 240 } });
expect(onPersistScroll).not.toHaveBeenCalled();
fireEvent.click(screen.getByLabelText(/secondary document/i));
expect(onPersistScroll).toHaveBeenCalledWith('primary', 240);
```

- [ ] **Step 3: Verify RED**

Confirm pane state has no tab collections and current `onScroll` immediately calls `setSplitPaneScrollTop`.

- [ ] **Step 4: Add pane-owned tab state**

```ts
export interface DocumentPaneState {
  readonly id: PaneId;
  readonly filePath: string | null;
  readonly tabs: readonly string[];
  readonly activeTabPath: string | null;
  readonly mode: DocumentViewMode;
  readonly scrollTop: number;
}
```

Keep `filePath` as the current rendered path during migration, derived from `activeTabPath` when tabs are enabled.

- [ ] **Step 5: Route navigation to the focused pane**

When split is enabled, `navigate()` opens/replaces only `state.splitView.activePane`; with `fileTabs` enabled it upserts a pane tab, otherwise it replaces the pane document. Do not mutate the other pane.

- [ ] **Step 6: Render tabs inside each pane**

Move split-mode tab UI into each pane header. Remove the shared split-mode `ContentTabs` strip. Tab close/activate operations are pane-scoped.

- [ ] **Step 7: Remove the `Renderer` badge**

Delete its markup and associated CSS/test expectations; keep mode buttons only where they represent actual user-switchable modes.

- [ ] **Step 8: Make scroll position local during scrolling**

Track `scrollTop` in a pane ref. Persist the previous pane's ref value only before file/tab/mode changes, pane deactivation, split close, or unmount. Exclude `scrollTop` from memo equality so scrolling cannot invalidate the document surface.

- [ ] **Step 9: Verify GREEN and commit**

Run split reducer/component/tab tests plus UI tests. Commit as `feat(split-view): add pane-owned tabs and stable scrolling`.

---

### Task 3: Files Context Menu and Drag/Drop into Document Panes

**Files:**
- Modify: `ui/src/components/Sidebar/TreeNode.tsx`
- Modify: `ui/src/components/Sidebar/Sidebar.tsx`
- Modify: `ui/src/components/Sidebar/sidebarItemMenuItems.tsx`
- Modify: `ui/src/components/Content/SplitDocumentView.tsx`
- Modify: `ui/src/components/Content/ContentMainView.tsx`
- Create: `ui/src/components/Content/documentFileDrop.ts`
- Modify: translations/type files for `Open in Split View` and drop labels
- Test: `tests/unit/ui/components/sidebar-item-menu.test.tsx`
- Test: `tests/unit/ui/components/document-file-drop.test.ts`
- Test: `tests/unit/ui/components/split-document-view.test.tsx`

**Interfaces:**
- Produces: drag MIME `application/x-markdown-explorer-file` containing a workspace file path.
- Produces: `readDraggedDocumentPath(dataTransfer): string | null`.
- Produces: `openInSplit(filePath)` from a Files context-menu item.

- [ ] **Step 1: Write failing context-menu test**

```ts
expect(buildSidebarItemMenuItems(options).map((item) => item.id)).toContain('open-in-split');
```

- [ ] **Step 2: Write failing drag payload/drop tests**

```ts
expect(readDraggedDocumentPath(dataTransfer)).toBe('/repo/docs/a.md');
expect(onDropFile).toHaveBeenCalledWith('secondary', '/repo/docs/a.md');
```

- [ ] **Step 3: Verify RED**

Confirm Files nodes have no document drag payload and split pane zones do not accept sidebar file drops.

- [ ] **Step 4: Add `Open in Split View` to file context menus**

Expose only for file targets; call the existing `openInSplit(target.path)` action and preserve dirty-document guards where replacing a pane document can discard state.

- [ ] **Step 5: Make file rows draggable**

On `dragstart`, set the custom MIME path plus `text/plain` fallback and `effectAllowed = 'copy'`.

- [ ] **Step 6: Add pane-aware drop zones**

Each split pane handles `dragover/drop`, highlights only itself, activates itself, then opens the dropped file in that pane. The unsplit document zone opens the file normally.

- [ ] **Step 7: Verify GREEN and commit**

Run sidebar, drag/drop, split-view, and navigation tests. Commit as `feat(split-view): open files by menu and pane-aware drag drop`.

---

### Task 4: Paginated/Searchable Repository History and More-Actions Routing

**Files:**
- Modify: `ui/src/history/historyClient.ts`
- Modify: `ui/src/history/contracts.ts` and message types
- Modify: `ui/src/contexts/RepositorySnapshotContext.tsx`
- Modify: `ui/src/components/History/RepositoryHistoryPanel.tsx`
- Modify: `ui/src/components/History/GitCommitGraph.tsx`
- Modify: `electron/git/document-history.js`
- Modify: `electron/git/git-history-handlers.js`
- Modify corresponding Tauri/VS Code host history handlers
- Modify: `ui/src/components/shared/ToolbarActionMenu.tsx`
- Modify: `ui/src/components/Topbar/Topbar.tsx`
- Modify sidebar state helpers/translations
- Test: `tests/unit/ui/history/history-client.test.ts`
- Test: `tests/unit/ui/history/repository-history-panel.test.tsx`
- Test: Electron/Tauri/VS Code history host tests
- Test: `tests/unit/ui/components/toolbar-action-menu.test.tsx`

**Interfaces:**
- Produces: `listRepositoryHistory(limit?: number, offset?: number)`.
- Produces: context `loadHistory({ reset?: boolean })` and `loadMoreHistory()` with `hasMoreHistory` / `isLoadingMoreHistory`.
- Produces: `filterRepositoryCommits(commits, query)` matching full/short SHA, author, and subject case-insensitively.
- Produces: centralized `openRepositoryHistorySidebar()` app action.

- [ ] **Step 1: Write failing host pagination tests**

```js
await listRepositoryHistory({ workspacePath, limit: 50, offset: 100 });
expect(runGitArgs).toContain('--skip=100');
expect(runGitArgs).toContain('-n');
expect(runGitArgs).toContain('50');
```

- [ ] **Step 2: Write failing client/context pagination tests**

```ts
await client.listRepositoryHistory(50, 100);
expect(bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, offset: 100 }));
```

Verify appended pages are de-duplicated by OID and preserve order.

- [ ] **Step 3: Write failing search test**

```ts
expect(filterRepositoryCommits(commits, 'alice')).toEqual([commits[1]]);
expect(filterRepositoryCommits(commits, commits[0].shortOid)).toEqual([commits[0]]);
expect(filterRepositoryCommits(commits, 'fix parser')).toEqual([commits[2]]);
```

- [ ] **Step 4: Write failing More Actions routing test**

Assert choosing History dispatches sidebar expansion + `SET_SIDEBAR_ACTIVE_TAB('history')` and causes repository history loading rather than only firing document-history behavior.

- [ ] **Step 5: Verify RED**

Run history client/panel/host/menu tests and confirm failures correspond to missing offset/search/central routing.

- [ ] **Step 6: Add offset pagination end-to-end**

Electron Git args use `--skip=<offset>`. Tauri and VS Code adapters implement the same limit/offset contract. UI client serializes offset. Context loads an initial page (50), appends subsequent pages, de-duplicates OIDs, and marks `hasMoreHistory=false` when a page returns fewer than the requested page size.

- [ ] **Step 7: Add History search UI and progressive loading**

Render a search box above the commit graph. Filter by OID/short OID/author/subject. Use an `IntersectionObserver` sentinel (with scroll fallback for tests) to call `loadMoreHistory()` near the bottom; while a query is active, continue paging until a page yields matches or history is exhausted.

- [ ] **Step 8: Centralize More Actions → History**

Replace the old document-history event path for this menu item with an app action that expands the sidebar, selects History, and lets the visible History panel trigger initial loading. Keep document-specific revision actions available inside History.

- [ ] **Step 9: Verify GREEN and commit**

Run history host/client/panel/menu tests and full UI/Node suites. Commit as `feat(history): add searchable paginated repository sidebar`.

---

### Task 5: Integration Verification and PR Documentation

**Files:**
- Modify tests/contracts only if they assert intentionally changed behavior.
- Modify: PR #48 description after implementation.

**Interfaces:**
- Consumes all previous task outputs.
- Produces a manually testable PR branch with compact logical commits and no merge.

- [ ] **Step 1: Run targeted suites**

Run Node/contracts, UI tests, Electron tests, host-variant tests, and history/split focused suites.

- [ ] **Step 2: Run full GitHub Actions**

Require all PR jobs green on the exact final tree.

- [ ] **Step 3: Verify behavior matrix**

Check Electron and Tauri Focus drag behavior, revision filtering, pane-local tabs, file drag/drop routing, scroll stability, History pagination/search, and More Actions routing against the approved design.

- [ ] **Step 4: Compact only temporary implementation commits if needed**

Preserve the existing seven logical commits, plus the new logical commits from Tasks 1-4. Do not merge PR #48.

- [ ] **Step 5: Update PR #48 body**

Document the new behavior, tests, final CI run, and explicit `Do not merge until manual validation is complete` status.
