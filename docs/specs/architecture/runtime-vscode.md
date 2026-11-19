---
schema_version: 1
id: "architecture.runtime-vscode"
title: "VS Code Extension Runtime Architecture"
kind: "architecture"
status: "verified"
summary: "VS Code extension host architecture: esbuild packaging, commands, file watchers, CSP-hardened webview bridge, scanner/search/Git/fonts/conversion, and pruned insights modules."
tags: ["architecture", "vscode", "extension", "webview", "markdown"]
source_paths: ["vscode/package.json", "vscode/scripts/bundle-extension.js", "vscode/scripts/bundle-markdown-them.js", "vscode/scripts/copy-ui.js", "vscode/scripts/verify-package-runtime.js", "vscode/src/constants/workspace.ts", "vscode/src/core/documentConversion.ts", "vscode/src/core/emptyDirectories.ts", "vscode/src/core/htmlPreviewServer.ts", "vscode/src/core/incrementalPublish.ts", "vscode/src/core/incrementalScan.ts", "vscode/src/core/panel.ts", "vscode/src/core/panelDocumentWrite.ts", "vscode/src/core/panelExportResources.ts", "vscode/src/core/panelExportSave.ts", "vscode/src/core/panelGitHistory.ts", "vscode/src/core/panelInsights.ts", "vscode/src/core/panelInsightsExternal.ts", "vscode/src/core/panelMedia.ts", "vscode/src/core/panelMessages.ts", "vscode/src/core/panelNavigation.ts", "vscode/src/core/panelNavigationHandler.ts", "vscode/src/core/panelSearch.ts", "vscode/src/core/panelSearchPreview.ts", "vscode/src/core/panelShell.ts", "vscode/src/core/panelVscodeApi.ts", "vscode/src/core/panelWatch.ts", "vscode/src/core/panelWorkspaceEntries.ts", "vscode/src/core/panelWorkspaceResources.ts", "vscode/src/core/panelWorkspaceSearch.ts", "vscode/src/core/scanner.ts", "vscode/src/core/unicodeSearch.ts", "vscode/src/core/workspaceEntryName.ts", "vscode/src/extension.ts", "vscode/src/fonts/fontService.ts", "vscode/src/fonts/panelFontBridge.ts", "vscode/src/markdown/codeRenderer.ts", "vscode/src/markdown/delimitedText.ts", "vscode/src/markdown/highlighter.ts", "vscode/src/markdown/htmlPreviewDocument.ts", "vscode/src/markdown/inline.ts", "vscode/src/markdown/parser.ts", "vscode/src/markdown/renderer.ts", "vscode/src/markdown/tableRenderer.ts", "vscode/src/types.ts", "vscode/src/utils.ts"]
related_specs: ["architecture.ui-state-and-runtimes", "feature.markdown-rendering-and-tables", "workflow.build-and-verification"]
last_doc_update_at: "2026-11-16T06:20:00Z"
last_verified_at: "2026-11-16T09:05:00Z"
last_verified_code_commit: "67cbd21d100886bc1a8458636c968092ff30d72f"
last_source_change_commit: "fd0bc52affe4b6d883bf37c3b6c533f038706c0c"
last_source_change_at: "2026-11-13T02:59:34+07:00"
source_fingerprint: "sha256:c0421359013fef2e6c614c00e2ca686cb323daec76c9e6a193c26abaf1160601"
---

# VS Code Extension Runtime Architecture

## Purpose and boundaries

Defines the VS Code / Open VSX extension runtime (`vscode/`, engine `^1.85.0`), bundling a Node.js extension host (`out/vscode/src/core/extension.bundle.js`) alongside the built React webview UI (`vscode/ui/dist/`).

- **In scope**: `vscode/package.json`, `vscode/src/**`, `vscode/scripts/**` (46 files).
- **Out of scope**: Shared UI (`architecture.ui-state-and-runtimes`) and extension marketplace release CI (`workflow.build-and-verification`).

## Observable behavior

- **Activation & commands (`vscode/src/extension.ts`)**: Activates on `onStartupFinished` and commands `markdownExplorer.{open,openFile,openFolder,toggle,refresh,reloadWebview,saveCurrentDocument}`; watches saves and workspace globs (`**/*.{md,mdx,...}`) via `panelWatch.ts`.
- **Webview, CSP & appearance (`vscode/src/core/panel.ts`, `panelShell.ts`, `panelMessages.ts`)**: Manages singleton `MarkdownDocsPanel` (`retainContextWhenHidden: true`, strict CSP with `default-src 'none'`, `frame-src 'self' data: ${cspSource} https://www.youtube.com https://www.youtube-nocookie.com`). Hydrates/persists UI state via `context.globalState` (`stateHydrated` handshake) and normalizes `markdownExplorer.themeStyle` via `normalizeVscodeThemeStyle` across the 9 active styles (`raw-grid`, `default`, `bento`, `vercel`, `tokyo-night`, `neon-voltage`, `cyberpunk`, `pet-white-shiba`, `pet-k-ink`, mapping legacy aliases).
- **Scanning, CRUD & conversion**: `WorkspaceScanner` (`vscode.workspace.findFiles` + unsaved `textDocuments` + `listEmptyDirectories` + `incrementalScan.ts`), `panelDocumentWrite` (optimistic `mtime:size` saves), `panelWorkspaceEntries` (`useTrash`), `DocumentConverter` (`@the-long-ride/markdown-them`), `panelSearch` (`unicodeSearch.ts`), `panelGitHistory` (`execFile`, 20s timeout), `fontService`, and `htmlPreviewServer`.
- **Shared Markdown renderer (`vscode/src/markdown/*`)**: Re-exports `ui/src/markdown/{parser,renderer,highlighter}` and mirrors `inline.ts`, `codeRenderer.ts`, `tableRenderer.ts` (including `inferIntelligentColumnAlignment`, `.mdn-sort-icon`, and `.mdn-table-align-btn` controls).
- **Non-shipped insights**: `panelInsights.ts` and `panelInsightsExternal.ts` are unit-tested but unwired from `MarkdownDocsPanel` and pruned by `vscode/scripts/copy-ui.js`.
- **Marketplace metadata & README**: `vscode/package.json` configures the extension icon (`ui/assets/logos/logo-500.png`), Explorer SVG icons (`ui/assets/icons/markdown-explorer-{dark,light}-stroke.svg`), and updated Marketplace description; `vscode/README.md` is synchronized from root `README.md` by `scripts/sync-readme.mjs`.

## Workflow

1. `vscode/scripts/bundle-markdown-them.js` + `bundle-extension.js` + `copy-ui.js` + `verify-package-runtime.js` produce the `.vsix` runtime.
2. Activation registers commands/watchers; opening panel builds CSP shell and waits for `ready` -> `restorePersistedState` -> `readyAck`.
3. `MarkdownDocsPanel` dispatches `fontBridge` (including Git/export), `panelWorkspaceEntries`, `saveDocument`, and core panel switch commands.

## Code map

- `vscode/package.json`, `vscode/src/extension.ts`, `vscode/src/types.ts`, `vscode/src/utils.ts`, `vscode/src/constants/workspace.ts` — manifest, activation, commands, types, utilities.
- `vscode/src/core/{panel,panelShell,panelMessages,panelVscodeApi,panelWatch,scanner,incrementalScan,incrementalPublish,emptyDirectories}.ts` — panel lifecycle, CSP shell, workspace scanning & watching.
- `vscode/src/core/{panelDocumentWrite,panelWorkspaceEntries,workspaceEntryName,panelWorkspaceResources,panelNavigation,panelNavigationHandler,panelMedia,panelSearch,panelSearchPreview,panelWorkspaceSearch,unicodeSearch,panelGitHistory,htmlPreviewServer,documentConversion,panelExportResources,panelExportSave,panelInsights,panelInsightsExternal}.ts` — file ops, search, Git, conversion, export.
- `vscode/src/fonts/{fontService,panelFontBridge}.ts`, `vscode/src/markdown/*`, `vscode/scripts/*` — font service, markdown parity modules, build scripts.

## Interfaces and data

- Extension settings: `markdownExplorer.{theme,themeStyle,autoRefresh,documentConversion,excludePatterns,defaultExpanded}`.
- Global state key: `markdownExplorer.uiState`.

## Verification

- `pnpm run test:vscode` (`tests/unit/vscode/*.test.ts`), `tests/contracts/markdown-parity.test.ts`, `tests/contracts/host-message-parity.test.ts`, `tests/contracts/package-config.test.ts`, `tests/contracts/readme-sync.test.ts`, and `vscode/scripts/verify-package-runtime.js`.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](ui-state-and-runtimes.md)
- [Markdown Rendering, Sandboxes, and Interactive Data Tables](../features/markdown-rendering-and-tables.md)
- [Build, Versioning, and Verification](../workflows/build-and-verification.md)

## Known limitations and open questions

- `WebviewMessage` in `vscode/src/types.ts` declares desktop workspace-tab commands (`openFolder`, `openRecentWorkspace`, etc.) that are unused in `MarkdownDocsPanel`.
- `vscode/src/core/panel.ts` calls `handlePanelGitHistoryMessage` after `_fontBridge.handle(msg)`, though `panelFontBridge.ts` already delegates Git history commands.
