# Local Git History and Diff

Markdown Explorer can inspect a document or workspace's local Git history without turning the application into a repository-management client.

## Runtime support

| Runtime | Git history | Revision snapshots | Revision diff |
| --- | --- | --- | --- |
| Electron | Yes | Yes | Yes |
| Tauri | Yes | Yes | Yes |
| VS Code | Yes | Yes | Yes |
| Chromium extension | No | No | No |
| Web app | No | No | No |

Electron, Tauri, and VS Code use the installed local `git` executable. Chromium and Web return an explicit `unsupported-runtime` capability response; they never try to start a process.

## Read-only guarantee

The Git feature exposes only read operations:

- detect repository capability;
- list document and repository history;
- list files contained by a historical revision;
- read an exact historical snapshot;
- read sources for revision-to-revision comparison.

It does not stage, commit, checkout, restore, reset, stash, branch, switch, merge, rebase, or otherwise mutate repository state.

Host implementations execute Git with structured argument arrays and a controlled working directory. No shell command string is constructed from paths or revision identifiers. Full object IDs are validated before a historical snapshot is read, and revision file access remains contained by the active workspace when the workspace is a repository subfolder.

## Repository History sidebar

The capability-aware **History** sidebar is enabled by default but appears only when local Git is supported for the active workspace. Opening it lazily loads a bounded repository history.

The commit graph uses one continuous graph layer for the whole list. Vertical lanes and merge curves therefore remain connected between rows instead of restarting inside each commit row. Commit rows show subject, short SHA, author, refs, merge-parent relationships, and the exact `HEAD` marker.

Clicking a commit opens a compact commit menu rather than immediately changing workspace state. The menu provides:

- **Commit SHA** — displays the short SHA and copies the full object ID when selected.
- **Author** — copies the displayed author.
- **View workspace at this commit** — enters whole-workspace historical mode.
- **Return to current HEAD** — available while a historical workspace revision is active.

### Whole-workspace historical mode

Choosing **View workspace at this commit** switches the workspace view source to that Git revision without changing the repository working tree. In this mode:

- the Files tree is projected from `listRevisionFiles(oid)`;
- opening a file reads it with `readRevisionFile(oid, path)`;
- workspace search searches historical text/Markdown sources instead of posting a live-filesystem search request;
- historical content is rendered in a read-only overlay while live tabs, split panes, dirty document sessions, and scroll state stay mounted underneath;
- editing, save, and external-editor actions are unavailable;
- the History tab icon shows an accent-colored state dot while the selected revision differs from current HEAD.

The selected historical revision is persisted **per workspace**, preferring the workspace path as its key. Reopening that workspace restores the same revision when the object still exists. If the saved object was rebased away, pruned, or otherwise cannot be found in the bounded repository history, Markdown Explorer clears the stale selection and falls back to live HEAD.

**Return to current HEAD** only changes the application view source back to the live workspace and clears that workspace's persisted historical selection. It never executes `git checkout`, reconstructs the live editor state, or discards an unsaved working copy.

## Document history

Open **More Actions → History**, then choose **Load history**. History is loaded lazily so normal document navigation does not start Git or scan commit history.

Each row shows the commit subject, author, time, short object ID, and the path used by that revision. Rename history is followed backwards so snapshots continue to resolve before a file rename.

Available actions include:

- **View revision** — opens the selected snapshot read-only.
- **Compare with current** — compares the snapshot with the last persisted source.
- **Working copy** — compares with the current unsaved source.
- **Compare selected** — compares two selected revisions.

Historical content is stored in History view state, not in editable document sessions. Viewing a revision therefore cannot dirty or save the current document.

## Diff modes

### Source Diff

Source Diff uses a dependency-free Myers shortest-edit-script implementation over normalized Markdown lines. It shows line numbers and explicit **Added**, **Removed**, and **Unchanged** labels.

The algorithm does not attempt move detection or semantic Markdown rewriting.

### Rendered Diff

Rendered Diff renders each complete Markdown source independently with the existing Markdown renderer. Changed source ranges are mapped back to source-backed rendered blocks and highlighted. Complete-document rendering preserves Markdown structure, tables, math, Mermaid, and other renderer behavior instead of rendering invalid partial hunks.

## Conflict comparison

The editor's external-change conflict dialog can open the same Diff UI using the disk source and the unsaved working source. This comparison is completely local and does not require a Git repository.

## Split view

A split pane can independently display **Rendered**, **Inline Edit**, **Plain**, **Revision**, or **Diff** modes. Revision and Diff modes are read-only. Returning to Rendered mode discards only the temporary History view state; the shared editable document session remains unchanged.

Whole-workspace historical mode sits above the live split shell and makes the historical workspace read-only; returning to HEAD reveals the already-mounted split state.

## Bridge protocol

UI requests:

- `getGitCapability { requestId }`
- `listDocumentHistory { requestId, filePath, limit? }`
- `readGitRevision { requestId, oid, path }`
- `compareGitRevisions { requestId, left, right }`
- `listRepositoryHistory { requestId, limit? }`
- `listRevisionFiles { requestId, oid }`
- `readRevisionFile { requestId, oid, path }`

Host responses:

- `gitCapabilityResult { requestId, capability }`
- `documentHistoryResult { requestId, revisions, error? }`
- `gitRevisionResult { requestId, snapshot, error? }`
- `gitComparisonResult { requestId, comparison, error? }`
- `repositoryHistoryResult { requestId, commits, error? }`
- `revisionFilesResult { requestId, oid, files, error? }`
- `revisionFileResult { requestId, snapshot, error? }`

Request IDs are correlated in the shared History client so concurrent responses cannot resolve the wrong request. UI request generations and revision-search abort signals also prevent stale historical reads from replacing a newer workspace/revision view.
