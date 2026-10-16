# Files sidebar entry actions design
Date: 2026-10-15
Status: approved by human; implemented and verified

## Goal and scope
Extend the current Files sidebar with per-entry rename/delete, visible clicked-row focus, keyboard entry actions, a permanent-delete choice, and the exact supplied creation icons. Implement on the current local branch and preserve unrelated changes. No worktree or actual user-file deletion during verification. Branching and split commits were subsequently authorized for the v1.7.1 release; pushing remains outside the request.

## User requirements
1. Every mutable file/folder item menu offers Rename file/folder and Delete file/folder.
2. Left-clicking a Files item gives that row a thin inset outline indicating focus, distinct from the open-document and selection backgrounds.
3. F2 enters rename mode and Delete opens a confirmation dialog for the focused item.
4. Delete confirmation includes Permanently Delete.
5. New File and New Folder use the user's supplied SVG paths.

## Interaction design
- Track one focused entry per active workspace. Left-click and keyboard row focus update it. Workspace changes and removed entries clear it. Preserve file opening and folder expansion behavior.
- Add Rename file/Rename folder and Delete file/Delete folder to the existing item menus, showing F2 and Del hints.
- F2 replaces the focused row's name with an inline input containing its existing name. Select the base filename while leaving the extension visible; select the full folder name. Enter commits; Escape or blur cancels. An unchanged name performs no filesystem operation. Show validation or host errors inline, keep the input on failure, and prevent duplicate submission while busy.
- Handle shortcuts only within Files sidebar keyboard focus. Ignore input/contenteditable fields, dialogs, menus, modifier combinations, and in-flight mutations. Do not intercept document editing keys.
- In entry selection mode, Delete uses the current selected entries through the existing batch confirmation. F2 is available only for a single focused entry outside selection mode.
- Apply the requested thin inset focus outline without changing dimensions or the existing active/selected backgrounds.

## Deletion design
- Share the same confirmation behavior for a single item and selected entries.
- Desktop hosts default to moving items to Trash. An unchecked Permanently Delete checkbox switches the confirmation title, warning, final button and request mode to permanent deletion.
- Browser filesystem hosts already delete permanently; show Permanently Delete selected and fixed, with the existing irreversible-deletion explanation.
- Display the affected names and existing unsaved-change warning. Cancel changes nothing. Capture the target entries and workspace for the dialog so focus or workspace changes cannot redirect its action.
- Dispatch the chosen mode to the host; do not silently convert a permanent-delete request back to Trash. Preserve partial failure reporting and only close/discard sessions for entries confirmed deleted.

## Runtime and state changes
- Add a typed renameWorkspaceEntry request/result and request client alongside existing create/delete messages.
- Implement rename in Electron, VS Code, Tauri and browser filesystem adapters using existing workspace boundaries, protected-path checks, name validation and error conventions. Reject collisions; do not overwrite an existing entry. Refresh the tree on success. Handle case-only rename where supported without overwriting or losing data.
- Extend desktop delete handlers to honor trash/permanent explicitly; keep browser permanent-delete behavior explicit.
- On successful rename, migrate affected open-document paths and unsaved buffers, pinned paths, scope references and bookmark file paths, including descendants of renamed folders. Keep the currently open document attached to its renamed path. Preserve stable document identity where applicable and avoid claiming success before the host confirms it.
- Do not expose mutations in read-only revision modes or for protected workspace roots. The subsequently approved website demo supports simulated mutations in localStorage only.

## Icons
- Preserve both user-supplied SVG path geometries and viewBox 0 0 16 16.
- Use currentColor instead of fixed black to support existing themes; remove empty SVG Repo wrapper groups and mark decorative SVGs aria-hidden.
- Reuse the icons for toolbar buttons, corresponding creation menu actions, and inline creation inputs.

## Implementation boundaries
- Sidebar focus and rename state in feature-owned hooks/components; keep TreeNode and menu composition small.
- Shared deletion dialog receives an explicit chosen mode; reuse existing create-name validation and native-input checkbox styling.
- Host protocol, adapters and state migration are implemented consistently across supported executable hosts.
- Preserve existing local file-operation work and source quality limits.

## Verification
- Behavioral UI checks: clicked focus outline, menu targets, F2 inline rename, Enter/Escape/blur handling, shortcut isolation, Delete confirmation and selected-entry deletion, permanent choice and request mode.
- Host checks: file/folder rename, collision and path escape rejection, protected roots, descendant updates, case-only rename, trash vs permanent dispatch, partial failures and stale-workspace safety.
- State checks: open tabs, unsaved buffers, pins, scope and bookmarks follow successful renames and remain unchanged on failure.
- Run relevant UI, host and message-contract tests, frontend type/build checks, Cargo formatting/type checks when applicable, and diff/style checks. Use a disposable fixture workspace for browser/manual verification.
