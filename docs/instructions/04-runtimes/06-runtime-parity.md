---
timestamp: '2026-09-07T18:00:00+07:00'
name: Runtime Parity and Capability Matrix
topic: Common contracts, supported capabilities, and intentional runtime differences
document_type: runtime
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../../git-history-diff.md
source_scope:
- ui/src/types/webviewMessages.ts
- ui/src/types/hostMessages.ts
- ui/src/history/contracts.ts
- electron/core/runtime-command-handlers.js
- electron/git/document-history.js
- tauri/src/dispatcher/commands.rs
- tauri/src/dispatcher/git_history.rs
- vscode/src/core/panel.ts
- vscode/src/core/panelGitHistory.ts
- chromium-xtension/src/chrome-host.ts
- chromium-xtension/src/browser-git-history-host.ts
- website-app/src/web-test-message-router.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-dispatcher-parity.test.ts
- tests/contracts/tauri-host-message-parity.test.ts
- tests/unit/electron/document-history.test.ts
- tests/unit/vscode/panel-git-history.test.ts
- tests/unit/chromium/browser-git-history-host.test.ts
- tests/unit/chromium/chrome-host-commands.test.ts
runtime_scope:
- runtime
keywords:
- runtime
- host
- parity
- git
- history
- diff
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
| Scope View document modal | Yes | Yes | Yes | Yes | Yes |
| Hardware mouse history navigation (3/4) | Yes | Yes | Yes | Yes | Yes |
| Local Markdown save with revision conflict protection | Yes | Yes | Yes | Yes, writable file handle | Browser/virtual capability dependent |
| Two-pane Markdown split view | Yes | Yes | Yes | Yes | Yes |
| Local Git document history | Yes, installed Git | Yes, installed Git | Yes, installed Git | No, explicit unsupported | No, explicit unsupported |
| Read-only Git revision snapshots | Yes | Yes | Yes | No | No |
| Local Source/Rendered Diff | Yes | Yes | Yes | Yes for non-Git/local source comparisons | Yes for non-Git/local source comparisons |
| Installer updater | Installed packaged support | Signed plugin artifacts; download/defer/restart parity | Check/report only; VS Code installs | Store | Deployment |

## Git history parity contract

Electron, Tauri, and VS Code use the user's installed local `git` executable for document history. Git execution is read-only, restricted to the active workspace/repository, and always uses structured argument arrays rather than shell command strings. Full object IDs and repository-contained paths are validated before snapshots are read.

Chromium and Website hosts never attempt process execution. `getGitCapability` returns `{ supported: false, reason: 'unsupported-runtime' }`; history/snapshot/comparison requests fail safely without affecting ordinary reading, editing, split view, or local conflict comparison.

The shared UI computes source and rendered diffs locally with the dependency-free Myers line-diff implementation. Conflict comparison does not require Git and remains available wherever the editor has both disk/current sources.

## Common protocol requirement

All adapters must honor the active `WebviewMessage` and `HostMessage` discriminants they support. Unsupported capabilities are hidden or produce safe recovery; adapters must not silently reinterpret commands.

## Parity review checklist

- New UI→host command is added to every capable dispatcher or explicitly gated.
- New host message is typed and handled without runtime-specific spelling.
- Paths use runtime-safe canonicalization.
- Workspace operation/request correlation is preserved.
- Tests cover protocol union and dispatcher parity.
- Shared bookmarks stay host-independent; Tabs mode groups only workspaces already open in the desktop shell.
- Tauri updater state names and user choices match Electron even though installation is implemented by the official signed updater plugin.
- Electron/Tauri own desktop zoom and expose Reset zoom at `Ctrl+Alt+Z`; VS Code/Chromium/Website leave zoom to the host.
- Electron/Tauri/VS Code/Chromium/Website expose Markdown Explorer Typography; desktop and VS Code use system/filesystem fonts while Chromium and Web store custom font files in IndexedDB (`markdown-explorer-browser-fonts`).
- Export Center and Scope View operate across all runtimes, using native save dialogs on desktop/VS Code and standard browser file downloads on Chromium/Web.
- Hardware mouse back/forward buttons (buttons 3/4) and `BrowserBack`/`BrowserForward` keys provide universal history navigation in all runtimes.
- Electron and Tauri restored windows have an 800 px minimum width; browser/extension hosts own their outer window constraints.
- Document history is lazy: normal navigation must not start Git or enumerate commits.
- Electron/Tauri/VS Code Git routes use no shell, mutate no repository state, and preserve correlated `requestId` values.
- Chromium/Website explicitly report Git unsupported and never invoke a local process.
- Historical revision and Diff pane modes are read-only and never replace or dirty the editable document session.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/webviewMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/history/contracts.ts` | Shared Git history models |
| Implementation | `electron/core/runtime-command-handlers.js` | Electron command routing |
| Implementation | `electron/git/document-history.js` | Electron local Git adapter |
| Implementation | `tauri/src/dispatcher/commands.rs` | Tauri command routing |
| Implementation | `tauri/src/dispatcher/git_history.rs` | Tauri local Git adapter |
| Implementation | `vscode/src/core/panel.ts` | VS Code command routing |
| Implementation | `vscode/src/core/panelGitHistory.ts` | VS Code local Git adapter |
| Implementation | `chromium-xtension/src/browser-git-history-host.ts` | Explicit browser unsupported responses |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-dispatcher-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/unit/electron/document-history.test.ts` | Electron Git boundary and history behavior |
| Verification | `tests/unit/vscode/panel-git-history.test.ts` | VS Code Git parity |
| Verification | `tests/unit/chromium/browser-git-history-host.test.ts` | Browser unsupported behavior |

---

[← Website Demo and Browser File Mode](05-website-demo-file-mode.md) · [Documentation index](../README.md) · [UI-to-Host Command Catalog →](../05-reference/01-ui-to-host-command-catalog.md)
