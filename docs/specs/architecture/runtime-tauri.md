---
schema_version: 1
id: "architecture.runtime-tauri"
title: "Tauri Desktop Runtime Architecture"
kind: "architecture"
status: "verified"
summary: "Tauri v2 Rust host architecture: bootstrap, window/menu setup, Electron-parity preload shim, async command dispatcher, local-file/youtube-proxy protocols, search, conversion, and signed updater."
tags: ["architecture", "tauri", "rust", "desktop", "ipc", "updater"]
source_paths: ["tauri/build.rs", "tauri/scripts/run-with-global-cache.mjs", "tauri/src/app_state.rs", "tauri/src/core/bootstrap.rs", "tauri/src/core/error.rs", "tauri/src/core/mod.rs", "tauri/src/debug_tools.rs", "tauri/src/dispatcher.rs", "tauri/src/dispatcher/commands.rs", "tauri/src/dispatcher/commands_external.rs", "tauri/src/dispatcher/commands_window_update.rs", "tauri/src/dispatcher/commands_workspace.rs", "tauri/src/dispatcher/content_handlers.rs", "tauri/src/dispatcher/document_write.rs", "tauri/src/dispatcher/git_history.rs", "tauri/src/dispatcher/git_repository.rs", "tauri/src/dispatcher/git_runner.rs", "tauri/src/dispatcher/handlers.rs", "tauri/src/dispatcher/incremental_scan.rs", "tauri/src/dispatcher/navigation.rs", "tauri/src/dispatcher/ready.rs", "tauri/src/dispatcher/refresh.rs", "tauri/src/dispatcher/search.rs", "tauri/src/dispatcher/settings.rs", "tauri/src/dispatcher/workspace_entries.rs", "tauri/src/dispatcher/workspace_entry_paths.rs", "tauri/src/error.rs", "tauri/src/fonts.rs", "tauri/src/host_message.rs", "tauri/src/insights/external.rs", "tauri/src/insights/external_host.rs", "tauri/src/insights/mod.rs", "tauri/src/insights/scan.rs", "tauri/src/lib.rs", "tauri/src/local_file.rs", "tauri/src/main.rs", "tauri/src/perf.rs", "tauri/src/preload/api.rs", "tauri/src/preload/mod.rs", "tauri/src/render/document_converter.rs", "tauri/src/render/mod.rs", "tauri/src/render/native_document_converter/html.rs", "tauri/src/render/native_document_converter/markdown.rs", "tauri/src/render/native_document_converter/mod.rs", "tauri/src/render/native_document_converter/odf.rs", "tauri/src/render/native_document_converter/office.rs", "tauri/src/render/native_document_converter/pdf.rs", "tauri/src/render/native_document_converter/pptx.rs", "tauri/src/render/native_document_converter/rtf.rs", "tauri/src/render/native_document_converter/spreadsheet.rs", "tauri/src/runtime/close_guard.rs", "tauri/src/runtime/export_resources.rs", "tauri/src/runtime/external_open.rs", "tauri/src/runtime/html_preview.rs", "tauri/src/runtime/mod.rs", "tauri/src/runtime/navigation.rs", "tauri/src/runtime/png_export.rs", "tauri/src/runtime/refresh.rs", "tauri/src/runtime/startup.rs", "tauri/src/search/incremental.rs", "tauri/src/search/index.rs", "tauri/src/search/mod.rs", "tauri/src/search/unicode.rs", "tauri/src/search/worker.rs", "tauri/src/update/manager.rs", "tauri/src/update/mod.rs", "tauri/src/workspace/file_types.rs", "tauri/src/workspace/mod.rs", "tauri/src/workspace/open.rs", "tauri/src/workspace/recents.rs", "tauri/src/workspace/scanner.rs", "tauri/src/workspace/tree_builder.rs", "tauri/src/workspace/watch.rs", "tauri/src/youtube.rs", "tauri/tests/parity_smoke.rs", "tauri/windows/explorer-hooks.nsh"]
related_specs: ["architecture.ui-state-and-runtimes", "architecture.runtime-electron", "workflow.build-and-verification"]
last_doc_update_at: "2026-11-20T11:41:30Z"
last_verified_at: "2026-11-20T11:41:30Z"
last_verified_code_commit: "f0818d86f926ee15c5508b3bc186e1ddf18f50b8"
last_source_change_commit: "f8fd06a7148e4607c9ee8adf9b244dd24b704cea"
last_source_change_at: "2026-11-18T04:36:49+07:00"
source_fingerprint: "sha256:d5e8e7c5d9cc4e9aebe5b0c7ddb463f84a9f2de3cc07eaf3deb37cfa343792ca"
---

# Tauri Desktop Runtime Architecture

## Purpose and boundaries

Defines the Tauri v2 native Rust desktop host (`tauri/Cargo.toml`, `markdown-explorer-tauri` v1.7.2, Rust edition 2021, MSRV `1.96`, `[profile.release]` configured with `codegen-units = 1`, `lto = true`, `opt-level = "s"`, `panic = "abort"`, `strip = true`, and `tauri/tauri.conf.json` v1.7.2 with `"removeUnusedCommands": true`), which mirrors Electron's `window.electronAPI` contract so `ui/dist` runs unchanged across both desktop runtimes.

- **In scope**: `tauri/src/**`, `tauri/windows/explorer-hooks.nsh`, `tauri/icons/**`, `tauri/scripts/run-with-global-cache.mjs`, `tauri/capabilities/default.json`.
- **Out of scope**: `tauri/vendor/**` (122 third-party vendored files), shared React UI (`architecture.ui-state-and-runtimes`), and CI/store workflows (`workflow.build-and-verification`).

## Observable behavior

- **Bootstrap & plugins (`tauri/src/core/bootstrap.rs`, `tauri/src/app_state.rs`)**: Registers `opener`, `dialog`, `shell`, `clipboard-manager`, `process`, `updater`, `single-instance` (forwarding secondary-instance CLI paths), and `window-state` (excluding fullscreen/decorations), plus custom `youtube-proxy` and `local-file` URI protocols. `AppStateInner` tracks both `ready_handled: bool` and `last_ready_id: Option<String>`. On page load (`PageLoadEvent::Started`), resets pending close guards, `ready_handled = false`, `workspace_operation_id = None`, and `workspace_tab_id = None` so reloaded UIs re-handshake cleanly.
- **Window & events**: Creates frameless `"main"` window (`1280x800`, min `800x480`) injecting `electron_api_shim_js()`; bridges `WebviewEvent::DragDrop` to `window.__markdownExplorerHandleNativeDrop`, drives `FullscreenTransition`, and enforces `CloseGuard::on_close_requested` + deferred update application on `CloseRequested`.
- **Preload shim (`tauri/src/preload/api.rs`, `tauri/src/lib.rs`)**: Unconditionally compiled as `pub mod preload;` (including under `#[cfg(test)]`). Exposes `window.electronAPI` (`postMessage` -> `'webview-message'`, `onMessage` buffered up to 100 messages via `__markdownExplorerHandleHostMessage`, `getPathForFile`, `consumeDroppedPaths`), rewrites `file:///` media URLs to `local-file://` via `MutationObserver`, and calls `e.preventDefault()` (without `stopImmediatePropagation()`) on `Ctrl/Cmd+R` and `Ctrl/Cmd+F5` to suppress WebView2's unmanaged native reload accelerator while letting keydown events reach the app's shortcut handler.
- **Command dispatcher & non-blocking I/O (`tauri/src/dispatcher/handlers.rs`)**: Routes `ready` (deduplicated by `readyId` / `last_ready_id` in `dispatcher/ready.rs`, clearing stale `workspace_operation_id` and `workspace_tab_id` when `requested_operation` is absent), async content loading (`dispatcher/content_handlers.rs` offloading HTML source reading, `converter.read_markdown`, and `document_write::document_revision` to `tauri::async_runtime::spawn_blocking`, awaited by `dispatcher/navigation.rs` and spawned asynchronously by `dispatcher/incremental_scan.rs`), document writes (`saveDocument` with atomic temp-file write and `mtime:size` conflict check), Git history (`spawn_blocking`, 20s timeout, 16 MiB cap), non-blocking workspace refresh/search (`send_workspace_files_changed` in `dispatcher/handlers.rs` awaited by `dispatcher/refresh.rs`, and `loadWorkspaceSearchIndex` in `dispatcher/search.rs` offloading `scan` and `idx.prime` to `spawn_blocking`), Insights & SSRF-guarded external link checks, export resources, fonts, HTML preview server (`127.0.0.1`), window/zoom controls, and signed updates (`UpdaterExt`).
- **Bounded LRU caches & watcher coalescing (`tauri/src/render/document_converter.rs`, `tauri/src/search/index.rs`, `tauri/src/workspace/watch.rs`)**: `DocumentConverter` bounds its in-memory conversion cache to `MAX_CONVERTER_CACHE_ENTRIES = 256` with a `VecDeque<String>` LRU order (`touch_cache_entry`). `SearchIndex` (`SearchCache`) stores `Arc<SearchEntry>` in a bounded LRU cache (`MAX_SEARCH_CACHE_ENTRIES = 512`, `MAX_INDEXABLE_BYTES = 2 MiB`), avoiding full entry clones on cache hits and evicting oldest entries past capacity. `WorkspaceWatchController` (`collect_watch_event_paths`) ignores `notify::EventKind::Access(_)` events, filters all event paths against `is_ignored_watch_path`, emits every surviving path from multi-path notify events, and drains queued `notify_rx.try_recv()` events via `merge_watch_change` before scheduling a single debounced refresh.
- **Custom protocols**: `local-file` (`tauri/src/local_file.rs`) serves workspace/imported-font files with HTTP `Range` (`206`) and a `256 MiB` unranged cap; `youtube-proxy` (`tauri/src/youtube.rs`) proxies `www.youtube.com` / `www.youtube-nocookie.com` embeds with `Referer`.
- **Windows NSIS installer & uninstaller (`tauri/windows/explorer-hooks.nsh`)**: Provides an opt-in install options page (Start menu shortcut and `.md`/`.mdx`/folder Explorer context menus checked by default; desktop shortcut unchecked) and `NSIS_HOOK_POSTUNINSTALL` + `un.RemoveTempEntries` for opt-in `$APPDATA`/`$LOCALAPPDATA` (`com.the-long-ride.markdown-explorer*`) and `%TEMP%` wildcard cleanup when `$DeleteAppDataCheckboxState = 1` and `$UpdateMode <> 1`. Application icons live in `tauri/icons/icon.{icns,ico,png}`, and `bundle.windows.nsis.installerIcon` points to the same `icons/icon.ico` so the Windows installer itself carries the Markdown Explorer logo.

## Workflow

1. `tauri/src/main.rs` -> `markdown_explorer_tauri_lib::run()` -> `core::bootstrap::boot()`.
2. `setup` mounts `Dispatcher::mount` on `'webview-message'`, injects `electron_api_shim_js()`, and creates `"main"`.
3. UI posts `ready` -> `dispatcher/ready.rs` deduplicates by `readyId`, emits `readyAck`, restores update state, and flushes `externalOpenRequest`.
4. Subsequent `webview-message` events execute asynchronously in `Dispatcher::handle`, offload blocking disk/conversion/index work via `tauri::async_runtime::spawn_blocking`, and reply via `host_message::emit` (`window.eval`).

## Code map

- `tauri/src/main.rs`, `tauri/src/lib.rs`, `tauri/src/core/bootstrap.rs`, `tauri/src/app_state.rs`, `tauri/src/host_message.rs` — entrypoint, plugin/window setup, shared `AppState` (`ready_handled`, `last_ready_id`), scoped host message emitter.
- `tauri/src/preload/api.rs` — `window.electronAPI` shim, drag-drop, fullscreen drag lock, `local-file://` media rewriter, non-blocking reload prevention.
- `tauri/src/dispatcher/{handlers,commands_workspace,commands_external,commands_window_update,content_handlers,document_write,git_history,git_repository,git_runner,incremental_scan,navigation,ready,refresh,search,settings,workspace_entries,workspace_entry_paths}.rs` — command handlers, `spawn_blocking` content/scan/search dispatch, and security guards.
- `tauri/src/{local_file,youtube,fonts,debug_tools,perf,error}.rs` — protocols, OpenType parser, debug/perf helpers.
- `tauri/src/workspace/*`, `tauri/src/search/*`, `tauri/src/insights/*`, `tauri/src/render/*`, `tauri/src/runtime/*`, `tauri/src/update/*` — scanning, coalesced non-access filesystem watching (`watch.rs`), bounded-LRU Unicode search (`search/index.rs`), bounded-LRU pure-Rust document conversion (`render/document_converter.rs`), HTML preview/PNG export, signed updater.
- `tauri/capabilities/default.json`, `tauri/scripts/run-with-global-cache.mjs`, `tauri/windows/explorer-hooks.nsh`, `tauri/icons/icon.{icns,ico,png}` — Tauri capabilities, cached Cargo build wrapper, Windows NSIS installer/uninstaller hooks, and app icons.

## Interfaces and data

- IPC contract: `webview-message` event -> `Dispatcher::handle`; host replies via `window.__markdownExplorerHandleHostMessage(<json>)` with `workspaceOperationId` and `workspaceTabId` scoping.
- Persistent storage: `<app_config_dir>/recent-workspaces.json` (up to 100 entries) and `<app_config_dir>/pending-update.json`.

## Verification

- `pnpm run test:tauri` (`cargo test --manifest-path tauri/Cargo.toml -- --test-threads=1`) runs inline `#[cfg(test)]` suites across dispatcher, preload (`test_electron_api_shim_js_contains_reload_prevention`), runtime, update, workspace (`collect_watch_event_paths_ignores_access_and_filters_ignored_paths`), search (`search_cache_evicts_oldest_when_exceeding_max_entries`), insights, render (`converter_cache_evicts_oldest_when_exceeding_max_entries`), and `tauri/tests/parity_smoke.rs`.
- `tests/contracts/tauri-host-message-parity.test.ts`, `tests/contracts/windows-explorer-installer.test.ts`, `tests/node/large-workspace-performance-contract.test.mjs`, `tests/node/tauri-native-document-converter.test.mjs`, `tests/node/tauri-updater-contract.test.mjs`, `tests/node/tauri-bundle-icons.test.mjs`, and `tests/node/rustls-security.test.mjs` (`rustls` GHSA-2mjx-qc3c-rqvc lockfile guard).

## Related documentation

- [UI State, Contexts, and Platform Runtimes](ui-state-and-runtimes.md)
- [Electron Desktop Runtime Architecture](runtime-electron.md)
- [Build, Versioning, and Verification](../workflows/build-and-verification.md)

## Known limitations and open questions

- `tauri/vendor/**` (122 third-party vendored files) is excluded from first-party coverage inventory.
- Individual converter modules under `tauri/src/render/native_document_converter/` were verified via `mod.rs` dispatch rather than line-by-line inspection.
