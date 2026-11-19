# Repository Specifications Index

Knowledge map for `markdown-explorer`, covering shared UI state/rendering, platform runtimes (`tauri`, `electron`, `vscode`, `website-app`), and build/verification workflows.

## Architecture

- [UI State, Contexts, and Platform Runtimes](architecture/ui-state-and-runtimes.md) (`architecture.ui-state-and-runtimes`): React UI bootstrap, platform bridge detection, AppState reducer/effects, navigation/history contexts, global keyboard/layout orchestration, and shared UI primitives.
- [UI Theming, CSS Architecture, and Style Contracts](architecture/ui-theming-and-styles.md) (`architecture.ui-theming-and-styles`): Theme modes (auto/dark/light), built-in & pet theme styles, custom theme remixing, View Transitions, modular CSS layers, and static style/LOC contract enforcement.
- [Tauri Desktop Runtime Architecture](architecture/runtime-tauri.md) (`architecture.runtime-tauri`): Tauri v2 Rust host architecture: bootstrap, window/menu setup, Electron-parity preload shim, async command dispatcher, local-file/youtube-proxy protocols, search, conversion, and signed updater.
- [Electron Desktop Runtime Architecture](architecture/runtime-electron.md) (`architecture.runtime-electron`): Electron 43.8.6 desktop host architecture: startup/single-instance, frameless window & security containment, preload IPC bridge, workspace/search/git/insights handlers, and Windows in-app updater.
- [VS Code Extension Runtime Architecture](architecture/runtime-vscode.md) (`architecture.runtime-vscode`): VS Code extension host architecture: esbuild packaging, commands, file watchers, CSP-hardened webview bridge, scanner/search/Git/fonts/conversion, and pruned insights modules.
- [Web App & Static Website Runtime Architecture](architecture/runtime-chromium-and-web-demo.md) (`architecture.runtime-chromium-and-web-demo`): Browser-hosted Web App (`website-app/`, `appRuntime: 'web'`, `window.__webBus`, virtual/local/test workspaces) and Raw Grid static marketing website (`website/`); Manifest V3 Chromium extension retired in v1.7.2.

## Features

- [Workspace Selection, Desktop Tabs, Settings, and Themes](features/workspace-tabs-and-settings.md) (`feature.workspace-tabs-and-settings`): Recent workspace switching, multi-tab desktop session state, settings modal and persistence, theme/accent presets, and embedded mini-games.
- [Sidebar Navigation, File Tree, Search, and Bookmarks](features/sidebar-search-bookmarks.md) (`feature.sidebar-search-bookmarks`): File tree explorer, document heading outline, full-text and fuzzy search, and bookmark management in the primary sidebar.
- [Markdown Rendering, Media Embeds, and Interactive Data Tables](features/markdown-rendering-and-tables.md) (`feature.markdown-rendering-and-tables`): Unified/Remark/Rehype markdown pipeline, code/math/diagram rendering, interactive data tables with alignment, filtering, resizing, and virtualized CSV/TSV previews.
- [Local Editing, Dirty State, and Split View](features/local-editing-and-split-view.md) (`feature.local-editing-and-split-view`): In-app source editing, dirty-buffer tracking and save flows, and synchronized side-by-side editor/preview split view.
- [Git History and Diff Viewer](features/git-history-and-diff.md) (`feature.git-history-and-diff`): Per-file and workspace Git commit history inspection and side-by-side/unified diff rendering.
- [Workspace Insights, Knowledge Graph, and Export](features/workspace-insights-and-export.md) (`feature.workspace-insights-and-export`): Workspace-wide document analytics, link/tag graph insights, and HTML/PDF/Markdown export pipelines.

## Workflows

- [Build, Versioning, and Verification](workflows/build-and-verification.md) (`workflow.build-and-verification`): Monorepo build orchestration, version synchronization, multi-platform packaging scripts, and unit/contract/typecheck verification workflows.
