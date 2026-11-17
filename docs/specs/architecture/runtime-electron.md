---
schema_version: 1
id: "architecture.runtime-electron"
title: "Electron Desktop Runtime Architecture"
kind: "architecture"
status: "verified"
summary: "Electron 43.8.6 desktop host architecture: startup/single-instance, frameless window & security containment, preload IPC bridge, workspace/search/git/insights handlers, and Windows in-app updater."
tags: ["architecture", "electron", "desktop", "ipc", "updater"]
source_paths: ["electron/build/installer.nsh", "electron/core/external-open.js", "electron/core/html-preview-server.js", "electron/core/ipc-handlers.js", "electron/core/main-bootstrap.js", "electron/core/main-runtime.js", "electron/core/native-close-guard.js", "electron/core/runtime-command-handlers.js", "electron/core/runtime-command-search-handlers.js", "electron/core/runtime-export-resources.js", "electron/core/runtime-export-save.js", "electron/core/runtime-insights-external.js", "electron/core/runtime-insights.js", "electron/core/runtime-update-handlers.js", "electron/core/runtime-utils.js", "electron/core/runtime-workspace-handlers.js", "electron/core/runtime-workspace-resources.js", "electron/core/runtime-workspace-search.js", "electron/core/startup-workspace.js", "electron/fonts/font-service.js", "electron/git/document-history.js", "electron/git/git-history-handlers.js", "electron/git/git-runner.js", "electron/main.js", "electron/perf/perf-timer.js", "electron/preload/preload.js", "electron/render/document-converter.js", "electron/search/search-index.js", "electron/search/search-worker-controller.js", "electron/search/search-worker.js", "electron/search/unicode-search.js", "electron/update/update-helper.js", "electron/update/update-manager.js", "electron/update/update-state.js", "electron/window/debug-tools.js", "electron/window/window.js", "electron/workspace/document-write.js", "electron/workspace/incremental-publish.js", "electron/workspace/recents.js", "electron/workspace/scanner.js", "electron/workspace/workspace-entries.js", "electron/workspace/workspace-entry-name.js", "electron/workspace/workspace-refresh.js", "electron/workspace/workspace-watch.js", "electron/youtube/youtube-headers.js"]
related_specs: ["architecture.ui-state-and-runtimes", "architecture.runtime-tauri", "workflow.build-and-verification"]
last_doc_update_at: "2026-11-16T06:20:00Z"
last_verified_at: "2026-11-16T06:20:00Z"
last_verified_code_commit: "67cbd21d100886bc1a8458636c968092ff30d72f"
last_source_change_commit: "4f38b2dbe45fbc969157f60247d6fbd1d1b32734"
last_source_change_at: "2026-11-12T17:46:34+07:00"
source_fingerprint: "sha256:47d5f3c0cec1c4ccf49f350327464b262ed98111b129aa7e12387527b4f350a0"
---

# Electron Desktop Runtime Architecture

## Purpose and boundaries

Defines the Electron `43.8.6` desktop host (`electron/`), which packages `ui/dist` and `ui/assets/logos` in an `asar` archive and exposes `window.electronAPI` via `contextBridge`.

- **In scope**: `electron/**` (44 first-party JS files across `core/`, `window/`, `preload/`, `workspace/`, `search/`, `git/`, `render/`, `fonts/`, `update/`, `perf/`, `youtube/`, plus `electron/build/installer.nsh`).
- **Out of scope**: Shared React UI (`architecture.ui-state-and-runtimes`) and CI/release workflows (`workflow.build-and-verification`).

## Observable behavior

- **Startup & single-instance (`electron/main.js`, `electron/core/main-bootstrap.js`)**: Sets `V8_COMPILE_CACHE_CACHE_DIR` to `<tmpdir>/markdown-explorer-v8-cache` (when unset) before loading `v8-compile-cache`, disables hardware acceleration on `win32`, enforces `app.requestSingleInstanceLock()` (forwarding secondary CLI paths via `externalOpenQueue`), warms up GPU with a 1x1 hidden `BrowserWindow`, installs macOS native menus (`null` on Windows/Linux), and defers IPC/updater setup via `setImmediate`.
- **Window & security (`electron/window/window.js`, `debug-tools.js`, `youtube/youtube-headers.js`)**: Creates a frameless `BrowserWindow` (`1200x700`, min `800x480`, `contextIsolation: true`, `nodeIntegration: false`), blocks `will-navigate` and `setWindowOpenHandler` (opening `http(s)://` externally), injects YouTube `Referer` headers, and gates DevTools shortcuts behind `isDebugMode()`.
- **Preload & IPC (`electron/preload/preload.js`, `electron/core/ipc-handlers.js`)**: Exposes `postMessage`, fan-out `onMessage`, and `getPathForFile`; routes lifecycle, workspace CRUD/save, cross-tab `worker_threads` search, Git history (`execFile`, 20s timeout, 16 MiB cap), Insights & SSRF-pinned external link checks, HTML preview server, fonts, exports, native close guard (`native-close-guard.js`), and Windows detached `.cmd` updater (`update-manager.js`).
- **Windows NSIS installer & uninstaller (`electron/build/installer.nsh`)**: Configures opt-in desktop/Start menu shortcuts and Explorer context menus on install, and adds `customUnWelcomePage` / `un.MarkdownExplorerUninstallOptions` (plus `--delete-app-data` via `customUnInit`) and `un.RemoveTempEntries` in `customUnInstall` to remove `$APPDATA`, `$LOCALAPPDATA`, updater directories, and `$TEMP` entries when not updating (`${ifNot} ${isUpdated}`).

## Workflow

1. `electron/main.js` acquires single-instance lock and runs `createAppBootstrap`.
2. `app.whenReady` warms GPU, creates main window (`preload.js`), and registers `ipc-handlers.js`.
3. Renderer sends `ready` -> `startup-workspace.js` emits `readyAck` immediately and defers workspace scan/watch (`setTimeout(..., 0)`).
4. `before-quit` consults `native-close-guard.js`, disposes background hosts/servers, and applies pending updates on quit.

## Code map

- `electron/main.js`, `electron/build/installer.nsh`, `electron/core/{main-bootstrap,main-runtime,ipc-handlers,startup-workspace,external-open,native-close-guard,html-preview-server}.js` — process lifecycle, NSIS installer/uninstaller hooks, IPC routing, close guard, preview server.
- `electron/core/{runtime-command-handlers,runtime-command-search-handlers,runtime-workspace-handlers,runtime-workspace-resources,runtime-workspace-search,runtime-insights,runtime-insights-external,runtime-export-resources,runtime-export-save,runtime-update-handlers,runtime-utils}.js` — feature runtime handlers.
- `electron/preload/preload.js`, `electron/window/{window,debug-tools}.js`, `electron/perf/perf-timer.js`, `electron/youtube/youtube-headers.js` — preload bridge, window containment, perf, YouTube headers.
- `electron/workspace/{scanner,incremental-publish,workspace-watch,workspace-refresh,recents,workspace-entries,workspace-entry-name,document-write}.js` — FS scanning, watching, recents, atomic saves.
- `electron/search/{search-index,unicode-search,search-worker-controller,search-worker}.js`, `electron/git/{git-runner,document-history,git-history-handlers}.js`, `electron/render/document-converter.js`, `electron/fonts/font-service.js`, `electron/update/{update-manager,update-state,update-helper}.js`.

## Interfaces and data

- `window.electronAPI`: `{ isDebug, postMessage(msg), onMessage(cb), getPathForFile(file) }`.
- Persistent files: `<userData>/recent-workspaces.json` (max 100), `<userData>/updates/pending-update.json`.

## Verification

- `pnpm run test:electron` (`tests/unit/electron/*.test.ts`, 38 test files covering bootstrap, IPC, runtime, scanner, watcher, document write, Git history, search worker, Insights SSRF guard, close guard, and updater).
- `tests/contracts/host-message-parity.test.ts` and `tests/contracts/windows-explorer-installer.test.ts` (`installer.nsh` and `markdown-explorer-v8-cache`).

## Related documentation

- [UI State, Contexts, and Platform Runtimes](ui-state-and-runtimes.md)
- [Tauri Desktop Runtime Architecture](runtime-tauri.md)
- [Build, Versioning, and Verification](../workflows/build-and-verification.md)

## Known limitations and open questions

- `isSupportedFilePathLite` includes `.markdown`, whereas `documentConverter.readMarkdown` (`MARKDOWN_EXTENSIONS`) only handles `.md` and `.mdx`.
- `electron/git/git-runner.js` and `git-history-handlers.js` are exercised via `document-history.test.ts` rather than dedicated standalone test files.
