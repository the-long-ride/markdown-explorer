# Markdown Editing, Git History, and Split View Design

**Date:** 2026-09-06  
**Status:** Approved design draft  
**Branch:** `feature/editor-git-history-split-view`

## 1. Goals

Add three related capabilities while preserving Markdown Explorer's local-first architecture and avoiding new production editor or Git dependencies:

1. Edit Markdown files directly inside Markdown Explorer.
2. Inspect local Git history and compare revisions on desktop and VS Code runtimes.
3. Open two documents side by side with independent modes per pane.

The work must remain local, commercially usable under the project's existing licensing model, and must not add a new third-party editor framework or browser-side Git implementation.

## 2. Product Decisions

### Markdown editing

- Default document experience remains rendered Markdown.
- **Inline section editing** is the primary editing mode.
- **Plain mode** edits the complete raw Markdown source.
- No CodeMirror, Monaco, TipTap, ProseMirror, or equivalent editor package is introduced.
- Use React, native browser editing controls, and the existing Markdown parser/renderer.

### Editing runtime scope

Editing is available wherever Markdown Explorer has a safe writable local-file capability:

| Runtime | Editing support |
| --- | --- |
| Electron | Yes |
| Tauri | Yes |
| VS Code | Yes |
| Chromium extension | Yes, when write permission is granted |
| Web app | Yes, when File System Access API write permission is granted |
| Browser without writable File System Access | Read-only |

### Git history runtime scope

Git features are intentionally host-only and use the user's installed local `git` executable.

| Runtime | Git history/diff |
| --- | --- |
| Electron | Yes |
| Tauri | Yes |
| VS Code | Yes |
| Chromium extension | No |
| Web app | No |

No `simple-git`, `isomorphic-git`, libgit2 wrapper, or remote Git API is added.

### Split view

- Maximum two panes in the first release.
- Horizontal side-by-side split only.
- Each pane owns an independent document and independent mode.
- Supported pane modes:
  - Rendered
  - Inline Edit
  - Plain
  - Git Revision
  - Diff
- The active pane receives keyboard/navigation actions.
- Each pane keeps independent scroll position.
- Synchronized scrolling is limited to Diff mode initially.

## 3. Existing Architecture Fit

Markdown Explorer already separates the shared React UI from privileged runtime hosts through a typed bridge. The shared UI owns presentation and document state; Electron, Tauri, VS Code, Chromium, and Web hosts own filesystem capabilities.

This design preserves that boundary:

```text
Shared React UI
    |
    | typed request/response bridge
    v
Runtime host
    |
    +-- filesystem read/write
    +-- local git process (Electron/Tauri/VS Code only)
```

The current content-tab model already stores source Markdown alongside rendered HTML. Editing extends that model rather than creating a second document-loading pipeline.

## 4. Feature Boundaries

Three feature domains should stay isolated:

```text
ui/src/editor/
ui/src/history/
ui/src/split-view/
```

### 4.1 Editor domain

Responsibilities:

- edit-session lifecycle
- dirty state
- source ranges for inline edits
- plain source editing
- save requests
- conflict detection flow
- local re-render after edits
- close/navigation guards for unsaved content

The editor domain does not invoke filesystem APIs directly. It emits bridge requests and consumes correlated host results.

### 4.2 History domain

Responsibilities:

- Git capability state
- commit/revision models
- history list UI
- historical snapshots
- line-based diff model
- source diff rendering
- rendered-diff presentation

The history domain never executes shell strings. Hosts expose structured Git operations only.

### 4.3 Split-view domain

Responsibilities:

- two-pane layout
- active pane
- pane document identity
- pane mode
- pane-specific scroll/session state
- divider sizing
- pane close/replace behavior

Split view treats editing and history as pane capabilities instead of embedding their internals.

## 5. Document Session Model

The current `ContentTab` model should evolve into a document-session-aware representation while remaining compatible with existing tab restoration.

Recommended conceptual state:

```ts
type DocumentViewMode =
  | 'rendered'
  | 'inline-edit'
  | 'plain'
  | 'git-revision'
  | 'diff';

interface EditableDocumentState {
  source: string;
  persistedSource: string;
  dirty: boolean;
  editStartedRevision: DocumentRevisionToken | null;
  pendingSave: boolean;
  conflict: DocumentConflict | null;
}

interface PaneState {
  id: 'primary' | 'secondary';
  filePath: string | null;
  mode: DocumentViewMode;
  scrollTop: number;
  revision?: GitRevisionRef;
  diff?: DiffSelection;
}
```

`persistedSource` is the last source confirmed by the host. `source` is the current working copy in the UI. Dirty state is derived from those values, not maintained as a separate source of truth where avoidable.

## 6. Safe File Write Protocol

### 6.1 Revision token

Every Markdown document loaded for editing receives a host-derived revision token representing the disk state observed at load/save time.

The token should be cheap and deterministic for a runtime, for example:

```text
modified timestamp + byte length
```

or a stronger host-local fingerprint if already practical.

The UI includes the token when saving.

### 6.2 Save request

Conceptual UI-to-host request:

```ts
{
  command: 'saveDocument',
  requestId,
  filePath,
  source,
  expectedRevision
}
```

Conceptual result:

```ts
{
  command: 'saveDocumentResult',
  requestId,
  ok,
  filePath,
  revision?,
  conflict?,
  errorCode?
}
```

### 6.3 Conflict protection

Before writing, the host compares `expectedRevision` with the current on-disk revision.

If unchanged:

1. Write the file.
2. Return a new revision token.
3. UI updates `persistedSource`.
4. UI re-renders the source using the existing parser/renderer.
5. Existing workspace/search/insights refresh paths receive the resulting file change normally.

If changed externally:

- Do not overwrite automatically.
- Return a conflict result.
- UI offers:
  - Reload disk version
  - Keep my edit
  - Compare changes

"Keep my edit" is an explicit force-save action with a new request indicating user-confirmed overwrite.

### 6.4 Atomicity

Desktop hosts should prefer safe write semantics suitable for their existing runtime conventions. The design does not require a common implementation technique across runtimes, but a failed write must not be reported as success.

Browser hosts use the File System Access API writable stream only after explicit `readwrite` permission.

## 7. Inline Section Editing

### 7.1 Editing model

Rendered mode remains unchanged until the user activates editing on a source-backed block.

A source-backed block temporarily becomes a local Markdown source editor using native controls. Saving the block updates the document working copy and re-renders the document.

### 7.2 Supported blocks for first release

Inline editing should only activate where Markdown Explorer can map rendered output to a reliable source range.

Initial targets:

- headings
- paragraphs
- blockquotes
- list blocks
- fenced code blocks
- Markdown tables

Unsupported/ambiguous rendered constructs remain readable and can still be edited in Plain mode.

### 7.3 Source mapping

The Markdown parsing pipeline should expose source-range metadata for supported block tokens. Do not reconstruct Markdown from rendered HTML.

Each editable block needs:

```ts
interface EditableSourceRange {
  start: number;
  end: number;
  kind: EditableBlockKind;
}
```

Inline editing replaces exactly that range in the working source.

Source ranges must be recalculated after each accepted edit because offsets after the changed range may move.

### 7.4 Save semantics

Inline block "Save" commits the block change into the document working copy, not necessarily directly to disk.

The document itself remains dirty until the user saves the document. This gives Plain mode and Inline Edit the same save model and avoids surprising file writes for every small block edit.

A separate explicit document Save command writes the complete source to disk.

## 8. Plain Mode

Plain mode provides a complete raw Markdown editor using a native `<textarea>` or equivalent browser-native text control.

Requirements:

- full source editing
- selection/caret retained while staying in Plain mode
- standard undo/redo provided by the native editing control
- keyboard Save action
- dirty indicator
- no syntax-highlighting dependency in the first release
- switching to Rendered/Inline Edit uses the current working source, not stale persisted source

The rendered representation can be regenerated from the working source without waiting for disk save.

## 9. Unsaved-Change UX

Dirty documents show an indicator in content tabs and affected panes.

Closing or replacing a dirty document prompts:

- Save
- Don't Save
- Cancel

The guard applies to:

- closing a content tab
- closing a split pane containing the only active view of a dirty document
- closing a workspace
- replacing a workspace
- quitting the desktop app when dirty sessions exist

If the same file appears in two panes, both panes reference the same underlying editable document session so edits cannot diverge silently.

## 10. Git Host Capability

### 10.1 Capability discovery

Electron, Tauri, and VS Code hosts expose Git availability through host capability state.

The host detects:

- whether `git` is executable
- whether the active workspace/file is inside a Git work tree
- repository root

Git UI is hidden or disabled when unavailable.

### 10.2 Security model

Hosts execute Git with argument arrays and a controlled working directory.

Never construct shell command strings from file names, revisions, or user text.

Only supported read operations are exposed. The first release does not commit, checkout, reset, restore, stage, stash, branch, or mutate repository state.

### 10.3 Structured operations

Suggested bridge operations:

- `getGitCapability`
- `listDocumentHistory`
- `readGitRevision`
- `compareGitRevisions`

Hosts may internally use commands equivalent to:

```text
git log --follow -- <path>
git show <revision>:<repo-relative-path>
git diff <revisionA> <revisionB> -- <path>
```

Exact command flags belong in runtime implementation, not the shared UI contract.

Revision identifiers received from the UI must be validated against identifiers previously returned by the host or constrained to safe commit-ish formats before execution.

## 11. Git History UI

History is document-focused, not a full repository Git client.

For the active document, show a revision list containing:

- commit hash (short display, full internal value)
- commit subject
- author name
- timestamp
- rename/path information when available

Selecting a revision opens it read-only in Git Revision mode.

Actions:

- View revision
- Compare with current
- Compare with another selected revision

Historical snapshots never become editable in place.

## 12. Diff Engine and Viewer

### 12.1 Diff inputs

The diff feature supports:

- Git revision -> current persisted file
- Git revision -> Git revision
- current persisted file -> unsaved working source
- external-conflict disk source -> unsaved working source

### 12.2 Diff implementation

Do not add a production diff package initially.

Implement a focused local line-oriented diff engine in the shared codebase with deterministic output and tests. It should produce a model such as:

```ts
type DiffLine =
  | { type: 'context'; left?: number; right?: number; text: string }
  | { type: 'remove'; left: number; text: string }
  | { type: 'add'; right: number; text: string };
```

The first release prioritizes correctness and readability over advanced move detection or semantic diffing.

### 12.3 Source Diff

Source Diff shows exact Markdown line additions/removals with line numbers and synchronized scrolling.

### 12.4 Rendered Diff

Rendered Diff is a readability layer built from the diff model, not an HTML-to-HTML diff.

It should preserve Markdown block context where practical while clearly identifying added and removed source-backed regions.

If a structure cannot be represented reliably in rendered diff, fall back to a source-diff presentation for that region rather than inventing content.

## 13. Split Document View

### 13.1 Layout

The content area can switch from one pane to two panes:

```text
+----------------------+----------------------+
| Primary pane         | Secondary pane       |
| document + mode      | document + mode      |
+----------------------+----------------------+
```

A draggable divider controls the width ratio within reasonable minimum pane widths.

The first release has no vertical split and no more than two panes.

### 13.2 Pane state

Each pane independently stores:

- selected file
- view mode
- scroll position
- selected Git revision when applicable
- diff selection when applicable

The active pane is visually indicated and determines the target for pane-scoped keyboard actions.

### 13.3 Shared document sessions

Pane state and document-edit state are separate.

If both panes show the same file:

- they may use different modes
- they share the same working source and dirty state
- a change made in one pane is visible to the other after its rendered representation updates

This avoids two competing unsaved copies of the same file.

### 13.4 Navigation

Normal link navigation affects only the active pane while split view is open unless an explicit "open in other pane" action is used.

Recommended actions:

- Open in split
- Move to other pane
- Swap panes
- Close split

Existing content tabs remain document/workspace navigation constructs. Split panes are views over documents and must not create duplicate logical content tabs merely to render two panes.

## 14. Runtime Implementation Responsibilities

### Electron

- read/write current Markdown files with path validation inside the active workspace
- revision-token calculation
- local `git` process execution
- dirty-session quit guard integration

### Tauri

- equivalent file-write host command in Rust
- revision-token calculation
- local `git` process execution using non-shell argument passing
- preserve Tauri trust-boundary rules

### VS Code

- write through `vscode.workspace.fs`
- preserve VS Code URI/workspace semantics
- invoke local Git executable only for read-only history operations
- keep the existing external "open in editor" action available; in-app editing is additive

### Chromium extension

- use existing File System Access handles
- request `readwrite` permission only when editing/save is requested
- write only through resolved workspace-relative handles
- no Git feature

### Web app

- same File System Access write model when supported
- read-only when the browser lacks writable handles/capability
- no Git feature

## 15. Bridge Contract Changes

Expected new UI-to-host commands:

```text
saveDocument
getGitCapability
listDocumentHistory
readGitRevision
compareGitRevisions
```

Expected correlated host responses:

```text
saveDocumentResult
gitCapabilityResult
documentHistoryResult
gitRevisionResult
gitComparisonResult
```

All request/response operations use `requestId` and reject/ignore mismatched responses using the project's existing correlation pattern.

Runtime capability data must allow the shared UI to distinguish:

- writable document support
- Git support
- active repository support

## 16. Search, Insights, Bookmarks, and Reading State

Editing must integrate with existing features rather than creating separate copies of document state.

### Search and Insights

After a successful disk save, existing file watcher/refresh mechanisms should update search and Workspace Insights. Hosts should avoid causing duplicate refresh events where the runtime already emits filesystem changes naturally.

### Bookmarks

Source-anchored bookmarks should continue using their existing relocation/fingerprint logic after edits. Editing should not special-case bookmark storage unless tests reveal a broken invariant.

### Reading position

Pane-specific scroll state is layered on top of existing per-document reading memory. When split view closes, the primary pane's state becomes the normal single-document reading state.

## 17. Error Handling

User-visible errors should distinguish at least:

- write permission denied
- file no longer exists
- file changed externally
- write failed
- unsupported/read-only runtime
- Git executable unavailable
- workspace is not a Git repository
- requested revision unavailable
- Git operation failed

No failure should silently discard the working source.

If saving fails, the document remains dirty and editable.

If Git fails, editing and normal document reading remain unaffected.

## 18. Testing Strategy

### Shared UI/unit tests

- document dirty-state derivation
- document-session sharing across panes
- pane mode transitions
- inline source-range replacement
- source-range invalidation/recalculation after edits
- plain-mode working-source behavior
- close/navigation dirty guards
- save request/result correlation
- conflict state transitions
- line-diff correctness and deterministic output
- Git history model mapping
- two-pane active-pane routing
- split divider bounds

### Runtime tests

Electron:

- write inside workspace succeeds
- traversal/outside-workspace path rejected
- stale revision produces conflict
- force-save requires explicit request
- Git arguments are passed without shell interpolation
- non-Git workspace returns capability false

Tauri:

- equivalent filesystem and Git tests in Rust
- no shell command construction

VS Code:

- `workspace.fs.writeFile` integration
- URI/path handling
- Git capability and revision retrieval adapters

Chromium/Web:

- permission denied leaves source dirty
- writable handle saves correctly
- path traversal rejected by handle resolver
- unsupported browser is read-only

### Contract tests

Update host-message parity and protocol catalogs so every runtime either implements or explicitly reports unsupported capability for each new command.

### Regression tests

Existing reading, tabs, bookmarks, search, Scope View, Insights, export, localization, and keyboard behavior must continue to pass.

## 19. Localization and Accessibility

All new UI labels, dialogs, errors, history states, pane actions, and editor controls must be added to the existing nine-locale translation system.

Accessibility requirements:

- pane region labels identify primary/secondary pane and active state
- divider is keyboard-resizable
- editor controls have explicit accessible labels
- dirty state is not conveyed by color alone
- diff additions/removals include semantic text/status in addition to visual styling
- history list is fully keyboard navigable

## 20. Performance Constraints

- Re-render only the affected document session after a working-source edit.
- Avoid rebuilding unrelated tabs/panes.
- Git history loads on demand, never during normal document navigation.
- Historical file contents load lazily.
- Diff computation may run off the immediate interaction path for large inputs if profiling shows UI blocking, but no worker subsystem is required up front.
- Inline editing source mapping should be generated during the existing Markdown parse rather than by a second full HTML analysis pass.

## 21. Dependency and License Policy

The planned implementation adds **zero new production dependencies**.

If a later implementation blocker genuinely requires a third-party dependency, it must be reviewed before adoption and satisfy all of:

- open source
- commercial use permitted
- modification permitted
- redistribution permitted
- compatible with Markdown Explorer's license obligations
- no incompatible copyleft requirement
- no runtime cloud service requirement
- maintained and auditable

This exception requires a separate explicit design decision; it is not pre-approved by this spec.

## 22. Non-Goals for First Release

- WYSIWYG rich-text editing
- more than two panes
- vertical split
- browser-side Git implementation
- Git staging/commit/branch/checkout/reset/restore operations
- collaborative editing
- cloud sync
- syntax-highlighted code-editor dependency
- semantic AST-aware Git diff
- three-way merge editor
- automatic conflict overwrite

## 23. Implementation Order

The implementation plan should preserve these dependency boundaries:

1. Shared document-session and writable-host capability contracts.
2. Safe save protocol and runtime adapters.
3. Plain editing mode.
4. Inline source mapping and block editing.
5. Dirty/close/conflict UX.
6. Split-view state and two-pane layout.
7. Independent pane modes and shared document sessions.
8. Local Git capability and read-only host operations.
9. History/revision viewer.
10. Diff engine and diff viewer.
11. Git/diff modes inside split panes.
12. Localization, accessibility, protocol parity, documentation, and full regression coverage.

## 24. Acceptance Criteria

The feature set is complete when:

- A Markdown file can be edited in Plain mode and through supported inline rendered blocks.
- Saving is local-only and does not add a new editor dependency.
- External file modification cannot be silently overwritten without explicit user confirmation.
- Electron, Tauri, VS Code, Chromium, and capable Web runtimes can save Markdown through their native/local filesystem mechanisms.
- Desktop and VS Code can list a document's Git history using the installed local Git executable.
- Historical revisions can be opened read-only.
- Revision-to-revision, revision-to-current, and working-copy conflict diffs can be inspected.
- Two files can be displayed side by side.
- Each pane can independently use Rendered, Inline Edit, Plain, Git Revision, or Diff mode when that mode is supported by the runtime.
- Two panes showing the same file share one working copy and dirty state.
- Browser runtimes remain functional without Git support.
- Existing Markdown Explorer reading, navigation, bookmarks, search, Insights, exports, localization, and runtime parity tests remain green.
