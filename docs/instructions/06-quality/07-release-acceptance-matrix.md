---
timestamp: '2026-09-07T18:00:00+07:00'
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
- split view
---

# Release Acceptance Matrix

## Product acceptance

| Area | Required evidence |
|---|---|
| Launch | Ready/unavailable/selection paths work in every shipped runtime |
| Workspace | Folder/file/recent/drop/external open, partial scan, cancel, watch, recovery |
| Navigation | Sidebar, TOC, links, history, workspace tabs, content tabs, scroll memory, persistent bookmark jumps |
| Search | Find, workspace, cross-tab where supported; stale request suppression |
| Rendering | Markdown/MDX corpus, code, tables, math, Mermaid, media, HTML sandbox |
| Markdown editing | Rendered/Inline Edit/Plain mode transitions, one shared working copy per document, dirty-state derivation, local re-render, and writable-runtime capability gating |
| Save/conflicts | Revision-token save, conflict rejection, Reload/Compare/keep-mine flow, unsaved guards, permission/read-only failures, no silent overwrite |
| Split view | Two independent panes, active-pane navigation, move/swap/close, pane mode/scroll independence, shared editable source, read-only Revision/Diff modes |
| Git history | Lazy capability/history load, installed-Git support on Electron/Tauri/VS Code, rename traversal, full-OID/path validation, explicit Chromium/Web unsupported behavior |
| Diff | Dependency-free Myers source diff, deterministic hunks/ranges, complete-document Rendered Diff, revision/current/working-copy/two-revision comparison, non-Git conflict comparison |
| Conversion | Enable/disable, cache, formats, warnings/failures on capable hosts |
| Settings | Every key, shortcuts, themes, import/export, localization, onboarding |
| Localization | Editor, split, History, Git failure states, Source/Rendered Diff, Added/Removed/Unchanged available across all nine locales |
| Desktop | Window/tray/fullscreen/zoom/quit, updater capability gating, signed artifact pairs, deferred/immediate apply |
| Security | Path containment, dangerous URL blocking, HTML network restrictions, Git no-shell structured arguments, repository-contained reads, no Git mutation commands |
| Performance | Incremental reveal, bounded work/results, cleanup/cancellation, 10k-line mostly-identical diff without quadratic matrix allocation |

## Host acceptance

- Electron installed, portable, and intended macOS/Linux artifacts behave according to capability; document writes and local Git history use bounded, workspace-contained host operations.
- Tauri local protocols, conversion, window state, signed updater progress/state restoration, close-time apply, restart-now apply, document writes, and `std::process::Command` Git history pass.
- VS Code commands, webview panel, editor actions, watching, packaging, revision-protected writes, and `execFile` Git history pass.
- Chromium handles, permission recovery, writable-file save capability, scanning, polling, search, IndexedDB, and explicit Git `unsupported-runtime` behavior pass.
- Website demo and file mode remain browser-safe and deploy successfully; no browser host attempts local process execution.

## Editor / History safety acceptance

- Historical Git snapshots are never copied into editable document-session state and cannot be saved in place.
- Revision and Diff pane modes expose no editable control or save path.
- Git adapters perform only read operations. Stage, commit, checkout, restore, reset, stash, branch, merge, rebase, or equivalent repository mutation is outside the protocol.
- Git commands use argument arrays/structured process APIs and never interpolate user paths or revisions into shell command strings.
- Invalid object IDs, workspace escapes, repository escapes, missing Git, non-repositories, and bounded-output failures recover without breaking normal Markdown reading/editing.
- Dirty working-copy comparisons use the UI working source; conflict comparison can operate without Git.

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

Manual acceptance on at least one real local Git repository additionally covers: edit/save, external-change conflict protection, two-pane independent modes, rename-following document history, read-only revision view, revision-to-current diff, and dirty working-copy diff.

## Release decision

Release is blocked by failed required tests, contract drift, incomplete artifact set for the announced channel, security regression, writable-runtime conflict-protection regression, Git mutation/no-shell regression, or undocumented active behavior. Known non-blocking limitations are written explicitly in release notes.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `package.json` | Active behavior or contract |
| Implementation | `.github/workflows/test.yml` | Active behavior or contract |
| Implementation | `.github/workflows/release.yml` | Active behavior or contract |
| Implementation | `.github/STORE_PUBLISHING.md` | Active behavior or contract |
| Implementation | `ui/src/editor` | Editable document-session and conflict behavior |
| Implementation | `ui/src/history` | History client, Myers diff, and changed ranges |
| Implementation | `ui/src/split-view` | Two-pane state and selectors |
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
