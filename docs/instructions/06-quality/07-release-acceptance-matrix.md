---
timestamp: '2026-09-14T00:00:00+07:00'
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
- electron/git/document-history.js
- tauri/src/dispatcher/git_history.rs
- vscode/src/core/panelGitHistory.ts
test_scope:
- tests/manifest/coverage-manifest.test.ts
- tests/manifest/editor-git-split-coverage-manifest.ts
- tests/contracts/workflow-config.test.ts
- tests/contracts/package-config.test.ts
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-host-message-parity.test.ts
- tests/unit/ui/editor
- tests/unit/ui/history
- tests/unit/ui/split-view
- tests/unit/electron/document-history.test.ts
- tests/unit/vscode/panel-git-history.test.ts
- tests/unit/chromium/browser-git-history-host.test.ts
- tests/node/bookmarks.test.mjs
- tests/node/tauri-updater-contract.test.mjs
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
| Markdown editing | Rendered/Inline Edit/Plain mode transitions, CodeMirror source editor, formatting toolbar/shortcuts, one shared working copy per document, dirty-state derivation, local re-render, and writable-runtime capability gating |
| Edit routing | Live workspace: feature ON enters internal editor, feature OFF opens external/native editor on capable hosts; historical workspace disables both paths |
| Save/conflicts | Revision-token save, conflict rejection, Reload/Compare/keep-mine flow, unsaved guards, permission/read-only failures, no silent overwrite |
| Split view | Two independent panes, active-pane navigation, move/swap/close, pane mode/scroll independence, shared editable source, read-only Revision/Diff modes |
| Split render isolation | Document-scoped render revisions prevent unrelated opposite-pane body renders; same-document edit/render mirrors debounce by 150 ms and flush around save/file transitions |
| Git document history | Lazy capability/history load, installed-Git support on Electron/Tauri/VS Code, rename traversal, full-OID/path validation, explicit Chromium/Web unsupported behavior |
| Repository History | Continuous graph, merge parents/refs/HEAD, commit metadata/copy menu, workspace-scoped revision tree/search/file reads, per-workspace restore, stale-revision fallback, accent indicator, Return to HEAD without checkout |
| Diff | Dependency-free Myers source diff, deterministic hunks/ranges, complete-document Rendered Diff, revision/current/working-copy/two-revision comparison, non-Git conflict comparison |
| Conversion | Enable/disable, cache, formats, warnings/failures on capable hosts |
| Settings | Every key, shortcuts, themes, feature controls, import/export, localization, onboarding |
| Localization | Editor toolbar, split, History, repository snapshot, Git failure states, Source/Rendered Diff, Added/Removed/Unchanged available across all nine locales |
| Desktop | Window/tray/fullscreen/zoom/quit, updater capability gating, signed artifact pairs, deferred/immediate apply |
| Security | Path containment, dangerous URL blocking, HTML network restrictions, Git no-shell structured arguments, repository/workspace-contained reads, no Git mutation commands |
| Performance | Incremental reveal, bounded work/results, cancellation, bounded historical search, 10k-line mostly-identical diff without quadratic matrix allocation, split-pane render isolation |

## Host acceptance

- Electron installed, portable, and intended macOS/Linux artifacts behave according to capability; document writes and local Git history use bounded, workspace-contained host operations. Repository History preserves merge parents/refs/HEAD, lists only workspace-contained revision files, and reads snapshots without mutating the working tree.
- Tauri local protocols, conversion, window state, signed updater progress/state restoration, close-time apply, restart-now apply, document writes, and `std::process::Command` Git history/repository snapshot reads pass.
- VS Code commands, webview panel, editor actions, watching, packaging, revision-protected writes, and `execFile` Git history/repository snapshot reads pass.
- Chromium handles, permission recovery, writable-file save capability, scanning, polling, search, IndexedDB, and explicit Git `unsupported-runtime` behavior for both document and repository history pass.
- Website demo and file mode remain browser-safe and deploy successfully; no browser host attempts local process execution.

## Editor / History safety acceptance

- Historical Git snapshots are never copied into editable document-session state and cannot be saved in place.
- Whole-workspace revision browsing overlays the live content shell; returning to HEAD clears revision view/persistence only and exposes the already-mounted live tabs/split/editor state.
- Revision, repository snapshot, and Diff modes expose no internal edit, external-editor action, or save path.
- Git adapters perform only read operations. Stage, commit, checkout, restore, reset, stash, branch, switch, merge, rebase, or equivalent repository mutation is outside the protocol.
- Git commands use argument arrays/structured process APIs and never interpolate user paths or revisions into shell command strings.
- Invalid object IDs, workspace escapes, repository escapes, missing Git, non-repositories, and bounded-output failures recover without breaking normal Markdown reading/editing.
- Repository file listing and snapshot reads remain inside the active workspace, even when that workspace is a subfolder of a larger Git repository.
- Historical workspace search reads revision sources only and never routes synthetic `revision://` paths into live filesystem navigation/write APIs.
- Persisted historical selections are isolated by workspace key; a missing/rebased/pruned selection is cleared and falls back to live HEAD.
- Dirty working-copy comparisons use the UI working source; conflict comparison can operate without Git.
- CodeMirror controlled-value synchronization must not echo external updates back into document-session `onChange` handling.
- Editor formatting/save shortcuts must only be intercepted while the CodeMirror editor owns focus.
- Opposite split panes do not rerender their document body for unrelated source, scroll, or activation changes.

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

Manual acceptance on at least one real local Git repository additionally covers: CodeMirror formatting and save, internal-vs-external Edit routing, external-change conflict protection, two-pane independent modes, opposite-pane render isolation, same-document debounced rendered mirror, rename-following document history, continuous repository graph with a merge commit, commit SHA/author copy actions, persistent whole-workspace revision browsing, revision Files/search/navigation, History old-revision indicator, stale persisted-revision fallback, and Return to current HEAD without working-tree changes.

## Release decision

Release is blocked by failed required tests, contract drift, incomplete artifact set for the announced channel, security regression, writable-runtime conflict-protection regression, Git mutation/no-shell regression, repository/workspace containment regression, historical/live-state leakage, split render-isolation regression, CodeMirror synchronization regression, or undocumented active behavior. Known non-blocking limitations are written explicitly in release notes.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `package.json` | Active behavior or contract |
| Implementation | `.github/workflows/test.yml` | Active behavior or contract |
| Implementation | `.github/workflows/release.yml` | Active behavior or contract |
| Implementation | `.github/STORE_PUBLISHING.md` | Active behavior or contract |
| Implementation | `ui/src/editor` | Editable document-session, formatting, and conflict behavior |
| Implementation | `ui/src/history` | History client, repository view/projection/search, graph, Myers diff, and changed ranges |
| Implementation | `ui/src/components/Content/MarkdownSourceEditor.tsx` | CodeMirror source interaction and shortcuts |
| Implementation | `ui/src/components/Content/MarkdownFormattingToolbar.tsx` | Source-formatting controls |
| Implementation | `ui/src/split-view` | Two-pane state, selectors, and document render revisions |
| Implementation | `electron/git/document-history.js` | Electron read-only Git adapter |
| Implementation | `tauri/src/dispatcher/git_history.rs` | Tauri read-only Git adapter |
| Implementation | `vscode/src/core/panelGitHistory.ts` | VS Code read-only Git adapter |
| Verification | `tests/manifest/coverage-manifest.test.ts` | Automated expectation |
| Verification | `tests/manifest/editor-git-split-coverage-manifest.ts` | New production-source ownership map |
| Verification | `tests/contracts/host-message-parity.test.ts` | Shared protocol parity |
| Verification | `tests/contracts/tauri-host-message-parity.test.ts` | Tauri host message parity |
| Verification | `tests/unit/ui/editor`, `tests/unit/ui/history`, `tests/unit/ui/split-view` | Shared UI acceptance |
| Verification | `tests/unit/electron/document-history.test.ts` | Electron Git security/history behavior |
| Verification | `tests/unit/vscode/panel-git-history.test.ts` | VS Code Git behavior |
| Verification | `tests/unit/chromium/browser-git-history-host.test.ts` | Browser unsupported behavior |
| Verification | `tests/node/bookmarks.test.mjs`, `tests/node/bookmark-*.test.mjs` | Source-anchored bookmark acceptance contracts |
| Verification | `tests/node/user-manual-home.test.mjs` | User Manual placement, search, action, and localization contract |
| Verification | `tests/node/tauri-updater-contract.test.mjs` | Signed Tauri updater acceptance contract |

---

[← Documentation Maintenance](06-documentation-maintenance.md) · [Documentation index](../README.md)
