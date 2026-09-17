# Persistent repository snapshots, continuous history graph, and Markdown source editor

Date: 2026-09-14
Branch: `feature/editor-git-history-split-view`
PR: #45
Status: implemented foundation; superseded by later PR #48 UX details where noted

> **As-built synchronization (2026-09-17):** The persistence, continuous graph, external-vs-internal Edit routing, and CodeMirror decisions below remain valid. [`2026-09-17-pr48-as-built-sync.md`](2026-09-17-pr48-as-built-sync.md) is authoritative for the later pane-owned tabs, file drag/drop, Focus drag surface, revision Files filtering, More Actions → repository History routing, and 50-commit offset pagination/search behavior. A persisted revision is not stale merely because it is absent from the first history page.

## Goal

Improve repository history browsing so it behaves like a coherent workspace mode instead of a file-by-file preview, keep that mode across app restarts per workspace, make historical state visibly obvious, preserve an Edit action when internal editing is disabled, and upgrade Markdown Explorer's internal source editor to a GitHub-comment-style Markdown editing experience using a local open-source editor package.

## Requirements

### Repository History sidebar

- Replace the current row-local graph fragments with a visually continuous commit graph.
- Commit lanes and merge/branch curves must continue between rows instead of restarting in each row SVG.
- Commit nodes stay aligned with their corresponding commit rows.
- Clicking a commit row or node opens an anchored commit menu rather than immediately changing the whole workspace.
- Commit menu items:
  1. Commit SHA. Show an abbreviated SHA, but clicking copies the full SHA.
  2. Author. Clicking copies the author string.
  3. View workspace at this commit.
  4. Return to current HEAD when a historical workspace is active.
- Merely opening the commit menu or inspecting a commit must not activate historical workspace mode.

### Historical workspace mode

Choosing **View workspace at this commit** switches the entire current workspace into a read-only snapshot of the selected revision.

Historical mode affects:

- Files tree and visible workspace file set.
- Opening and navigating files.
- Rendered document content.
- Workspace search for text/Markdown files.
- History state and current revision indication.
- Edit/save availability.

Historical mode must not affect or mutate:

- The checked-out Git branch.
- The working tree.
- Stashes.
- The live file system.
- Unsaved live Markdown Explorer editor sessions.

Supported hosts continue to use read-only Git operations only. The existing repository-history boundary remains the source for revision file lists and file contents.

### Persistence

Historical revision selection is persisted per workspace.

Preferred key:

```ts
workspacePath
```

Fallback only when a path is unavailable:

```ts
workspaceName
```

Persisted data is conceptually:

```ts
interface PersistedRepositoryRevisionSelection {
  oid: string;
}

type PersistedRepositoryRevisionSelections = Record<
  string,
  PersistedRepositoryRevisionSelection
>;
```

On workspace load:

1. Resolve Git capability.
2. Load enough repository history to establish current HEAD and validate the stored OID.
3. If the stored OID is valid and differs from HEAD, restore historical workspace mode.
4. If the stored OID equals HEAD, normalize to live mode and remove the persisted entry.
5. If the stored OID no longer exists, Git is unavailable, or the workspace is no longer a repository, clear the stale entry and remain at current live HEAD.

Selections must never leak between workspaces.

### Repository view model

Historical mode should be represented explicitly instead of inferred from the currently opened file.

Conceptual model:

```ts
type RepositoryView =
  | { mode: 'live' }
  | {
      mode: 'revision';
      oid: string;
      headOid: string;
    };
```

The repository-view state is the source of truth for deciding whether workspace reads come from the live host or a Git revision.

Returning to HEAD switches the repository view back to `live`, clears the persisted revision selection for the workspace, and restores the existing live workspace view/session state.

### History tab reminder

When the entire workspace is viewing a non-HEAD revision, show a small accent-colored notification dot at the top-right of the History tab icon.

The dot is shown only when:

```ts
repositoryView.mode === 'revision' && repositoryView.oid !== repositoryView.headOid
```

The dot must not appear merely because a commit menu is open or a commit is selected for inspection.

The indicator must work in both icon-only sidebar-tab layout and icon-plus-label layout.

## Continuous Git graph design

The current implementation renders a separate SVG inside each commit row. That causes visual discontinuity. Replace it with one graph layer for the visible commit list.

`layoutGitGraph()` remains responsible for assigning each commit to a lane, but its output expands to include line/curve segment geometry across row boundaries.

Conceptual output:

```ts
interface GitGraphSegment {
  fromRow: number;
  fromLane: number;
  toRow: number;
  toLane: number;
  parentOid: string;
}

interface GitGraphLayout {
  nodes: readonly GitGraphNode[];
  segments: readonly GitGraphSegment[];
  laneCount: number;
}
```

`GitCommitGraph` renders:

- A single absolutely positioned SVG behind the complete ordered list.
- Continuous vertical lane paths.
- Curves where a parent moves to another lane.
- Merge connections to additional parents.
- A node circle for each visible commit.
- Commit-row content above the SVG.

Parents outside the loaded history window may terminate at the edge of the rendered graph rather than producing invalid geometry.

The graph should continue to use theme tokens/current color rather than fixed brand colors.

## Commit menu design

Create a small focused component for commit actions instead of embedding menu logic inside graph layout code.

Suggested responsibilities:

```ts
RepositoryCommitMenu
```

Inputs:

- commit metadata
- anchor position/element
- whether this commit is the active historical revision
- whether the application is already in any historical revision
- copy callback or platform clipboard bridge
- activate-revision callback
- return-to-HEAD callback

The SHA and author entries are interactive copy actions and provide a short copied confirmation using the existing action-notice mechanism.

The activation action should be visually distinct from metadata-copy entries but remain within the same compact menu.

## Revision-backed workspace data flow

Live and historical workspace data must remain separate.

```text
RepositoryView = live
  -> existing host workspace file tree
  -> existing file navigation/read APIs
  -> existing live workspace search/index
  -> editing allowed according to settings

RepositoryView = revision(oid)
  -> listRevisionFiles(oid)
  -> build revision file tree
  -> readRevisionFile(oid, path)
  -> client-side revision search for supported text files
  -> always read-only
```

### Files tree

When entering revision mode, build the sidebar file tree from `listRevisionFiles(oid)` rather than replacing the application's live file list permanently.

The historical tree is view state only. The original live file list/tree remain available for immediate restoration when returning to HEAD.

### File navigation

Selecting a historical file reads it through `readRevisionFile(oid, path)` and displays it as a revision-backed document. It does not open an editable document session or alter the live current file on disk.

### Search

For the first implementation, revision workspace search is client-side and intentionally scoped:

- Search text/Markdown-like files from the selected revision.
- Reuse revision file reads.
- Apply existing practical limits/cancellation behavior to avoid reading an unbounded repository in one operation.
- Do not add new native Git search commands until measurements show they are necessary.

Search result navigation stays within the selected revision.

### Live editor/session preservation

Entering revision mode does not discard or overwrite live editor sessions. Dirty working copies remain in memory. Historical view is an overlay/source switch for workspace reads.

Returning to HEAD restores the live workspace and prior live editor/session state.

## Edit action behavior

The More Actions menu should continue to show **Edit** whenever the current live document has a valid edit target.

Behavior:

```ts
if (repositoryView.mode === 'revision') {
  disableEdit();
} else if (settings.markdownEditingEnabled) {
  openMarkdownExplorerEditor();
} else {
  openExternalEditor();
}
```

### Runtime mapping

- VS Code: external edit uses the existing native VS Code editor action.
- Electron/Tauri: use the existing host/open-in-editor path. Do not silently turn on Markdown Explorer editing.
- Historical revision mode: Edit is disabled because revision workspaces are read-only.

The menu item's label can remain **Edit**; tooltip/help text should describe whether it opens Markdown Explorer or the external editor when useful.

## Markdown source editor

### Package choice

Use CodeMirror 6 as the embedded source editor.

Constraints:

- Open source.
- Free for commercial use.
- Local/offline capable.
- No telemetry requirement.
- No CDN or hosted runtime dependency.
- No proprietary paid extension required.

Keep dependencies narrowly scoped, expected to include:

```text
@codemirror/state
@codemirror/view
@codemirror/commands
@codemirror/lang-markdown
@codemirror/language
```

Do not introduce Monaco or a WYSIWYG round-trip layer for this scope.

### Ownership boundary

CodeMirror owns editor interaction only:

- text selection/cursor
- local undo/redo
- Markdown syntax highlighting
- editor keymaps
- formatting command application

Markdown Explorer remains authoritative for:

- document working-copy state
- dirty state
- save state
- conflict detection
- disk writes
- split-view synchronization
- Git history
- unsaved-close protection

The editor must publish source changes through the existing working-document update path rather than inventing a parallel persistence model.

### Source editor UI

Replace the current plain source textarea with a reusable `MarkdownSourceEditor` built on CodeMirror.

Minimum behavior:

- Markdown syntax highlighting.
- Line numbers.
- Selection-aware formatting commands.
- Tab/Shift+Tab indentation.
- Undo/redo.
- `Ctrl/Cmd+S` routed to the existing protected save flow.
- Existing disabled/saving state respected.
- Rendered/Preview switch continues to use the current Markdown renderer.

### Formatting toolbar

Provide a compact GitHub-comment-style Markdown toolbar with at least:

- Bold
- Italic
- Heading
- Quote
- Inline code
- Fenced code block
- Link
- Bulleted list
- Numbered list
- Task list
- Table insertion helper
- Undo
- Redo
- Preview/Rendered mode

Formatting commands operate on source text, not generated HTML.

Expected behavior examples:

- Bold with selected `text` -> `**text**`.
- Bold with no selection -> insert `****` and place the cursor between the middle markers.
- Italic follows equivalent selection behavior.
- Heading applies/replaces a leading `#` sequence on affected lines.
- Quote/list/task-list commands apply across all selected lines.
- Link wraps selected text or inserts a placeholder link when no text is selected.
- Code block wraps selected multiline content in fenced backticks.
- Table helper inserts a small valid Markdown table template.

Formatting commands should be implemented independently from React presentation so they can be unit tested without mounting CodeMirror.

### Keyboard shortcuts

At minimum:

- `Ctrl/Cmd+B`: bold
- `Ctrl/Cmd+I`: italic
- `Ctrl/Cmd+S`: save
- editor-native undo/redo shortcuts

Avoid overriding application-global shortcuts unless the CodeMirror editor currently owns focus and the command is editor-specific.

### Inline Edit

Inline Edit remains lightweight. Do not mount a full CodeMirror instance into every rendered Markdown element.

Where useful, inline editing may reuse the same pure formatting-command helpers later, but integrating the full formatting toolbar into Inline Edit is not required for this scope.

## Error handling

### Historical workspace

- Stored commit missing after rebase/prune: clear persisted selection and return to HEAD.
- Git capability unavailable: stay live and clear invalid historical state.
- Revision file read failure: show an error for that file but keep revision mode active.
- Revision search partial read failure: continue other files and surface a non-fatal search warning.
- Workspace changes while revision requests are in flight: ignore stale results through generation/request guards.

### Editor

- CodeMirror initialization failure must not corrupt document state.
- Save errors continue through existing save/conflict UI.
- Editor source is never considered saved until the existing save flow confirms success.
- Historical documents never create writable sessions.

## Accessibility

- Commit nodes/rows and commit-menu actions are keyboard reachable.
- Commit menu has correct menu semantics or equivalent accessible button/list semantics.
- Copy actions have descriptive labels such as "Copy full commit SHA" and "Copy author".
- The historical History-tab dot must not be the only indication of revision mode; historical document/workspace UI retains a readable revision/read-only label.
- Markdown toolbar buttons expose names and pressed/state semantics where appropriate.
- Formatting actions remain usable by keyboard.

## Testing strategy

### Graph tests

- Single linear history produces continuous vertical segments.
- Branch and merge histories produce correct cross-lane segments.
- Nodes align to rows.
- Parents outside the loaded history window terminate safely.
- Clicking a row/node opens the menu without activating revision mode.

### Commit menu tests

- SHA displays abbreviated value and copies full OID.
- Author copies author text.
- View-workspace action activates the selected revision.
- Return-to-HEAD is shown when appropriate.

### Persistence tests

- Revision is persisted by normalized workspace key.
- Same workspace restores the selected revision after provider/app remount.
- Different workspaces do not share revision state.
- Stored HEAD normalizes back to live mode.
- Missing/stale commits clear persisted state.
- Return to HEAD clears persisted state.

### Historical workspace integration tests

- File tree comes from selected revision.
- Opening historical files uses revision reads.
- Historical navigation/search stays revision-scoped.
- Historical documents are read-only.
- Existing dirty live sessions survive entering/leaving historical mode.
- History tab shows the accent dot only for non-HEAD workspace mode.

### Edit routing tests

- `markdownEditingEnabled = true` -> Edit opens Markdown Explorer editor.
- `markdownEditingEnabled = false` -> Edit remains visible and opens the external/native editor.
- Historical mode -> Edit is disabled.
- Electron, Tauri, and VS Code mappings are covered.

### Markdown editor tests

- CodeMirror source updates flow into the existing working-copy model.
- Bold/italic with and without selections.
- Heading replacement.
- Quote and list operations over multiline selections.
- Task-list formatting.
- Link insertion.
- Fenced code-block insertion.
- Table helper insertion.
- Undo/redo behavior.
- Save shortcut uses the existing save API.
- Dirty/conflict behavior remains unchanged.
- Historical revision sources cannot be edited.

## Documentation and coverage

Update relevant history/editor/runtime docs and the coverage manifest for new production modules.

Document:

- Continuous repository history graph.
- Commit action menu.
- Persistent per-workspace historical mode.
- Meaning of the History-tab accent dot.
- Read-only historical workspace behavior.
- Edit routing when Markdown Explorer editing is disabled.
- CodeMirror-based Markdown source editor and toolbar.
- Runtime differences for external editing.

## Non-goals

- WYSIWYG Markdown editing.
- Checking out or switching the actual Git working tree to old commits.
- Editing or saving historical revisions.
- Git commit creation from Markdown Explorer.
- Git branch management UI.
- Server/remote repository history.
- A new native Git search endpoint unless client-side revision search proves insufficient.
- Full CodeMirror integration inside Inline Edit elements.

## Implementation boundaries

Prefer small focused units:

- `gitGraphLayout` owns graph geometry only.
- `GitCommitGraph` owns rendering the continuous graph and commit rows.
- `RepositoryCommitMenu` owns commit actions.
- `RepositorySnapshotContext` or a renamed repository-view context owns revision mode and persistence coordination.
- A revision-workspace adapter owns revision tree/file/search projections.
- `MarkdownSourceEditor` owns the CodeMirror instance lifecycle.
- Markdown formatting commands live in a pure editor utility module.
- Existing document-session/save modules remain unchanged in responsibility.

Avoid growing `Sidebar.tsx`, `Topbar.tsx`, or `RepositorySnapshotContext.tsx` into multi-purpose modules; extract new behavior where necessary to stay within existing source-size contracts.

## Commit strategy

Keep PR #45 and add only a small logical follow-up stack, for example:

1. History graph/menu and persistent repository-view state.
2. Revision-backed workspace browsing/search and edit-routing update.
3. CodeMirror Markdown source editor and formatting toolbar.
4. Tests/docs/CI fixes required by the above.

Do not rewrite `main` and do not merge the PR as part of implementation unless separately requested.

## Acceptance criteria

The change is complete when all of the following are true:

- History lines and nodes render continuously across commit rows.
- Commit click opens a menu with copyable SHA, copyable author, and workspace-at-commit action.
- Selecting an old commit switches the complete workspace into a read-only revision view.
- Revision mode persists per workspace and restores after app restart.
- Invalid persisted revisions safely fall back to live HEAD.
- A visible accent dot marks History while a non-HEAD workspace revision is active.
- Returning to HEAD restores the live workspace/session state and clears persistence.
- More Actions always offers Edit for live editable documents; feature OFF routes externally, feature ON routes internally.
- Historical mode prevents editing.
- The plain Markdown source editor is replaced with a CodeMirror-based editor.
- The Markdown toolbar provides the approved baseline formatting actions and shortcuts.
- Existing save/conflict/dirty-session behavior remains authoritative.
- Electron, Tauri, VS Code, Chromium/Web fallback behavior remains valid.
- Focused tests and full GitHub Actions checks pass before completion is claimed.
