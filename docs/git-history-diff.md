# Local Git History and Diff

Markdown Explorer can inspect a document's local Git history without turning the application into a repository-management client.

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
- list document history with rename tracking;
- read an exact historical snapshot;
- read sources for revision-to-revision comparison.

It does not stage, commit, checkout, restore, reset, stash, branch, merge, rebase, or otherwise mutate repository state.

Host implementations execute Git with structured argument arrays and a controlled working directory. No shell command string is constructed from paths or revision identifiers. Full object IDs are validated before a historical snapshot is read.

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

## Bridge protocol

UI requests:

- `getGitCapability { requestId }`
- `listDocumentHistory { requestId, filePath, limit? }`
- `readGitRevision { requestId, oid, path }`
- `compareGitRevisions { requestId, left, right }`

Host responses:

- `gitCapabilityResult { requestId, capability }`
- `documentHistoryResult { requestId, revisions, error? }`
- `gitRevisionResult { requestId, snapshot, error? }`
- `gitComparisonResult { requestId, comparison, error? }`

Request IDs are correlated in the shared History client so concurrent responses cannot resolve the wrong request.
