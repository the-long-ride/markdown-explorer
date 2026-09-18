---
timestamp: '2026-09-17T00:00:00+07:00'
name: Runtime Parity and Capability Matrix
topic: Common contracts, supported capabilities, and intentional runtime differences
document_type: runtime
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../../git-history-diff.md
- ../../superpowers/specs/2026-09-17-pr48-as-built-sync.md
source_scope:
- ui/src/types/webviewMessages.ts
- ui/src/types/hostMessages.ts
- ui/src/history/contracts.ts
- ui/src/history/repositoryView.ts
- ui/src/history/revisionWorkspace.ts
- ui/src/split-view
- electron/core/runtime-command-handlers.js
- electron/git/document-history.js
- tauri/src/dispatcher/commands.rs
- tauri/src/dispatcher/git_history.rs
- tauri/src/dispatcher/git_repository.rs
- vscode/src/core/panel.ts
- vscode/src/core/panelGitHistory.ts
- chromium-xtension/src/chrome-host.ts
- chromium-xtension/src/browser-git-history-host.ts
- website-app/src/web-test-message-router.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-dispatcher-parity.test.ts
- tests/contracts/tauri-host-message-parity.test.ts
- tests/node/repository-history-pagination-contract.test.mjs
- tests/unit/electron/document-history.test.ts
- tests/unit/vscode/panel-git-history.test.ts
- tests/unit/chromium/browser-git-history-host.test.ts
- tests/unit/ui/history/repository-view.test.ts
- tests/unit/ui/history/revision-workspace.test.ts
- tests/unit/ui/history/revision-search.test.ts
- tests/unit/ui/split-view
runtime_scope:
- runtime
keywords:
- runtime
- host
- parity
- git
- history
- diff
- repository snapshots
- split view
- pagination
---

# Runtime Parity and Capability Matrix

## Capability matrix

| Capability | Electron | Tauri | VS Code | Chromium | Website |
|---|:---:|:---:|:---:|:---:|:---:|
| Folder/file workspace | Yes | Yes | Yes | Yes, handles | Yes, browser/virtual |
| Native watcher | Yes | Yes | Yes | Poll | Browser-dependent |
| Workspace search | Yes | Yes | Yes | Yes | Yes |
| Cross-workspace desktop search | Yes | Parity path | Limited by shell | No desktop tabs | No desktop tabs |
| Persistent bookmarks | Focus + Tabs grouping | Focus + Tabs grouping | Focus view | Focus view | Focus view |
| Document conversion | Yes | Yes, native | Yes | No | No native conversion |
| Native shell/editor | Yes | Yes | Editor/OS | No | No |
| Standalone HTML preview | Yes | Yes | Yes | In-page | In-page |
| Tray/native window | Yes | Yes window | No | No | No |
| Typography: system + imported fonts | Yes | Yes | Yes, extension global storage | Yes, IndexedDB fonts | Yes, IndexedDB fonts |
| Markdown Explorer zoom controls | Yes | Yes | No, host-native | No, browser-native | No, browser-native |
| Export Center (HTML/PDF/Site) | Yes, native save | Yes, native save | Yes, VS Code save | Yes, browser download | Yes, browser download |
| Workspace Insights | Yes | Yes | No, Desktop-only | Yes | No, website demo |
| Scope View document modal | Yes | Yes | Yes | Yes | Yes |
| Hardware mouse history navigation (3/4) | Yes | Yes | Yes | Yes | Yes |
| Local Markdown save with revision conflict protection | Yes | Yes | Yes | Yes, writable file handle | Browser/virtual capability dependent |
| CodeMirror Markdown source editor + formatting toolbar | Yes | Yes | Yes | Writable-handle capability | Browser/virtual capability dependent |
| Two-pane split view with pane-owned tabs | Yes | Yes | Yes | Yes | Yes |
| File context/drag opening into split pane | Yes | Yes | Yes | Shared UI where workspace rows exist | Shared UI where workspace rows exist |
| Local Git document history | Yes, installed Git | Yes, installed Git | Yes, installed Git | No, explicit unsupported | No, explicit unsupported |
| Paged/searchable repository history | Yes, installed Git | Yes, installed Git | Yes, installed Git | No, explicit unsupported | No, explicit unsupported |
| Persistent read-only revision workspace | Yes, installed Git | Yes, installed Git | Yes, installed Git | No, explicit unsupported | No, explicit unsupported |
| Local Source/Rendered Diff | Yes | Yes | Yes | Yes for non-Git/local source comparisons | Yes for non-Git/local source comparisons |
| Native Focus drag surface | Yes | Yes, disabled while fullscreen | N/A | N/A | N/A |
| Installer updater | Installed packaged support | Signed plugin artifacts; download/defer/restart parity | Check/report only; VS Code installs | Store | Deployment |

## Git history parity contract

Electron, Tauri, and VS Code use the user's installed local `git` executable for document and repository history. Git execution is read-only, restricted to the active workspace/repository, and always uses structured argument arrays rather than shell command strings. Full object IDs and repository-contained paths are validated before snapshots are read.

Repository History uses three correlated request families on capable hosts:

- `listRepositoryHistory(limit?, offset?)` returns one page of commit metadata including all parent OIDs, refs/decorations, and exact current `HEAD` state.
- `listRevisionFiles(oid)` runs a read-only revision tree lookup and returns only files contained by the active workspace, even when the workspace is a repository subfolder.
- `readRevisionFile(oid, path)` reads one validated workspace-relative historical file without checkout, branch switching, index mutation, or working-tree mutation.

The current renderer starts at a 50-commit page and requests older pages by increasing `offset`. Electron and VS Code use Git `--skip=<offset>` plus `-n <limit>`; Tauri exposes the same semantics through its Rust Git adapter. Pages are appended in order and de-duplicated by full OID. A short page marks history exhausted.

The History panel filters by full/short SHA, author, or subject. While a query has no loaded match and older history remains, it progressively requests more pages. Persisted historical revisions are therefore not declared stale only because they are absent from the first page.

The corresponding result messages remain `repositoryHistoryResult`, `revisionFilesResult`, and `revisionFileResult`; they preserve the initiating `requestId` across Electron, Tauri, VS Code, and browser-host unsupported responses. Pagination does not add a new host-message discriminant.

The shared renderer turns a selected non-HEAD commit into an explicit read-only `RepositoryView`. The historical Files tree is projected from revision paths and filtered to the same document eligibility model as live Files: Markdown/MDX and TXT, plus convertible document formats only when conversion is enabled. Arbitrary source files such as `.ts` are not shown merely because Git contains them. Historical file opens use `readRevisionFile`, and workspace search reads revision text sources rather than issuing a live workspace-search command.

Selection is persisted per workspace and restored only when the object remains valid. Returning to HEAD clears UI/persistence state only and never invokes a Git checkout. The History tab shows an accent state dot only while a whole-workspace non-HEAD revision is active.

Chromium and Website hosts never attempt process execution. `getGitCapability` returns `{ supported: false, reason: 'unsupported-runtime' }`; document-history, repository-history, snapshot, file-list, and comparison requests fail safely without affecting ordinary reading, editing, split view, or local conflict comparison.

## Editing parity contract

Markdown Explorer's internal Markdown source editor is CodeMirror 6, loaded locally from packaged dependencies. It provides source highlighting, line numbers, editor history/keymaps, and a formatting toolbar for bold, italic, H1-H6, quote, inline/fenced code, links, bulleted/numbered/task lists, tables, undo/redo, and Preview.

The application document session remains the sole owner of working source, dirty state, save revision tokens, conflicts, and split-view synchronization.

On a live workspace, **More Actions → Edit** stays available on capable native/editor runtimes even when `markdownEditingEnabled` is false. When the feature is enabled it enters Markdown Explorer's internal editor; when disabled it uses the existing external/native editor route. Whole-workspace historical mode disables both routes and Save.

## Split-view parity contract

- Each pane owns `tabs`, `activeTabPath`, current `filePath`, view mode, and persisted scroll value.
- Navigation targets the active pane. With file tabs enabled it upserts/activates that pane's tab; with tabs disabled it replaces only that pane's document.
- Closing split view promotes the focused pane to the remaining primary pane and preserves that pane's tab strip.
- File rows can use **Open in Split View** and the shared `application/x-markdown-explorer-file` drag payload. A split drop targets and activates only the pane under the pointer.
- Ordinary scroll position stays local while scrolling and is persisted at document/pane lifecycle boundaries, preventing global state dispatch on every scroll event.
- Historical Revision and Diff modes remain read-only in every runtime.

## Focus-mode parity contract

Electron and Tauri retain a thin application-owned draggable surface when Focus mode hides normal chrome. Interactive Focus controls remain `no-drag`. Tauri's fullscreen guard remains authoritative and must prevent the Focus surface from making a fullscreen window draggable.

## Common protocol requirement

All adapters must honor the active `WebviewMessage` and `HostMessage` discriminants they support. Unsupported capabilities are hidden or produce safe recovery; adapters must not silently reinterpret commands.

## Parity review checklist

- New UI→host command is added to every capable dispatcher or explicitly gated.
- New host message is typed and handled without runtime-specific spelling.
- Paths use runtime-safe canonicalization.
- Workspace operation/request correlation is preserved.
- Tests cover protocol union and dispatcher parity.
- Electron/Tauri/VS Code Git routes use no shell, mutate no repository state, and preserve correlated `requestId` values.
- Repository history pagination preserves `limit`/`offset` semantics across Electron, Tauri, and VS Code.
- Repository revision file listing remains scoped to the active workspace and cannot expose sibling repository paths.
- Chromium/Website explicitly report Git unsupported and never invoke a local process.
- Historical revision, whole-workspace repository snapshot, and Diff modes are read-only and never replace or dirty the editable document session.
- Persisted repository revisions are workspace-keyed and are not cleared solely because they are outside the first history page.
- Internal Markdown editing and external/native Edit routes are both disabled while a historical workspace revision is active.
- Pane-owned split tabs preserve focused-pane state on close and do not dispatch application state on every scroll event.
- Focus-mode native dragging remains disabled in Tauri fullscreen.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/webviewMessages.ts` | Active request contract |
| Implementation | `ui/src/types/hostMessages.ts` | Active response contract |
| Implementation | `ui/src/history/historyClient.ts` | Correlated history requests and offset payload |
| Implementation | `ui/src/history/repositoryView.ts` | Per-workspace live/revision view persistence and commit filtering |
| Implementation | `ui/src/history/revisionWorkspace.ts` | Historical tree projection and search |
| Implementation | `ui/src/split-view` | Pane-owned tab/view state and selectors |
| Implementation | `electron/git/document-history.js` | Electron local Git adapter |
| Implementation | `tauri/src/dispatcher/git_history.rs` | Tauri routing |
| Implementation | `tauri/src/dispatcher/git_repository.rs` | Tauri repository-history paging |
| Implementation | `vscode/src/core/panelGitHistory.ts` | VS Code local Git adapter |
| Implementation | `chromium-xtension/src/browser-git-history-host.ts` | Explicit browser unsupported responses |
| Verification | `tests/node/repository-history-pagination-contract.test.mjs` | Pagination/search/routing parity |
| Verification | `tests/unit/ui/history/repository-view.test.ts` | Search/persistence behavior |
| Verification | `tests/unit/ui/history/revision-workspace.test.ts` | Revision file projection |
| Verification | `tests/unit/ui/split-view` | Pane tabs and isolation |

---

[← Website Demo and Browser File Mode](05-website-demo-file-mode.md) · [Documentation index](../README.md) · [UI-to-Host Command Catalog →](../05-reference/01-ui-to-host-command-catalog.md)
