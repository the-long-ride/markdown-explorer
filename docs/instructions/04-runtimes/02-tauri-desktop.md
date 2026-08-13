---
timestamp: '2026-08-05T06:40:23+07:00'
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
- tests/node/tauri-updater-contract.test.mjs
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

- Default 1280×800; minimum 800×480.
- Frameless shell uses shared UI controls.
- Window state is restored through host state.
- Single-instance and file-drop paths route through normal workspace operations.

## Local-file protocol

- Resolve only content inside approved workspace roots.
- Support byte ranges for media playback.
- Reject unrestricted full reads above 256 MiB.
- Return safe errors for invalid/escaped paths.

## Native font service

Tauri mirrors Electron's `listDesktopFonts`, `importDesktopFonts`, and `removeImportedDesktopFont` contracts. Rust inspects SFNT metadata, enumerates machine-wide and per-user font locations on Windows/macOS/Linux (including `.ttc`/`.otc` collection files for system-family detection), and copies accepted `.ttf`/`.otf` imports into `<app_data_dir>/fonts`.
Required Regular/Bold/Italic coverage is derived from static faces or variable-font axes; `ital`/`slnt` variable axes can satisfy italic coverage from one file, while weight-only variable fonts still require an italic companion.

The `local-file://` protocol may serve canonical `.ttf`/`.otf` files inside that managed fonts directory in addition to active-workspace resources. This exception is narrowly scoped to app-managed fonts and uses font MIME types; arbitrary paths outside the workspace/managed font roots remain forbidden.

## Native conversion

Modules cover HTML, Markdown/text, ODF, Office, PDF, PPTX, RTF, and spreadsheet content. PPTX/archive XML members are bounded to 32 MiB. Preview quality uses `converted-preview`, `legacy-best-effort`, or `conversion-failed`.

## Signed update lifecycle

- Production initializes `tauri-plugin-updater` and `tauri-plugin-process`; debug builds report updater installation unavailable.
- Release configuration injects a real updater public key and signs generated updater artifacts.
- Download checks the configured endpoint, validates the requested version, verifies the signature, stages bytes, emits progress, and persists resumable state.
- Downloaded state supports **Update on Close** and **Restart Now**, matching Electron UI behavior.
- Close interception installs only `scheduled-on-exit`; immediate apply also accepts `downloaded`.
- A relaunch reconstructs the update descriptor from the endpoint before installing persisted verified bytes.
- Windows `.exe`, Linux `.AppImage`, and macOS `.app.tar.gz` updater files publish with their `.sig` companions.

Updater operation is valid only after real endpoint/signing secrets replace deployment placeholders. UI capability remains controlled by `canInstallUpdates`.

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
| Verification | `tests/node/tauri-updater-contract.test.mjs` | Signed updater lifecycle and release artifact contract |

---

[← Electron Desktop Runtime](01-electron-desktop.md) · [Documentation index](../README.md) · [VS Code Extension Runtime →](03-vscode-extension.md)
