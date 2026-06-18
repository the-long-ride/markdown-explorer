# Design Spec: Scope Focus Reconciliation and Workspace Watch Refresh

## Goal
Fix scope focus so that when the workspace file set changes, newly discovered files are automatically included in the current scope focus and stale paths are removed. Add desktop auto-detection of open workspace changes using native filesystem notifications instead of polling.

## Scope
- Desktop Electron workspace flow only.
- Scope focus reconciliation must run for both manual refresh (`F5`) and automatic workspace change detection.
- Auto-detection should watch only currently open workspaces.
- No interval polling or periodic fetch loops.

## Non-Goals
- No VS Code extension watcher work in this change.
- No background content re-indexing loop separate from real workspace change events.
- No redesign of the scope focus UI.

## User Behavior
1. A user scopes focus to selected files or folders in the current workspace.
2. An external process adds, removes, renames, or moves files in that workspace.
3. When the app refreshes manually or receives a native filesystem event:
   - stale scope-focus paths are removed
   - existing valid selections are preserved
   - newly discovered files are automatically included in scope focus
4. If a new file belongs under a folder that was already partially scoped, it is included automatically through that existing scope rule.
5. If a new file is not under any currently scoped parent, the new file itself is added to the scope-focus selection.

## Architecture

### Renderer: Scope Reconciliation
Scope reconciliation remains a renderer-side state normalization concern because `scopeFocus` already lives in persisted UI settings.

The reconciliation step should:
- compare the previous `fileList` with the new `fileList`
- derive the set of newly discovered files
- remove saved scope paths that no longer exist
- preserve valid existing selected paths
- add new files according to the parent-folder rule

This logic belongs in application state management, not in the tree rendering components.

### Main Process: Workspace Watch Refresh
The Electron main process should own filesystem watching because it already owns workspace scanning and refresh behavior.

The watch flow should:
- attach watchers only to the current open workspace
- tear them down when switching or closing workspaces
- debounce event bursts into one refresh cycle
- rescan workspace metadata using the existing scanner path
- send fresh workspace data back to the renderer through the existing host-message path

## Scope Focus Reconciliation Rules

### Existing Scope Entry
If the current workspace or tab has a saved `scopeFocus[scopeKey]` entry:
- remove paths not present in the new file list
- keep paths that still exist
- compute new files as `newFileList - previousFileList`
- for each new file:
  - if its parent folder is already represented by a scoped folder selection, include the file automatically
  - otherwise add the new file path itself to the saved scope selection

### No Scope Entry
If there is no existing `scopeFocus[scopeKey]` entry:
- do nothing
- the workspace remains unscoped

### Stale Paths
Deleted or renamed files must be removed automatically from the saved scope selection so the setting stays aligned with the actual workspace.

## Folder Coverage Rule
The current scope setting stores paths, not an explicit folder-rule model. Reconciliation therefore needs a consistent way to interpret folder coverage from the saved selection set.

Recommended interpretation:
- if a saved scoped path exactly matches a folder path or semantically represents a folder selection in the current tree, then new descendant files inherit inclusion
- if a saved path is only a file path, it does not imply sibling coverage

Implementation should follow the existing tree selection behavior so folder selections and file selections remain consistent with what the user originally chose.

## Workspace Watch Design

### Watch Lifecycle
- start watchers after opening a workspace successfully
- stop watchers before switching workspaces
- stop watchers when the workspace closes
- ignore watch setup for unsupported or unavailable workspaces

### Watch Targets
- watch the active workspace root only
- if recursive watching is reliable on the target platform, prefer it
- otherwise watch the root with graceful fallback behavior while keeping this change scoped to the current desktop platform needs

### Debounce Strategy
Filesystem events often arrive in bursts from editors, Git operations, and save flows. The watcher must debounce these bursts into one refresh.

Recommended behavior:
- on first event, start or reset a short debounce timer
- when the timer settles, run a single workspace rescan
- if another event arrives during scan, schedule one more follow-up refresh instead of rescanning repeatedly

## Refresh Integration
Both manual refresh and watch-triggered refresh should use the same workspace scanning path so reconciliation behavior is identical.

Required result:
- `F5` refresh fixes the current bug
- watcher refresh behaves the same way without introducing separate scope rules

## Performance Constraints
- no interval polling
- no watching unopened workspaces
- no repeated full-content indexing on idle
- no file-content reads purely for change detection
- debounce event storms into one scan
- reuse existing lightweight scanner behavior already optimized for titles and large-file indexing constraints

## Error Handling

### Watch Setup Failure
If `fs.watch` or equivalent setup fails:
- log the error
- keep manual refresh working
- do not break workspace browsing or scope focus

### Workspace Switch During Debounce
If the user switches workspaces while a debounced refresh is pending:
- discard the old pending refresh
- do not apply old workspace results to the new workspace

### Transient Missing Paths
If files disappear during a rescan:
- trust the final scanned file list
- reconcile scope focus against the final list only

## Files Expected To Change
- `desktop/main.js`
- optionally a new desktop watcher helper module if extracting the watch lifecycle improves clarity
- `ui/src/contexts/AppStateContext.tsx`
- `ui/src/components/Sidebar/Sidebar.tsx` only if existing selection helpers need minor extraction
- `tests/` for scope reconciliation and watcher-triggered refresh regression coverage

## Testing

### Scope Reconciliation Tests
- start with a saved scope selection
- simulate a new file list with added files
- assert new files are included
- simulate deleted or renamed files
- assert stale paths are removed

### Parent Rule Tests
- new file under an already scoped parent is automatically included
- new file outside existing scoped parents is added as its own scoped file path

### Watch Refresh Tests
- native change events trigger a debounced refresh
- switching workspace disposes previous watchers
- watch failure degrades gracefully without crashing

## Constraints
- follow the existing desktop host-message refresh pattern
- keep scope semantics stable for existing users
- avoid unrelated refactoring outside watch lifecycle and scope reconciliation support
