---
timestamp: '2026-10-07T00:00:00+07:00'
name: Create and Delete Workspace Entries
topic: Use case UC-032
document_type: use-case
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../03-features/03-sidebar-tree-and-scope.md
- ../../sidebar-file-ops-design.md
source_scope:
- ui/src/workspace/workspaceEntryName.ts
- ui/src/workspace/workspaceEntryCapability.ts
- ui/src/workspace/workspaceEntriesClient.ts
- ui/src/workspace/workspaceEntryPaths.ts
- ui/src/workspace/workspaceEntryMessages.ts
- ui/src/components/Sidebar/useSidebarFileOps.tsx
- ui/src/components/Sidebar/useSidebarEntryCreation.ts
- ui/src/components/Sidebar/useSidebarEntryDeletion.ts
- ui/src/components/Sidebar/useSidebarSelectionMode.ts
- ui/src/components/Sidebar/SidebarInlineEntryInput.tsx
- ui/src/components/Sidebar/SidebarSelectionActions.tsx
- ui/src/components/Sidebar/SidebarConfirmDialog.tsx
- electron/workspace/workspace-entries.js
- vscode/src/core/panelWorkspaceEntries.ts
- tauri/src/dispatcher/workspace_entries.rs
- chromium-xtension/src/workspace-entries.ts
test_scope:
- tests/unit/ui/workspace
- tests/unit/ui/components/sidebar-file-ops.test.tsx
- tests/unit/ui/components/sidebar-entry-creation.test.tsx
- tests/unit/ui/components/sidebar-entry-deletion.test.tsx
- tests/unit/ui/components/sidebar-selection-mode.test.tsx
- tests/unit/ui/components/sidebar-selection-actions.test.tsx
- tests/unit/ui/components/sidebar-inline-entry-input.test.tsx
- tests/unit/ui/components/sidebar-confirm-dialog.test.tsx
- tests/unit/electron/workspace-entries.test.ts
- tests/unit/vscode/panel-workspace-entries.test.ts
- tests/unit/chromium/workspace-entries.test.ts
- tests/unit/chromium/web-file-workspace-entries.test.ts
runtime_scope:
- all
keywords:
- UC-032
- create file
- create folder
- delete
- selection mode
- empty folders
---

# Create and Delete Workspace Entries

## Purpose

Let users create files and folders, and select, unpin, and delete workspace entries, from the Files tab on every runtime, and see truly empty folders in the tree.

| Property | Specification |
|---|---|
| Use-case ID | `UC-032` |
| Trigger | Click **New File** or **New Folder** in the Files action bar, choose **New File…** / **New Folder…** from a folder context menu, or click **Select** to enter selection mode. |
| Preconditions | An open folder workspace on a runtime whose capability allows the operation (see Runtime differences). |
| Success result | The entry exists on disk, the tree refreshes before the host reports success, and a created file opens (Markdown in inline edit). A delete removes the entries, closes their tabs, and removes their pins. |
| Safe failure | Nothing is overwritten. A rejected name sends nothing; a host failure keeps the input open with the reason; a partial delete reports the failed names while succeeded entries are still cleaned up. |
| Scope exclusion | Move between folders, drag and drop, copy/paste, and undo of delete inside the app. Rename is covered by the approved entry-actions follow-up. |

## Main flow

1. The user clicks the folder `docs` in the Files tree (it becomes the focused folder).
2. The user clicks **New File**. `docs` expands and an inline input appears inside it, prefilled with `.md` and the caret before the dot.
3. The user types `todo` and presses Enter. The UI trims the name and appends `.md` because it contains no dot.
4. The UI sends `createWorkspaceEntry` (`parentPath: 'docs'`, `name: 'todo.md'`, `kind: 'file'`); the host creates the file exclusively, refreshes the tree, and answers `createWorkspaceEntryResult` with `path: 'docs/todo.md'`.
5. The input closes, `docs/todo.md` opens once it appears in the file list, and because it is Markdown it opens in inline edit.

## Alternate flows

| Flow | Behavior |
|---|---|
| New Folder | **New Folder** opens an empty input; on success the folder is revealed, expanded, and becomes the focused folder. |
| Folder context menu | **New File…** / **New Folder…** target that folder regardless of focus. |
| No folder focused | The target is the parent of the focused file, otherwise the workspace root; clicking empty tree space clears the focus. |
| Name already exists | The input shows `entryErrorExists` and nothing is sent (case-insensitive unless the host platform is Linux). |
| Invalid, reserved, or `.git` name | The input shows `entryErrorInvalid`, `entryErrorReserved`, or `entryErrorProtected`; nothing is sent. |
| Host failure | The input stays open with the message mapped from the failure reason (see the Error and Reason Catalog). |
| Unlisted extension | Typing an extension the tree does not list (anything other than Markdown or an extension already in the tree) shows the hint `entryUnlistedType`; creation still proceeds and the file is not opened. |
| Empty name | Escape, or blur with an empty name or the untouched `.md` prefill, cancels. Enter on the untouched `.md` prefill shows the name-required error. |
| Collapse | Collapsing a folder that hosts the open input (or Collapse All) cancels the draft. |
| Unpin selected | Select pinned entries, click **Unpin selected (n)**, confirm; only those pins are removed. |
| Single-file workspace | The controls show; the host answers `unsupported` and the input shows the message. |

## Selection and deletion flow

1. The user clicks **Entry selection mode**. Checkboxes appear on every row, row click selects instead of opening, and the toolbar shows Expand all, Collapse all, Unpin selected (n), Delete selected (n), the count, and **X**.
2. The user selects files and folders. Selecting a folder implies its subtree; selected descendants of a selected folder are pruned before the request.
3. The user clicks **Delete selected (n)**. A destructive confirm dialog lists the first 5 names and "and n more", warns about unsaved changes when any affected file has them, and says **Move to Trash** (Electron, Tauri, VS Code) or that the delete is permanent and cannot be undone (Chromium, website file mode). Escape closes only the dialog.
4. On confirm the UI sends `deleteWorkspaceEntries`; the host removes each path independently, refreshes the tree, and answers `deleteWorkspaceEntriesResult`.
5. For every removed path the tab's changes are discarded and the tab closes, and pins for removed files and folders are removed. A partial failure shows an error notice listing the failed names. Selection mode exits.

Escape or **X** exits selection mode without changes. Entering scope-focus editing exits selection mode, and entering selection mode leaves scope-focus editing.

## Failure flows

| Condition | Required behavior |
|---|---|
| `exists` | Inline error; the existing entry is untouched. |
| `invalid-name`, `protected` | Inline error; nothing is created. |
| `outside-workspace` | Inline error; nothing outside the workspace is touched, including through a symlinked parent. |
| `missing` | Inline error when the parent vanished; a delete reports the path as failed. |
| `permission-denied` | Inline error; Chromium and website file mode ask for `readwrite` permission on the first operation. |
| `unsupported` | Inline error for a single-file workspace. |
| `failed` | Inline error, including a 15-second UI timeout; a delete timeout reports every path as failed. |
| Workspace changes during a request | The late reply is ignored; no draft is resurrected and nothing opens. |

## Runtime differences

| Runtime | Create | Delete |
|---|---|---|
| Electron | Yes | OS Trash (`shell.trashItem`) |
| Tauri | Yes | OS Trash (`trash` crate) |
| VS Code | Yes | OS Trash (`workspace.fs.delete` with `useTrash`) |
| Chromium extension | Yes | Permanent (`removeEntry`), with a warning |
| Website | Real folders in `?mode=file`; simulated entries in demo mode | Permanent, with a warning; demo mode manages simulated entries in localStorage only |

## Rename and simulated demo follow-up

Files and folders expose Rename and Delete menu actions, with F2 and Delete shortcuts scoped to the Files tree. The inline rename field validates names, commits on Enter and cancels on Escape/blur; successful renames migrate tabs, unsaved buffers, bookmarks, pins, scopes and split panes. Native deletion defaults to Trash and offers Permanently Delete.

The default website demo implements all entry actions on fake localStorage entries only; it does not request directory permissions. Reload preserves nested/empty folders, renamed bundled content and deletions. Newly created demo files are empty previews; native/browser file mode retains its document-write capability checks.

## Acceptance criteria

- [x] New File and New Folder create into the focused folder, the parent of the focused file, or the root, and never overwrite.
- [x] File names get `.md` when they contain no dot; the caret starts before the dot.
- [x] Existing, invalid, reserved, and `.git` names are rejected inline before any request.
- [x] A created Markdown file opens in inline edit; a created folder is expanded.
- [x] Selection mode, Unpin selected, and Delete selected prune descendants, warn about unsaved changes, close tabs, and remove pins.
- [x] Trash runtimes say Move to Trash; Chromium and website say the delete is permanent.
- [x] Truly empty folders appear in the Files tree; ignored folders never do.
- [x] All new strings exist in the nine locales.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Feature | `docs/instructions/03-features/03-sidebar-tree-and-scope.md` | Creating files and folders, Selection mode, Unpin and delete selected, Empty folders |
| Design | `docs/sidebar-file-ops-design.md` | Approved design and protocol |
| UI | `ui/src/workspace/*`, `ui/src/components/Sidebar/useSidebarFileOps.tsx` and its hooks/components | Name rules, client, capability, and Sidebar wiring |
| Hosts | `electron/workspace/workspace-entries.js`, `vscode/src/core/panelWorkspaceEntries.ts`, `tauri/src/dispatcher/workspace_entries.rs`, `chromium-xtension/src/workspace-entries.ts` | Per-runtime create/delete |
| Verification | `tests/unit/ui/workspace`, `tests/unit/ui/components/sidebar-*.test.tsx`, `tests/unit/{electron,vscode,chromium}/*workspace-entries*.test.ts` | Feature and host regression contracts |

---

[← Save and Navigate Source-Anchored Bookmarks](UC-031-manage-bookmarks.md) · [Documentation index](../README.md) · [Workspace Selection and Application Shell →](../03-features/01-workspace-selection-shell.md)
