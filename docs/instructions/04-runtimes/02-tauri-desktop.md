---
timestamp: '2026-08-01T22:54:00+07:00'
name: Tauri Desktop Runtime
topic: Rust host, local protocols, native conversion, window lifecycle, and updater configuration
document_type: runtime
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- tauri/src/main.rs
- tauri/src/lib.rs
- tauri/src/core/bootstrap.rs
- tauri/src/dispatcher.rs
- tauri/src/dispatcher/ready.rs
- tauri/src/dispatcher/commands.rs
- tauri/src/local_file.rs
- tauri/src/workspace/scanner.rs
- tauri/src/workspace/watch.rs
- tauri/src/search/worker.rs
- tauri/src/render/native_document_converter/mod.rs
- tauri/src/update/manager.rs
- tauri/tauri.conf.json
test_scope:
- tauri/tests/parity_smoke.rs
- tests/contracts/tauri-dispatcher-parity.test.ts
- tests/contracts/tauri-host-message-parity.test.ts
- tests/node/tauri-native-document-converter.test.mjs
- tests/contracts/tauri-package-config.test.ts
runtime_scope:
- tauri
keywords:
- runtime
- host
- parity
---

# Tauri Desktop Runtime

## Responsibilities

| Layer | Modules | Contract |
|---|---|---|
| Bootstrap/state | core bootstrap, app state, preload API | Initialize bridge-compatible API and shared state |
| Dispatcher | commands, ready, navigation, refresh, search, settings | Translate typed UI commands into Rust operations |
| Workspace | open, scanner, watch, recents, file types | Native scan/watch/open and supported types |
| Local files | local-file protocol | Workspace containment, range support, bounded reads |
| Search | incremental/index/worker | Search parity without blocking UI |
| Conversion | native converter modules | Format-specific Markdown preview and quality |
| Update/window | update manager, window/update commands | Native capability/state operations |

## Window configuration

- Default 1280×800; minimum 720×480.
- Frameless shell uses shared UI controls.
- Window state is restored through host state.
- Single-instance and file-drop paths route through normal workspace operations.

## Local-file protocol

- Resolve only content inside approved workspace roots.
- Support byte ranges for media playback.
- Reject unrestricted full reads above 256 MiB.
- Return safe errors for invalid/escaped paths.

## Native conversion

Modules cover HTML, Markdown/text, ODF, Office, PDF, PPTX, RTF, and spreadsheet content. PPTX/archive XML members are bounded to 32 MiB. Preview quality uses `converted-preview`, `legacy-best-effort`, or `conversion-failed`.

## Deployment condition

Updater operation is valid only after real endpoints/signing configuration replace deployment placeholders. The UI must rely on `canInstallUpdates`, not assume updater readiness from runtime name.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `tauri/src/main.rs` | Active behavior or contract |
| Implementation | `tauri/src/lib.rs` | Active behavior or contract |
| Implementation | `tauri/src/core/bootstrap.rs` | Active behavior or contract |
| Implementation | `tauri/src/dispatcher.rs` | Active behavior or contract |
| Implementation | `tauri/src/dispatcher/ready.rs` | Active behavior or contract |
| Implementation | `tauri/src/dispatcher/commands.rs` | Active behavior or contract |
| Implementation | `tauri/src/local_file.rs` | Active behavior or contract |
| Implementation | `tauri/src/workspace/scanner.rs` | Active behavior or contract |
| Implementation | `tauri/src/workspace/watch.rs` | Active behavior or contract |
| Implementation | `tauri/src/search/worker.rs` | Active behavior or contract |
| Implementation | `tauri/src/render/native_document_converter/mod.rs` | Active behavior or contract |
| Implementation | `tauri/src/update/manager.rs` | Active behavior or contract |
| Implementation | `tauri/tauri.conf.json` | Active behavior or contract |
| Verification | `tauri/tests/parity_smoke.rs` | Automated expectation |
| Verification | `tests/contracts/tauri-dispatcher-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/node/tauri-native-document-converter.test.mjs` | Automated expectation |
| Verification | `tests/contracts/tauri-package-config.test.ts` | Automated expectation |

---

[← Electron Desktop Runtime](01-electron-desktop.md) · [Documentation index](../README.md) · [VS Code Extension Runtime →](03-vscode-extension.md)
