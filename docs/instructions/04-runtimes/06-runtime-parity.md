---
timestamp: '2026-08-05T06:40:23+07:00'
name: Runtime Parity and Capability Matrix
topic: Common contracts, supported capabilities, and intentional runtime differences
document_type: runtime
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- ui/src/types/webviewMessages.ts
- ui/src/types/hostMessages.ts
- electron/core/runtime-command-handlers.js
- tauri/src/dispatcher/commands.rs
- vscode/src/core/panel.ts
- chromium-xtension/src/chrome-host.ts
- website-app/src/web-test-message-router.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-dispatcher-parity.test.ts
- tests/contracts/tauri-host-message-parity.test.ts
- tests/unit/chromium/chrome-host-commands.test.ts
runtime_scope:
- runtime
keywords:
- runtime
- host
- parity
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
| Installer updater | Installed packaged support | Signed plugin artifacts; download/defer/restart parity | Marketplace | Store | Deployment |

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

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/webviewMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `electron/core/runtime-command-handlers.js` | Active behavior or contract |
| Implementation | `tauri/src/dispatcher/commands.rs` | Active behavior or contract |
| Implementation | `vscode/src/core/panel.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/chrome-host.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-test-message-router.ts` | Active behavior or contract |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-dispatcher-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/chrome-host-commands.test.ts` | Automated expectation |

---

[← Website Demo and Browser File Mode](05-website-demo-file-mode.md) · [Documentation index](../README.md) · [UI-to-Host Command Catalog →](../05-reference/01-ui-to-host-command-catalog.md)
