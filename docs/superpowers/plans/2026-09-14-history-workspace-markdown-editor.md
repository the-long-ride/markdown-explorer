# History Workspace and Markdown Source Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the History sidebar to a continuous Git graph with commit actions and persistent per-workspace read-only revision mode, keep Edit available when internal editing is disabled, and replace the plain Markdown textarea with a CodeMirror 6 source editor plus GitHub-style formatting toolbar.

**Architecture:** Keep live workspace state untouched and represent historical viewing explicitly in `RepositorySnapshotContext`. Revision tree/search helpers project Git revision paths into UI-only workspace data, while existing host Git APIs remain read-only. CodeMirror owns text interaction only; existing document-session, dirty/save/conflict, split-view, and Git-history logic remain authoritative.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, existing Git-history bridge, pnpm, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-markdown`, `@codemirror/language`).

**Spec:** `docs/superpowers/specs/2026-09-14-history-workspace-markdown-editor-design.md`

## Global Constraints

- Historical browsing remains read-only and must never checkout, reset, stash, switch, merge, or mutate the working tree.
- Historical workspace mode is always read-only regardless of `markdownEditingEnabled`.
- Persist the selected historical revision per workspace, preferring `workspacePath` and using `workspaceName` only when no path exists.
- A missing/rebased/pruned stored commit must clear persistence and fall back to live HEAD.
- The History accent dot indicates whole-workspace non-HEAD mode only.
- More Actions → Edit stays visible for live editable documents. Internal editing ON routes internally; OFF routes to the external/native editor.
- CodeMirror dependencies must be open-source, free for commercial use, local/offline, and require no telemetry, CDN, hosted runtime, or paid extension.
- No WYSIWYG editor in this scope.
- Existing save/conflict/dirty-session logic remains the only persistence authority.
- Inline Edit remains lightweight and does not mount CodeMirror per rendered element.
- Split focused behavior into small modules rather than growing `Sidebar.tsx`, `Topbar.tsx`, or `RepositorySnapshotContext.tsx` past source-size contracts.
- Continue PR #45 on `feature/editor-git-history-split-view`. Do not modify or merge `main`.

---

### Task 1: Continuous graph and commit action menu

**Files:**
- Modify: `ui/src/history/gitGraphLayout.ts`
- Modify: `ui/src/components/History/GitCommitGraph.tsx`
- Create: `ui/src/components/History/RepositoryCommitMenu.tsx`
- Modify: `ui/src/components/History/RepositoryHistoryPanel.tsx`
- Modify: `ui/src/contexts/historyTranslations.ts`
- Modify: `ui/src/styles/global/global-history-diff.css`
- Test: `tests/unit/ui/history/git-graph-layout.test.ts`
- Test: `tests/unit/ui/history/repository-history-panel.test.tsx`
- Create test: `tests/unit/ui/history/repository-commit-menu.test.tsx`

**Interfaces:**

```ts
export interface GitGraphSegment {
  readonly fromRow: number;
  readonly fromLane: number;
  readonly toRow: number;
  readonly toLane: number;
  readonly parentOid: string;
  readonly continuesBeyondWindow: boolean;
}

export interface GitGraphLayout {
  readonly nodes: readonly GitGraphNode[];
  readonly segments: readonly GitGraphSegment[];
  readonly laneCount: number;
}
```

```ts
interface RepositoryCommitMenuProps {
  commit: GitRepositoryCommit;
  anchor: HTMLElement;
  activeRevisionOid: string | null;
  onCopy: (value: string, label: string) => void;
  onActivateRevision: (oid: string) => void;
  onReturnToHead: () => void;
  onClose: () => void;
}
```

- [ ] **Step 1: Write failing graph tests**

Add linear, branch/merge, and truncated-parent cases:

```ts
const layout = layoutGitGraph([
  commit('c3', ['c2']),
  commit('c2', ['c1']),
  commit('c1', []),
]);
expect(layout.segments).toEqual(expect.arrayContaining([
  expect.objectContaining({ fromRow: 0, toRow: 1, parentOid: 'c2', continuesBeyondWindow: false }),
  expect.objectContaining({ fromRow: 1, toRow: 2, parentOid: 'c1', continuesBeyondWindow: false }),
]));

const truncated = layoutGitGraph([commit('c2', ['missing'])]);
expect(truncated.segments[0]).toMatchObject({
  fromRow: 0,
  toRow: 1,
  parentOid: 'missing',
  continuesBeyondWindow: true,
});
```

- [ ] **Step 2: Run graph test and verify RED**

```bash
pnpm vitest run tests/unit/ui/history/git-graph-layout.test.ts
```

Expected: failures because `segments` does not exist.

- [ ] **Step 3: Implement segment layout**

Update `layoutGitGraph()` so every visible parent produces one logical row/lane segment; an omitted parent terminates at `commits.length` and sets `continuesBeyondWindow: true`. Keep SVG coordinate calculation out of this module.

- [ ] **Step 4: Write failing commit-menu tests**

```tsx
render(<RepositoryCommitMenu
  commit={commit}
  anchor={anchor}
  activeRevisionOid={null}
  onCopy={onCopy}
  onActivateRevision={onActivateRevision}
  onReturnToHead={onReturnToHead}
  onClose={onClose}
/>);
await user.click(screen.getByRole('menuitem', { name: /copy full commit sha/i }));
expect(onCopy).toHaveBeenCalledWith(commit.oid, expect.any(String));
expect(onActivateRevision).not.toHaveBeenCalled();
```

Also assert Author copies `commit.author`, View workspace calls `onActivateRevision(commit.oid)`, and Return to HEAD appears only when `activeRevisionOid` is non-null.

- [ ] **Step 5: Run commit-menu test and verify RED**

```bash
pnpm vitest run tests/unit/ui/history/repository-commit-menu.test.tsx
```

- [ ] **Step 6: Implement `RepositoryCommitMenu`**

Use `role="menu"` and `role="menuitem"`, close on Escape and outside pointer-down, display `shortOid`, copy full `oid`, and use the existing action-notice utility for copied feedback.

- [ ] **Step 7: Render one graph SVG behind the full list**

In `GitCommitGraph`, remove per-row SVGs. Render one absolutely positioned SVG with height `ROW_HEIGHT * layout.nodes.length`. Convert row/lane coordinates with:

```ts
const x = (lane: number) => 7 + lane * LANE_WIDTH;
const y = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;
```

Straight same-lane segments use `M x(from) y(from) L x(to) y(to)`. Lane changes use a cubic curve. Render node circles from `layout.nodes` above the paths.

- [ ] **Step 8: Change row/node click to open menu only**

`GitCommitGraph` stores `{ commit, anchor } | null` local menu state. Row/node activation opens `RepositoryCommitMenu`; it does not activate revision mode. `RepositoryHistoryPanel` passes `activateWorkspaceRevision` only to the menu action.

- [ ] **Step 9: Run focused tests**

```bash
pnpm vitest run tests/unit/ui/history/git-graph-layout.test.ts tests/unit/ui/history/repository-commit-menu.test.tsx tests/unit/ui/history/repository-history-panel.test.tsx
```

- [ ] **Step 10: Commit**

```bash
git add ui/src/history/gitGraphLayout.ts ui/src/components/History/GitCommitGraph.tsx ui/src/components/History/RepositoryCommitMenu.tsx ui/src/components/History/RepositoryHistoryPanel.tsx ui/src/contexts/historyTranslations.ts ui/src/styles/global/global-history-diff.css tests/unit/ui/history/git-graph-layout.test.ts tests/unit/ui/history/repository-commit-menu.test.tsx tests/unit/ui/history/repository-history-panel.test.tsx
git commit -m "feat(history): add continuous commit graph and actions"
```

---

### Task 2: Explicit repository view and per-workspace persistence

**Files:**
- Create: `ui/src/history/repositoryView.ts`
- Modify: `ui/src/themeTypes.ts`
- Modify: `ui/src/contexts/useAppStateEffects.ts`
- Modify: `ui/src/contexts/RepositorySnapshotContext.tsx`
- Create test: `tests/unit/ui/history/repository-view.test.ts`
- Test: `tests/unit/ui/history/repository-snapshot-context.test.tsx`

**Interfaces:**

```ts
export type RepositoryView =
  | { readonly mode: 'live' }
  | { readonly mode: 'revision'; readonly oid: string; readonly headOid: string };

export interface PersistedRepositoryRevisionSelection {
  readonly oid: string;
}

export type PersistedRepositoryRevisionSelections =
  Record<string, PersistedRepositoryRevisionSelection>;

export function repositoryWorkspaceKey(workspacePath?: string, workspaceName?: string): string;
export function readPersistedRevision(
  selections: PersistedRepositoryRevisionSelections | undefined,
  workspaceKey: string,
): string | null;
export function writePersistedRevision(
  selections: PersistedRepositoryRevisionSelections | undefined,
  workspaceKey: string,
  oid: string | null,
): PersistedRepositoryRevisionSelections;
```

Extend `PersistedState`:

```ts
repositoryRevisionSelections?: PersistedRepositoryRevisionSelections;
```

Extend `RepositorySnapshotContextValue`:

```ts
readonly repositoryView: RepositoryView;
activateWorkspaceRevision(oid: string): Promise<void>;
```

- [ ] **Step 1: Write persistence tests**

```ts
expect(repositoryWorkspaceKey('C:/repo', 'repo')).toBe('C:/repo');
expect(repositoryWorkspaceKey(undefined, 'repo')).toBe('repo');
const one = writePersistedRevision(undefined, 'A', 'abc');
const two = writePersistedRevision(one, 'B', 'def');
expect(readPersistedRevision(two, 'A')).toBe('abc');
expect(readPersistedRevision(writePersistedRevision(two, 'A', null), 'A')).toBeNull();
```

- [ ] **Step 2: Run persistence test and verify RED**

```bash
pnpm vitest run tests/unit/ui/history/repository-view.test.ts
```

- [ ] **Step 3: Implement `repositoryView.ts`**

Use trimmed path/name values without lowercasing. `writePersistedRevision(..., null)` returns a cloned record without the workspace key.

- [ ] **Step 4: Add provider restore tests**

Seed a stored old OID and return history containing HEAD + old commit. Assert:

```ts
expect(result.current.repositoryView).toEqual({ mode: 'revision', oid: oldOid, headOid });
```

Seed a missing OID and assert live mode plus removal of that stored entry.

- [ ] **Step 5: Run provider test and verify RED**

```bash
pnpm vitest run tests/unit/ui/history/repository-snapshot-context.test.tsx
```

- [ ] **Step 6: Refactor `RepositorySnapshotContext`**

`loadHistory()` sets `headOid`, validates the workspace's persisted OID, restores revision mode only when valid and non-HEAD, and clears invalid/HEAD selections. `activateWorkspaceRevision(oid)` loads revision files, sets `{ mode:'revision', oid, headOid }`, and persists `oid`. `returnToHead()` cancels stale requests, resets revision file state, switches to `{ mode:'live' }`, and clears the workspace entry.

- [ ] **Step 7: Preserve revision selections in general persisted-state writes**

In `useAppStateEffects`, read the current persisted state before `bridge.setState()` and carry forward `repositoryRevisionSelections`:

```ts
const currentPersisted = bridge.getState<PersistedState>();
bridge.setState<PersistedState>({
  ...currentPersisted,
  // existing normalized settings fields follow
  repositoryRevisionSelections: currentPersisted?.repositoryRevisionSelections,
});
```

- [ ] **Step 8: Run persistence/provider tests**

```bash
pnpm vitest run tests/unit/ui/history/repository-view.test.ts tests/unit/ui/history/repository-snapshot-context.test.tsx
```

- [ ] **Step 9: Commit**

```bash
git add ui/src/history/repositoryView.ts ui/src/themeTypes.ts ui/src/contexts/useAppStateEffects.ts ui/src/contexts/RepositorySnapshotContext.tsx tests/unit/ui/history/repository-view.test.ts tests/unit/ui/history/repository-snapshot-context.test.tsx
git commit -m "feat(history): persist workspace revision view"
```

---

### Task 3: Whole-workspace revision tree, navigation, and search

**Files:**
- Create: `ui/src/history/revisionWorkspace.ts`
- Modify: `ui/src/contexts/RepositorySnapshotContext.tsx`
- Modify: `ui/src/components/Sidebar/Sidebar.tsx`
- Modify: `ui/src/components/Sidebar/TreeNode.tsx`
- Modify: `ui/src/components/Sidebar/SidebarSearch.tsx`
- Modify: `ui/src/components/Sidebar/sidebarSearchTree.tsx`
- Modify: `ui/src/components/History/RepositorySnapshotContent.tsx`
- Modify: `ui/src/components/History/RepositorySnapshotPortal.tsx`
- Create test: `tests/unit/ui/history/revision-workspace.test.ts`
- Create test: `tests/unit/ui/history/revision-search.test.ts`
- Test: `tests/unit/ui/history/repository-snapshot-context.test.tsx`

**Interfaces:**

```ts
export interface RevisionWorkspaceProjection {
  readonly fileList: readonly MdFile[];
  readonly tree: FolderNode;
}

export function revisionFilePath(oid: string, path: string): string;
export function buildRevisionWorkspaceProjection(
  oid: string,
  files: readonly GitRevisionFile[],
): RevisionWorkspaceProjection;

export async function searchRevisionWorkspace(
  oid: string,
  files: readonly GitRevisionFile[],
  readFile: (oid: string, path: string) => Promise<GitRevisionFileSnapshot>,
  query: string,
  matchCase: boolean,
  signal?: AbortSignal,
): Promise<WorkspaceSearchResult[]>;
```

`FileNode` and `FolderNodeView` gain:

```ts
onNavigate?: (file: MdFile) => void;
```

- [ ] **Step 1: Write revision projection tests**

```ts
const projection = buildRevisionWorkspaceProjection('abc', [
  { path: 'README.md' },
  { path: 'docs/a.md' },
  { path: 'docs/nested/b.md' },
]);
expect(projection.fileList.map((file) => file.relativePath)).toEqual([
  'README.md', 'docs/a.md', 'docs/nested/b.md',
]);
expect(revisionFilePath('abc', 'docs/a.md')).toBe('revision://abc/docs/a.md');
```

Assert nested folders and Markdown `documentKind` values.

- [ ] **Step 2: Run projection test and verify RED**

```bash
pnpm vitest run tests/unit/ui/history/revision-workspace.test.ts
```

- [ ] **Step 3: Implement revision projection**

Build a root folder `{ name:'', path:'', children:[], files:[] }`, create nested folders from path segments, and create `MdFile` objects with synthetic `fsPath`, original Git `relativePath`, basename `fileName`, basename-without-extension `title`, and extension/document kind.

- [ ] **Step 4: Write revision-search tests**

Use fake revision sources and assert case-sensitive/case-insensitive matches, cancellation, text-file filtering, and result navigation identity. Results use synthetic `fsPath` and original Git `relativePath`.

- [ ] **Step 5: Run revision-search test and verify RED**

```bash
pnpm vitest run tests/unit/ui/history/revision-search.test.ts
```

- [ ] **Step 6: Implement `searchRevisionWorkspace()`**

Read supported text/Markdown files sequentially with an upper bound of 200 files, stop immediately when `signal.aborted`, and emit the existing `WorkspaceSearchResult` fields required by sidebar rendering.

- [ ] **Step 7: Add navigation override to tree nodes**

Use one helper for click/Enter:

```ts
const openFile = () => {
  if (onNavigate) onNavigate(file);
  else navigate(file.fsPath);
};
```

Pass `onNavigate` recursively through `FolderNodeView`.

- [ ] **Step 8: Project revision state into Sidebar**

Derive:

```ts
const displayedTree = repositoryView.mode === 'revision'
  ? revisionWorkspace?.tree ?? null
  : state.tree;
const displayedFileList = repositoryView.mode === 'revision'
  ? revisionWorkspace?.fileList ?? []
  : state.fileList;
```

Use displayed values for count/filter/order. In revision mode, hide live-only pin/scope mutation controls and pass:

```tsx
onNavigate={(file) => { void openRevisionPath(file.relativePath); }}
```

- [ ] **Step 9: Route SidebarSearch through revision search**

Add this optional prop:

```ts
revisionSearch?: {
  oid: string;
  run: (query: string, matchCase: boolean, signal: AbortSignal) => Promise<WorkspaceSearchResult[]>;
  openPath: (path: string) => void;
};
```

When present, keep the existing 250ms debounce but use an `AbortController` and `revisionSearch.run` instead of posting `searchWorkspace`. Thread an `onOpenResult` callback into `sidebarSearchTree.tsx`; revision results call `revisionSearch.openPath(result.relativePath)`.

- [ ] **Step 10: Keep revision content as read-only workspace overlay**

`RepositorySnapshotPortal` renders whenever `repositoryView.mode === 'revision'`. `RepositorySnapshotContent` displays the current revision file, short SHA, and explicit Read-only label. Opening a different revision file updates only this overlay; live content/session state stays mounted underneath.

- [ ] **Step 11: Add integration assertions**

Verify revision mode changes tree files, file click calls revision read, search never posts live `searchWorkspace`, and a dirty live session still exists after `returnToHead()`.

- [ ] **Step 12: Run focused tests**

```bash
pnpm vitest run tests/unit/ui/history/revision-workspace.test.ts tests/unit/ui/history/revision-search.test.ts tests/unit/ui/history/repository-snapshot-context.test.tsx tests/unit/ui/components/sidebar-render.test.tsx
```

- [ ] **Step 13: Commit**

```bash
git add ui/src/history/revisionWorkspace.ts ui/src/contexts/RepositorySnapshotContext.tsx ui/src/components/Sidebar/Sidebar.tsx ui/src/components/Sidebar/TreeNode.tsx ui/src/components/Sidebar/SidebarSearch.tsx ui/src/components/Sidebar/sidebarSearchTree.tsx ui/src/components/History/RepositorySnapshotContent.tsx ui/src/components/History/RepositorySnapshotPortal.tsx tests/unit/ui/history/revision-workspace.test.ts tests/unit/ui/history/revision-search.test.ts tests/unit/ui/history/repository-snapshot-context.test.tsx tests/unit/ui/components/sidebar-render.test.tsx
git commit -m "feat(history): browse entire workspace at a revision"
```

---

### Task 4: History revision indicator and Edit routing

**Files:**
- Modify: `ui/src/components/Sidebar/sidebarTabs.ts`
- Modify: `ui/src/components/Sidebar/SidebarTabsHeader.tsx`
- Modify: `ui/src/components/Sidebar/Sidebar.tsx`
- Modify: `ui/src/components/Topbar/Topbar.tsx`
- Modify: `ui/src/components/shared/ToolbarActionMenu.tsx`
- Modify: `ui/src/contexts/editorUiTranslations.ts`
- Modify: `ui/src/styles/global/global-shell-control-sizing.css`
- Test: `tests/unit/ui/components/sidebar-render.test.tsx`
- Test: `tests/unit/ui/components/topbar-markdown-editing.test.tsx`
- Test: `tests/unit/ui/components/topbar-render.test.tsx`
- Test: `tests/node/sidebar-adaptive-history-contract.test.mjs`

**Interfaces:**

Extend `SidebarTabDescriptor`:

```ts
readonly indicator?: 'accent-dot';
```

Topbar route:

```ts
const handleEdit = () => {
  if (!state.currentFile || repositoryView.mode === 'revision') return;
  if (editingEnabled && activeDocumentSession) {
    setDocumentEditMode(state.currentFile, 'inline-edit');
  } else {
    openInEditor();
  }
};
```

- [ ] **Step 1: Write sidebar indicator tests**

Assert the History button contains `.sidebar__tab-state-dot` in both icon-only and icon+label layouts only when `repositoryView.mode === 'revision'` and `oid !== headOid`.

- [ ] **Step 2: Run sidebar test and verify RED**

```bash
pnpm vitest run tests/unit/ui/components/sidebar-render.test.tsx
```

- [ ] **Step 3: Implement History accent dot**

Set `indicator:'accent-dot'` on the History descriptor only in non-HEAD revision mode. `SidebarTabsHeader` renders:

```tsx
<span className="sidebar__tab-icon-wrap">
  {tab.icon}
  {tab.indicator === 'accent-dot' && <span className="sidebar__tab-state-dot" aria-hidden="true" />}
</span>
```

Style the dot absolute at the icon wrapper's top-right using `background: var(--accent)`.

- [ ] **Step 4: Write edit-routing tests**

Feature ON: Edit calls `setDocumentEditMode`. Feature OFF: Edit stays visible and calls `openInEditor`. Revision mode: Edit is disabled. Cover Electron/Tauri and VS Code mocks already used by the topbar tests.

- [ ] **Step 5: Run edit tests and verify RED**

```bash
pnpm vitest run tests/unit/ui/components/topbar-markdown-editing.test.tsx tests/unit/ui/components/topbar-render.test.tsx
```

- [ ] **Step 6: Implement Edit routing**

`showEdit` must no longer depend on `markdownEditingEnabled`. `canEdit` depends on live mode + current file + supported route. `onEdit={handleEdit}` uses internal vs external routing above. Disable the dedicated VS Code edit button during historical mode too.

- [ ] **Step 7: Run sidebar/edit contracts**

```bash
pnpm vitest run tests/unit/ui/components/sidebar-render.test.tsx tests/unit/ui/components/topbar-markdown-editing.test.tsx tests/unit/ui/components/topbar-render.test.tsx
pnpm run test:node
```

- [ ] **Step 8: Commit**

```bash
git add ui/src/components/Sidebar/sidebarTabs.ts ui/src/components/Sidebar/SidebarTabsHeader.tsx ui/src/components/Sidebar/Sidebar.tsx ui/src/components/Topbar/Topbar.tsx ui/src/components/shared/ToolbarActionMenu.tsx ui/src/contexts/editorUiTranslations.ts ui/src/styles/global/global-shell-control-sizing.css tests/unit/ui/components/sidebar-render.test.tsx tests/unit/ui/components/topbar-markdown-editing.test.tsx tests/unit/ui/components/topbar-render.test.tsx tests/node/sidebar-adaptive-history-contract.test.mjs
git commit -m "feat(editor): route edit action and mark revision mode"
```

---

### Task 5: Markdown formatting engine

**Files:**
- Create: `ui/src/editor/markdownFormatting.ts`
- Create test: `tests/unit/ui/editor/markdown-formatting.test.ts`

**Interfaces:**

```ts
export interface MarkdownSelection {
  readonly from: number;
  readonly to: number;
}

export interface MarkdownTransformResult {
  readonly source: string;
  readonly selection: MarkdownSelection;
}

export type MarkdownFormatCommand =
  | 'bold' | 'italic'
  | 'heading-1' | 'heading-2' | 'heading-3'
  | 'heading-4' | 'heading-5' | 'heading-6'
  | 'quote' | 'inline-code' | 'code-block' | 'link'
  | 'bullet-list' | 'numbered-list' | 'task-list' | 'table';

export function applyMarkdownFormat(
  source: string,
  selection: MarkdownSelection,
  command: MarkdownFormatCommand,
): MarkdownTransformResult;
```

- [ ] **Step 1: Write failing transform tests**

```ts
expect(applyMarkdownFormat('text', { from: 0, to: 4 }, 'bold')).toEqual({
  source: '**text**',
  selection: { from: 2, to: 6 },
});
expect(applyMarkdownFormat('', { from: 0, to: 0 }, 'bold')).toEqual({
  source: '****',
  selection: { from: 2, to: 2 },
});
expect(applyMarkdownFormat('one\ntwo', { from: 0, to: 7 }, 'bullet-list').source)
  .toBe('- one\n- two');
expect(applyMarkdownFormat('title', { from: 0, to: 5 }, 'heading-3').source)
  .toBe('### title');
```

Add exact tests for heading replacement, quote, numbered/task lists, link, inline code, fenced code, and table template.

- [ ] **Step 2: Run transform test and verify RED**

```bash
pnpm vitest run tests/unit/ui/editor/markdown-formatting.test.ts
```

- [ ] **Step 3: Implement wrappers and line transforms**

Use private helpers for selected-range wrapping and selected-line prefix replacement. Heading replaces existing `#{1,6}\s+`; list commands replace an existing list prefix rather than double-prefixing.

- [ ] **Step 4: Implement link/code/table transforms**

No-selection link inserts `[text](url)` and selects `text`. Code block wraps with triple backticks on separate lines. Table inserts:

```md
| Column 1 | Column 2 |
| --- | --- |
| Value 1 | Value 2 |
```

and selects `Column 1`.

- [ ] **Step 5: Run formatting tests**

```bash
pnpm vitest run tests/unit/ui/editor/markdown-formatting.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add ui/src/editor/markdownFormatting.ts tests/unit/ui/editor/markdown-formatting.test.ts
git commit -m "feat(editor): add Markdown formatting commands"
```

---

### Task 6: CodeMirror source editor and formatting toolbar

**Files:**
- Modify: `ui/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `ui/src/components/Content/MarkdownSourceEditor.tsx`
- Create: `ui/src/components/Content/MarkdownFormattingToolbar.tsx`
- Modify: `ui/src/components/Content/DocumentSurface.tsx`
- Delete after replacement: `ui/src/components/Content/PlainMarkdownEditor.tsx`
- Modify: `ui/src/contexts/editorUiTranslations.ts`
- Modify: `ui/src/styles/global/global-markdown-editing.css`
- Create test: `tests/unit/ui/components/markdown-source-editor.test.tsx`
- Create test: `tests/unit/ui/components/markdown-formatting-toolbar.test.tsx`
- Modify: `tests/unit/ui/components/document-surface.test.tsx`
- Delete after equivalent coverage: `tests/unit/ui/components/plain-markdown-editor.test.tsx`
- Test: `tests/unit/ui/components/content-plain-mode-integration.test.tsx`
- Test: `tests/unit/ui/split-view/split-content.test.tsx`

**Interfaces:**

```ts
interface MarkdownSourceEditorProps {
  value: string;
  disabled: boolean;
  ariaLabel: string;
  language: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onPreview: () => void;
}
```

```ts
export interface MarkdownEditorActions {
  format(command: MarkdownFormatCommand): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}
```

- [ ] **Step 1: Add CodeMirror dependencies**

```bash
pnpm --filter ./ui add @codemirror/state @codemirror/view @codemirror/commands @codemirror/lang-markdown @codemirror/language
```

- [ ] **Step 2: Write failing source-editor tests**

Verify initial value, external value synchronization, `onChange`, disabled state, Ctrl/Cmd+S → `onSave`, Ctrl/Cmd+B → bold transform, and no save call on ordinary edits.

- [ ] **Step 3: Run source-editor test and verify RED**

```bash
pnpm vitest run tests/unit/ui/components/markdown-source-editor.test.tsx
```

- [ ] **Step 4: Implement CodeMirror lifecycle**

Create `EditorState` with `markdown()`, `lineNumbers()`, `history()`, `defaultKeymap`, and `historyKeymap`. Use a `Compartment` for editable/read-only state. On external `value` change:

```ts
if (view.state.doc.toString() !== value) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: value },
  });
}
```

Use a local synchronization guard so that transaction does not call `onChange` back to the app. Ctrl/Cmd+S invokes `onSave`; Ctrl/Cmd+B/I applies the pure formatter to the current selection and dispatches the resulting source + selection.

- [ ] **Step 5: Write failing toolbar tests**

Mock `MarkdownEditorActions`. Assert each button sends the exact command ID; Undo/Redo honor `canUndo`/`canRedo`; Preview calls `onPreview`.

- [ ] **Step 6: Run toolbar test and verify RED**

```bash
pnpm vitest run tests/unit/ui/components/markdown-formatting-toolbar.test.tsx
```

- [ ] **Step 7: Implement toolbar**

Provide Bold, Italic, H1–H6, Quote, Inline code, Code block, Link, Bullet list, Numbered list, Task list, Table, Undo, Redo, and Preview. Every button uses translated `aria-label`/tooltip text.

- [ ] **Step 8: Integrate into `DocumentSurface`**

Replace the `PlainMarkdownEditor` branch with `MarkdownSourceEditor`. Add:

```ts
onModeChange?: (mode: DocumentViewMode) => void;
```

and wire Preview with:

```tsx
onPreview={() => onModeChange?.('rendered')}
```

Thread `onModeChange` from existing `ContentMainView` and `SplitContent` mode setters. Keep `onSourceChange` and `onSave` unchanged.

- [ ] **Step 9: Remove textarea component/tests after equivalent coverage exists**

Delete `PlainMarkdownEditor.tsx` and `plain-markdown-editor.test.tsx`. Update `document-surface.test.tsx` to assert the CodeMirror host and toolbar instead of `<textarea>`.

- [ ] **Step 10: Run focused editor tests**

```bash
pnpm vitest run tests/unit/ui/editor/markdown-formatting.test.ts tests/unit/ui/components/markdown-source-editor.test.tsx tests/unit/ui/components/markdown-formatting-toolbar.test.tsx tests/unit/ui/components/document-surface.test.tsx tests/unit/ui/components/content-plain-mode-integration.test.tsx tests/unit/ui/split-view/split-content.test.tsx
```

- [ ] **Step 11: Commit**

```bash
git add ui/package.json pnpm-lock.yaml ui/src/components/Content/MarkdownSourceEditor.tsx ui/src/components/Content/MarkdownFormattingToolbar.tsx ui/src/components/Content/DocumentSurface.tsx ui/src/contexts/editorUiTranslations.ts ui/src/styles/global/global-markdown-editing.css tests/unit/ui/components/markdown-source-editor.test.tsx tests/unit/ui/components/markdown-formatting-toolbar.test.tsx tests/unit/ui/components/document-surface.test.tsx tests/unit/ui/components/content-plain-mode-integration.test.tsx tests/unit/ui/split-view/split-content.test.tsx
git rm ui/src/components/Content/PlainMarkdownEditor.tsx tests/unit/ui/components/plain-markdown-editor.test.tsx
git commit -m "feat(editor): embed CodeMirror Markdown source editor"
```

---

### Task 7: Coverage, documentation, review, and full verification

**Files:**
- Modify: `tests/manifest/editor-git-split-coverage-manifest.ts`
- Modify: `docs/git-history-diff.md`
- Modify: `docs/instructions/03-features/03-sidebar-tree-and-scope.md`
- Modify: `docs/instructions/04-runtimes/06-runtime-parity.md`
- Modify: `docs/instructions/05-reference/07-current-app-state.md`
- Modify: `docs/instructions/06-quality/07-release-acceptance-matrix.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Coverage ownership required:**

```text
RepositoryCommitMenu.tsx -> repository-commit-menu.test.tsx
repositoryView.ts -> repository-view.test.ts
revisionWorkspace.ts -> revision-workspace.test.ts + revision-search.test.ts
MarkdownSourceEditor.tsx -> markdown-source-editor.test.tsx
MarkdownFormattingToolbar.tsx -> markdown-formatting-toolbar.test.tsx
markdownFormatting.ts -> markdown-formatting.test.ts
```

- [ ] **Step 1: Update coverage manifest with the real focused tests above**

Do not map a production file to a test that does not import or exercise it.

- [ ] **Step 2: Run contracts and Node tests**

```bash
pnpm run test:contracts
pnpm run test:node
```

Expected: zero coverage-manifest and source-LOC violations. Split oversized production files; do not raise contract budgets.

- [ ] **Step 3: Update documentation**

Document continuous graph, commit menu copy actions, whole-workspace historical mode, per-workspace restore, History dot meaning, read-only guarantees, Edit external-routing when internal editing is OFF, CodeMirror editor/toolbar, and runtime behavior. Add a surgical current-release/unreleased changelog entry without rewriting historical releases.

- [ ] **Step 4: Run translation coverage**

```bash
pnpm run test:translations
```

Expected: pass with every new key represented in required locales.

- [ ] **Step 5: Run full UI suite**

```bash
pnpm run test:ui
```

Expected: all four shards pass.

- [ ] **Step 6: Run host suites**

```bash
pnpm run test:electron
pnpm run test:vscode
pnpm run test:chromium
pnpm run test:tauri
```

Expected: all pass.

- [ ] **Step 7: Run CI-equivalent builds**

```bash
pnpm run build:ui
pnpm run build:ui:electron
pnpm run build:vscode
pnpm run build:chromium
pnpm run build:website-app
```

Expected: every command exits 0.

- [ ] **Step 8: Review the final diff against these seven concrete failure classes**

1. Revision paths reaching live filesystem write/navigation APIs.
2. Historical mode enabling internal edit, external edit, or save.
3. Persisted revision leakage between workspace keys.
4. Stale async revision/search results after workspace or commit switches.
5. CodeMirror controlled-value feedback loops causing duplicate working-copy updates.
6. Production files exceeding existing source-size contracts.
7. Editor shortcuts intercepting global app shortcuts while CodeMirror lacks focus.

For every finding, fix it and rerun the smallest test command that demonstrates the corrected behavior.

- [ ] **Step 9: Commit documentation/coverage changes**

```bash
git add tests/manifest/editor-git-split-coverage-manifest.ts docs README.md CHANGELOG.md
git commit -m "docs: document persistent history and Markdown editor"
```

- [ ] **Step 10: Push and verify PR #45 GitHub Actions on the exact new HEAD**

Completion requires the current test workflow to finish successfully for the exact HEAD, including translations, UI, Electron, contracts/Node/update contracts, host variants, Tauri coverage, and Tauri Ubuntu/macOS/Windows.

- [ ] **Step 11: Update PR #45 only after green verification**

Record the final HEAD, logical follow-up commits, user-visible behavior, read-only safety boundary, review findings, and successful workflow run ID. Do not state that CI passes before the run for the exact HEAD is complete and green.
