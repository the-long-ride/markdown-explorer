# Sidebar File Operations (v1.7.1) — Design

Current v1.7.1 scope also includes the approved [entry-actions follow-up](sidebar-entry-actions-design.md): rename/F2/Delete, explicit permanent deletion, state migration, shared creation icons, and localStorage-only demo mutations. This original create/delete plan is retained as implementation history; its rename exclusion and hidden-demo capability are superseded.

Status: implemented in v1.7.1. Implementation plan: `docs/sidebar-file-ops-plan.md`.

## Goal

Let users create files and folders and delete workspace entries from the Files tab, VS Code style, on every runtime (Electron, VS Code, Tauri, Chromium extension, website app).

## Scope

In scope:

- New File / New Folder buttons in the Files tab action bar.
- New File… / New Folder… items in the folder context menu.
- Selection mode in the Files tab with Expand all, Collapse all, Unpin selected, Delete selected, and Exit.
- Host operations for create and delete on all runtimes.
- Truly empty folders (zero entries on disk) visible in the Files tree.
- Version bump to 1.7.1.

Original scope exclusion: move, drag and drop, copy/paste, undo of delete inside the app. Rename was added by the approved entry-actions follow-up.

## UX

### Files tab action bar (normal mode)

- Left group: `New File` (file-plus icon), `New Folder` (folder-plus icon), `Entry selection mode` (checkbox icon). Sort status is beside the sort control.
- Right group unchanged: sort, clear pins, locate, collapse, expand.
- Create buttons and menu items are hidden when the runtime capability reports create unsupported. Delete is hidden when it reports no delete mode.

### Create flow

- An inline input row appears inside the tree, VS Code style.
- Target folder resolution, first match wins:
  1. The last focused folder row in the Files tree.
  2. The parent folder of the last focused file row.
  3. Workspace root.
  Clicking empty tree space clears the focus memory, so the next create targets the root.
- The target folder expands before the input appears.
- New File input is prefilled with `.md` and the caret placed before the dot. When the committed name contains no `.` at all, `.md` is appended.
- New Folder input starts empty.
- The committed name is trimmed of surrounding whitespace before validation.
- Enter commits. Escape cancels. Blur commits when the name is valid and non-empty, otherwise cancels (VS Code behaviour).
- Inline validation, shown under the input, blocks commit:
  - empty name;
  - an entry with the same name already exists in the target folder (case-insensitive unless the host platform is Linux);
  - name is `.` or `..`, has a trailing dot or space, contains a control character or any of `<>:"/\|?*`, or is a reserved Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, with or without extension);
  - name is `.git` (any case, ignoring trailing dots/spaces) or the target lies inside a `.git` segment.
- When the extension is not one the tree lists, creation still proceeds and the input shows the hint "This file type won't appear in the Files tree".
- On success:
  - file: created empty, opened once it appears in the file list; Markdown files open in `inline-edit` mode;
  - folder: shown and expanded.
- On host failure: the input stays open with the failure message mapped from `reason`.

### Folder context menu

- Adds `New File…` and `New Folder…` targeting that folder, same flow.

### Selection mode

- Toggled by the `Select` button. Escape or the `X` button exits and clears the selection.
- Every tree row shows a checkbox. Row click toggles selection instead of opening. Folder rows still expand via the chevron.
- Scope-focus editing and selection mode are mutually exclusive; entering one exits the other.
- Action bar is replaced by: `Expand all`, `Collapse all`, `Unpin selected (n)`, `Delete selected (n)`, `X`.
- Selection resets when the workspace changes and when the mode exits.
- `Unpin selected` is enabled only when at least one selected entry is pinned. It opens a confirm dialog; confirm removes those pins.
- `Delete selected` opens a destructive confirm dialog:
  - title states the count;
  - body lists up to 5 names then "and n more";
  - trash runtimes say "Move to Trash"; permanent runtimes say "Permanently delete — this cannot be undone";
  - when any selected file (or file under a selected folder) has unsaved edits, the body warns "n files have unsaved changes that will be lost".
- Selecting a folder implies its subtree. Selected descendants of a selected folder are pruned before the request.
- After delete:
  - tabs for deleted paths (or paths under deleted folders) have their changes discarded and close;
  - pins for deleted paths are removed;
  - the tree refreshes;
  - partial failures show an error notice listing failed names; succeeded entries are still cleaned up.

## Protocol

New webview → host messages, following the `saveDocument` request/result pattern.

```ts
interface CreateWorkspaceEntryMessage {
  readonly command: 'createWorkspaceEntry';
  readonly requestId: string;
  readonly parentPath: string; // workspace-relative, '/'-separated, '' for root
  readonly name: string;
  readonly kind: 'file' | 'folder';
}
interface DeleteWorkspaceEntriesMessage {
  readonly command: 'deleteWorkspaceEntries';
  readonly requestId: string;
  readonly paths: readonly string[]; // workspace-relative, '/'-separated
}
```

Host → webview results:

```ts
type WorkspaceEntryFailureReason =
  | 'exists' | 'invalid-name' | 'outside-workspace' | 'protected'
  | 'missing' | 'permission-denied' | 'unsupported' | 'failed';

interface CreateWorkspaceEntryResultMessage {
  readonly command: 'createWorkspaceEntryResult';
  readonly requestId: string;
  readonly ok: boolean;
  readonly path?: string;          // workspace-relative, '/'-separated, on success
  readonly kind?: 'file' | 'folder';
  readonly reason?: WorkspaceEntryFailureReason;
  readonly error?: string;
}
interface DeleteWorkspaceEntriesResultMessage {
  readonly command: 'deleteWorkspaceEntriesResult';
  readonly requestId: string;
  readonly mode: 'trash' | 'permanent';
  readonly deleted: readonly string[];
  readonly failed: readonly { readonly path: string; readonly reason: WorkspaceEntryFailureReason }[];
}
```

Every host refreshes the workspace tree (sending `workspaceFilesChanged` or `readyAck`) **before** it sends a successful result, so the UI sees the new tree first.

### Capability

The UI derives the capability from `appRuntime`, like `supportsShellLocation`, so no new host field is needed:

```ts
interface WorkspaceEntryCapability {
  readonly create: boolean;
  readonly deleteMode: 'trash' | 'permanent' | null;
}
```

- `desktop`, `tauri`, `vscode` → `{ create: true, deleteMode: 'trash' }`.
- `chrome` (Chromium extension and website app) → `{ create: true, deleteMode: 'permanent' }`.
- No open workspace → `{ create: false, deleteMode: null }`.

Single-file workspaces still show the controls; their hosts answer `unsupported`, which the UI reports inline.

## Host rules (all runtimes)

- Name validation follows one rule set (see Create flow; hosts do not trim). Each language carries its own copy; a shared fixture table (`tests/fixtures/workspace-entry-names.json`) drives tests for every copy. Rule violations map to `invalid-name`, `.git` names to `protected`.
- Resolve `parentPath` + `name` against the workspace base, then check containment both lexically and after `realpath` of the existing parent. A symlinked parent that escapes the workspace yields `outside-workspace`.
- Any `.git` segment (trailing dots/spaces stripped, case-insensitive) yields `protected`, for create and delete.
- Deleting the workspace root (`''`) yields `protected`.
- Create is exclusive: files open with `wx` / `create_new`, folders use non-recursive `mkdir`. An existing entry yields `exists`; never overwrite.
- Delete does not follow the entry itself: a symlink entry is removed as a link. Each path is processed independently and reported per path.
- A workspace whose path is a file (single-file mode) yields `unsupported`.

## Runtime implementations

| Runtime | Module | Create | Delete |
|---|---|---|---|
| Electron | `electron/workspace/workspace-entries.js`, wired in `electron/core/main-bootstrap.js` + `ipc-handlers.js` | `fs.promises.open(..., 'wx')`, `mkdir` | `shell.trashItem` (trash) |
| VS Code | `vscode/src/core/panelWorkspaceEntries.ts`, wired in `panel.ts` | node `fs` with `wx` / `mkdir` | `workspace.fs.delete(uri, { recursive: true, useTrash: true })` (trash) |
| Tauri | `tauri/src/dispatcher/workspace_entries.rs`, wired in `commands.rs` | `OpenOptions::create_new`, `fs::create_dir` | `trash` crate, plain crates.io dependency (trash) |
| Chromium extension + website app | `chromium-xtension/src/workspace-entries.ts`, used by `chrome-host-search.ts` and `website-app/src/web-file-utility-router.ts` | `getFileHandle(name, { create: true })` after existence probe, `getDirectoryHandle(name, { create: true })` after probe | `removeEntry(name, { recursive: true })` (permanent) |

Chromium/website: request `readwrite` permission on the directory handle at first operation; denial yields `permission-denied`. Browser handles cannot resolve symlinks, so containment relies on handle traversal.

## Empty folders in the tree

- Each scanner records directories that have zero entries on disk (the workspace root excluded; ignored folder names are never descended into, as today) and passes them to its tree builder.
- Tree builders take an optional list of '/'-joined relative empty-directory paths and create folder nodes for them.
- Incremental scanners publish their final tree when it contains an empty folder even if the file count did not change since the last batch, because batch snapshots are built from files only.
- Hosts: Electron `DesktopScanner`, VS Code `WorkspaceScanner` (adds a directory walk, since it uses `findFiles`), Chromium/website `BrowserScanner`, Tauri `scanner.rs` + `tree_builder.rs`.

## UI modules

- `ui/src/workspace/workspaceEntryName.ts`: name validation and `.md` defaulting.
- `ui/src/workspace/workspaceEntryCapability.ts`: capability from `appRuntime`.
- `ui/src/workspace/workspaceEntriesClient.ts`: request/response with timeout, modelled on `ui/src/editor/saveDocument.ts`.
- `ui/src/workspace/workspaceEntryPaths.ts`: path helpers (relative path of a file, descendant pruning, sibling names).
- `ui/src/components/Sidebar/useSidebarEntryCreation.ts`: inline input state, target resolution, commit/cancel, open-after-create.
- `ui/src/components/Sidebar/SidebarInlineEntryInput.tsx`: input row rendered by the tree.
- `ui/src/components/Sidebar/useSidebarSelectionMode.ts`: selected set, descendant pruning, reset on workspace change.
- `ui/src/components/Sidebar/useSidebarEntryDeletion.ts`: delete request and cleanup of tabs/pins.
- `ui/src/components/Sidebar/SidebarSelectionActions.tsx`: action bar in selection mode, with its dialogs.
- `ui/src/components/Sidebar/SidebarConfirmDialog.tsx`: generalised from `SidebarClearPinsDialog` with `variant: 'default' | 'destructive'`, optional confirm label and list body. Clear pins migrates to it.
- `ui/src/components/Sidebar/sidebarTreeContext.ts`: React context that carries creation and selection state to `TreeNode` without growing its prop list.
- `sidebarItemMenuItems.tsx`: New File… / New Folder… for folder targets.
- Translations for every locale (`en`, `vi`, `fr`, `es`, `zh`, `no`, `ja`, `ko`, `ru`).

All new and touched files stay within the `source-loc` contract limits (`.ts`/`.tsx` 400, `.js`/`.rs` 350, `.css` 500).

## Versioning

Bump the root `package.json` to `1.7.1` and run `scripts/sync-versions.mjs`, which synchronises the runtime manifests and site metadata. Add changelog entries to `CHANGELOG.md` and `vscode/CHANGELOG.md`.

## Testing

- Host helpers (per runtime) against a temp directory: create file/folder, `exists` on race, traversal, `.git`, symlink escape, root delete refused, trash/permanent, partial delete failure, single-file workspace.
- Shared name fixture table run against UI, Electron, VS Code, Rust, and browser copies.
- Scanners: empty folders appear, folders with only unsupported files do not, ignored folders do not.
- UI: inline input default and caret, target resolution, validation messages, unsupported-extension hint, selection toggling and pruning, unpin and delete dialogs (including unsaved warning), tab/pin cleanup, capability hiding.
- Update message catalogs, coverage manifest, and contract tests.

## Risks

- Empty-folder support touches scanners and incremental publishers in every host.
- The `trash` crate adds transitive dependencies to the Tauri build.
- Chromium/website delete is permanent; the dialog copy must make that explicit.
- Several touched files sit near their LOC budget (`main-runtime.js` 350/350, `chrome-host.ts` ~400/400, `TreeNode.tsx` ~386/400); the plan routes new code into new modules.
