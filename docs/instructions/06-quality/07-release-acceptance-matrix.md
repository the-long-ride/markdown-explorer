---
timestamp: '2026-09-17T00:00:00+07:00'
name: Release Acceptance Matrix
topic: Product-level release readiness across use cases, hosts, security, and delivery
document_type: quality
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../../git-history-diff.md
- ../../use-cases/compare-document-history.md
- ../../superpowers/specs/2026-09-17-pr48-as-built-sync.md
source_scope:
- package.json
- .github/workflows/test.yml
- .github/workflows/release.yml
- .github/STORE_PUBLISHING.md
- ui/src/editor
- ui/src/history
- ui/src/split-view
- ui/src/components/Content/MarkdownSourceEditor.tsx
- ui/src/components/Content/MarkdownFormattingToolbar.tsx
- ui/src/components/Content/documentFileDrop.ts
- ui/src/components/History/RepositoryHistoryPanel.tsx
- electron/git/document-history.js
- tauri/src/dispatcher/git_history.rs
- tauri/src/dispatcher/git_repository.rs
- vscode/src/core/panelGitHistory.ts
test_scope:
- tests/manifest/coverage-manifest.test.ts
- tests/manifest/editor-git-split-coverage-manifest.ts
- tests/contracts/workflow-config.test.ts
- tests/contracts/package-config.test.ts
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-host-message-parity.test.ts
- tests/node/repository-history-pagination-contract.test.mjs
- tests/node/split-file-drag-drop-contract.test.mjs
- tests/node/focus-drag-region-contract.test.mjs
- tests/unit/ui/editor
- tests/unit/ui/history
- tests/unit/ui/split-view
- tests/unit/electron/document-history.test.ts
- tests/unit/vscode/panel-git-history.test.ts
- tests/unit/chromium/browser-git-history-host.test.ts
runtime_scope:
- all
keywords:
- quality
- verification
- release
- editing
- git
- repository snapshots
- split view
- pagination
---

# Release Acceptance Matrix

## Product acceptance

| Area | Required evidence |
|---|---|
| Launch | Ready/unavailable/selection paths work in every shipped runtime |
| Workspace | Folder/file/recent/drop/external open, partial scan, cancel, watch, recovery |
| Navigation | Sidebar, TOC, links, history, workspace tabs, content tabs, scroll memory, persistent bookmark jumps |
| Search | Find, live workspace, historical revision workspace, cross-tab where supported; stale request suppression |
| Rendering | Markdown/MDX corpus, code, tables, math, Mermaid, media, HTML sandbox |
| Feature controls | Features Settings section persists expected defaults; Markdown Editing starts off; History Sidebar starts on but remains capability-gated |
| Markdown editing | Rendered/Inline Edit/Plain transitions, CodeMirror source editor, formatting toolbar/shortcuts, one shared working copy per document, dirty-state derivation, local re-render, writable-runtime gating |
| Edit routing | Live workspace: feature ON enters internal editor, feature OFF opens external/native editor on capable hosts; historical workspace disables both paths |
| Save/conflicts | Revision-token save, conflict rejection, Reload/Compare/keep-mine flow, unsaved guards, permission/read-only failures, no silent overwrite |
| Split view | Two panes with pane-owned tab strips and active tabs, focused-pane navigation, move/swap/close, mode independence, shared editable source, read-only Revision/Diff modes |
| Split close | Closing split preserves the currently focused pane and that pane's tabs; the opposite pane is discarded |
| Split scroll/render isolation | Ordinary scrolling stays local and persists at lifecycle boundaries; opposite-pane document bodies do not rerender/remount for unrelated scroll, source, or activation changes |
| Split file opening | Files context menu exposes Open in Split View; drag/drop uses the Markdown Explorer file MIME payload and targets the exact pane under the pointer |
| Git document history | Lazy capability/history load, installed-Git support on Electron/Tauri/VS Code, rename traversal, full-OID/path validation, explicit Chromium/Web unsupported behavior |
| Repository History | Continuous graph, merge parents/refs/HEAD, commit menu, search by full/short SHA/author/subject, 50-item initial page, offset pagination, infinite/progressive loading, workspace-scoped revision tree/search/file reads, per-workspace restore, accent indicator, Return to HEAD without checkout |
| History routing | More Actions → History expands/selects the repository History sidebar; document revision/diff workflows remain available without owning that top-level route |
| Revision projection | Historical Files view matches normal document eligibility and excludes arbitrary source-code files; conversion formats appear only when document conversion is enabled |
| Persisted revision validation | A saved historical OID is not cleared solely because it lies outside the initial history page; additional pages may be loaded before declaring it stale |
| Focus mode | Desktop Focus view retains a native drag surface, controls are no-drag, breadcrumb sizing is compact, and Tauri fullscreen cannot be made draggable |
| Diff | Dependency-free Myers source diff, deterministic hunks/ranges, complete-document Rendered Diff, revision/current/working-copy/two-revision comparison, non-Git conflict comparison |
| Conversion | Enable/disable, cache, formats, warnings/failures on capable hosts |
| Settings | Every key, shortcuts, themes, feature controls, import/export, localization, onboarding |
| Localization | Editor toolbar, split, History, repository snapshot, Git failure states, Source/Rendered Diff, Added/Removed/Unchanged available across all nine locales |
| Desktop | Window/tray/fullscreen/zoom/quit, updater capability gating, signed artifact pairs, deferred/immediate apply |
| Security | Path containment, dangerous URL blocking, HTML network restrictions, Git no-shell structured arguments, repository/workspace-contained reads, no Git mutation commands |
| Performance | Incremental reveal, bounded work/results, cancellation, bounded historical search, paged history, 10k-line mostly-identical diff without quadratic matrix allocation, split-pane render isolation |
| Version | Root and synchronized runtime/package/site metadata agree on the intended release version; PR #48 target is 1.6.9 |

## Host acceptance

- Electron installed, portable, and intended macOS/Linux artifacts behave according to capability. Document writes and local Git history use bounded, workspace-contained operations. Repository History maps paging to `--skip=<offset>` and `-n <limit>`.
- Tauri local protocols, conversion, window state, signed updater progress/state restoration, close-time apply, restart-now apply, document writes, and `std::process::Command` Git history/repository snapshot reads pass. Repository paging has the same limit/offset semantics as Electron/VS Code.
- VS Code commands, webview panel, editor actions, watching, packaging, revision-protected writes, and `execFile` Git history/repository snapshot reads pass, including offset paging.
- Chromium handles, permission recovery, writable-file save capability, scanning, polling, search, IndexedDB, and explicit Git `unsupported-runtime` behavior for both document and repository history pass.
- Website demo and file mode remain browser-safe and deploy successfully; no browser host attempts local process execution.

## Editor / History / Split safety acceptance

- Historical Git snapshots are never copied into editable document-session state and cannot be saved in place.
- Whole-workspace revision browsing overlays the live content shell; returning to HEAD clears revision view/persistence only and exposes already-mounted live tabs/split/editor state.
- Revision, repository snapshot, and Diff modes expose no internal edit, external-editor action, or save path.
- Git adapters perform only read operations. Stage, commit, checkout, restore, reset, stash, branch, switch, merge, rebase, or equivalent repository mutation is outside the protocol.
- Git commands use argument arrays/structured process APIs and never interpolate user paths or revisions into shell command strings.
- Invalid object IDs, workspace escapes, repository escapes, missing Git, non-repositories, and bounded-output failures recover without breaking normal Markdown reading/editing.
- Repository file listing and snapshot reads remain inside the active workspace, even when that workspace is a subfolder of a larger Git repository.
- Historical workspace search reads revision sources only and never routes synthetic `revision://` paths into live filesystem navigation/write APIs.
- Persisted historical selections are isolated by workspace key and may page repository history before stale/pruned fallback is decided.
- Dirty working-copy comparisons use the UI working source; conflict comparison can operate without Git.
- CodeMirror controlled-value synchronization must not echo external updates back into document-session `onChange` handling.
- Editor formatting/save shortcuts must only be intercepted while the CodeMirror editor owns focus.
- Opposite split panes do not rerender their document body for unrelated source, scroll, or activation changes.
- Pane scrolling must not dispatch global application state on every scroll event.
- File drag/drop must not bypass dirty-session guards or target the wrong pane.

## Final verification commands

For the local Markdown editing + split view + Git History/Diff release gate, all of the following must exit 0:

```bash
pnpm run test:ui
pnpm run test:electron
pnpm run test:vscode
pnpm run test:chromium
pnpm run test:contracts
pnpm run test:node
pnpm run test:translations
pnpm run lint:ui-styles
pnpm run build
cargo test --manifest-path tauri/Cargo.toml -- --test-threads=1
```

Manual acceptance on at least one real local Git repository additionally covers: CodeMirror formatting/save, internal-vs-external Edit routing, external-change conflict protection, pane-owned tabs, focused-pane preservation on split close, independent pane scrolling, file context-menu/drag opening into a chosen pane, opposite-pane render isolation, rename-following document history, repository search, multiple history pages, continuous graph with a merge commit, commit SHA/author copy, persistent whole-workspace revision browsing beyond the first page, revision Files filtering/search/navigation, History old-revision indicator, stale persisted-revision fallback, Return to current HEAD without working-tree changes, and desktop Focus dragging/fullscreen lock.

## Release decision

Release is blocked by failed required tests, contract drift, incomplete artifact set for the announced channel, version drift, security regression, writable-runtime conflict-protection regression, Git mutation/no-shell regression, repository/workspace containment regression, historical/live-state leakage, split render/scroll isolation regression, CodeMirror synchronization regression, or undocumented active behavior. Known non-blocking limitations are written explicitly in release notes.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `package.json` | Authoritative release version and active scripts |
| Implementation | `scripts/sync-versions.mjs` | Cross-runtime version synchronization |
| Implementation | `ui/src/editor` | Editable document-session, formatting, and conflict behavior |
| Implementation | `ui/src/history` | History client, repository view/projection/search, graph, Myers diff, changed ranges |
| Implementation | `ui/src/components/History/RepositoryHistoryPanel.tsx` | History search and progressive page loading |
| Implementation | `ui/src/components/Content/documentFileDrop.ts` | Drag payload contract |
| Implementation | `ui/src/split-view` | Pane-owned tabs, selectors, render revisions, scroll state |
| Implementation | `electron/git/document-history.js` | Electron read-only Git adapter |
| Implementation | `tauri/src/dispatcher/git_repository.rs` | Tauri repository paging |
| Implementation | `vscode/src/core/panelGitHistory.ts` | VS Code Git adapter |
| Verification | `tests/manifest/editor-git-split-coverage-manifest.ts` | New production-source ownership map |
| Verification | `tests/node/repository-history-pagination-contract.test.mjs` | Pagination/search/routing parity |
| Verification | `tests/node/split-file-drag-drop-contract.test.mjs` | Drag/drop contract |
| Verification | `tests/node/focus-drag-region-contract.test.mjs` | Focus drag contract |
| Verification | `tests/unit/ui/editor`, `tests/unit/ui/history`, `tests/unit/ui/split-view` | Shared UI acceptance |

---

[← Documentation Maintenance](06-documentation-maintenance.md) · [Documentation index](../README.md)
