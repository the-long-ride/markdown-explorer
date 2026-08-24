---
timestamp: '2026-08-01T22:54:00+07:00'
name: VS Code Extension Runtime
topic: Extension activation, commands, panel, workspace services, editor integration, and packaging
document_type: runtime
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- vscode/src/extension.ts
- vscode/src/core/panel.ts
- vscode/src/core/panelNavigation.ts
- vscode/src/core/panelNavigationHandler.ts
- vscode/src/core/panelSearch.ts
- vscode/src/core/panelSearchPreview.ts
- vscode/src/core/panelShell.ts
- vscode/src/core/panelWatch.ts
- vscode/src/core/panelWorkspaceResources.ts
- vscode/src/core/incrementalScan.ts
- vscode/src/core/documentConversion.ts
- vscode/package.json
test_scope:
- tests/unit/vscode/extension.test.ts
- tests/unit/vscode/panel.test.ts
- tests/unit/vscode/panelWatch.test.ts
- tests/unit/vscode/documentConversion.test.ts
- tests/unit/build/vscode-runtime-scripts.test.ts
runtime_scope:
- vs
keywords:
- runtime
- host
- parity
---

# VS Code Extension Runtime

## Activation and commands

Activation uses `onStartupFinished`. Active commands:

| Command | Behavior |
|---|---|
| `markdownExplorer.open` | Open/toggle primary panel |
| `markdownExplorer.openFile` | Select/open one document |
| `markdownExplorer.openFolder` | Select/open a folder workspace |
| `markdownExplorer.toggle` | Toggle viewer visibility |
| `markdownExplorer.refresh` | Refresh active workspace/content |

Explorer/editor menus and keybindings invoke these commands through extension APIs.

## Panel architecture

`panel.ts` coordinates the webview, while focused modules handle navigation, shell actions, search, media, watching, workspace resources, and incremental scans. The host uses VS Code URI/filesystem APIs and sends the common typed messages to the shared UI.

## Editor integration

- `openInEditor` reveals source in VS Code.
- Shell/location behavior uses editor/OS APIs where available.
- Workspace watchers update file lists and current content.
- HTML standalone preview uses an extension-host server/document builder.
- Document conversion is opt-in through extension configuration and shared settings.

### More → Edit parity

For an active Markdown/MDX source file, VS Code renders a dedicated icon-only **Edit** button immediately left of More actions and sends `openInEditor`. Its default shortcut is `Ctrl+Alt+E`, and the tooltip is rendered in a viewport-level portal so host-shell overflow cannot clip the text or keycaps. The extension reveals that source in a normal VS Code editor. Welcome/no-file state keeps the action disabled.

The shared updater may check release metadata and report that a newer Markdown Explorer version exists, but the VS Code variant does not offer app-owned download/install controls. VS Code's extension update mechanism owns installation.

Markdown Explorer Typography is available in the VS Code runtime. The extension host enumerates installed OS fonts, accepts imported `.ttf`/`.otf` files into extension global storage, and exposes managed files to the webview through `asWebviewUri` plus an explicit font CSP/resource root. These choices affect Markdown Explorer only; the user’s VS Code editor font settings are never modified. VS Code owns zooming and extension installation, so Markdown Explorer does not expose app-owned zoom/reset or download/install actions there.

## Configuration

Configuration covers theme, theme style, auto refresh, document conversion, exclude rules, and default expansion. Runtime values must normalize before reaching shared state.

## Packaging

The extension compiles shared/copied UI assets and packages according to `vscode/package.json`; version synchronization is handled by root scripts/workflows.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `vscode/src/extension.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panel.ts` | Active behavior or contract |
| Implementation | `vscode/src/fonts/fontService.ts` | System-font discovery and managed font import for the webview |
| Implementation | `vscode/src/fonts/panelFontBridge.ts` | Webview font list/import/remove message bridge and managed-resource URL mapping |
| Implementation | `vscode/src/core/panelNavigation.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelNavigationHandler.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelSearch.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelSearchPreview.ts` | Search document preview routing |
| Implementation | `vscode/src/core/panelShell.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelExportResources.ts` | Export binary resource reading bridge |
| Implementation | `vscode/src/core/panelExportSave.ts` | Export file saving bridge via VS Code save dialog |
| Implementation | `vscode/src/core/panelWatch.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelWorkspaceResources.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/incrementalScan.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/documentConversion.ts` | Active behavior or contract |
| Implementation | `vscode/package.json` | Active behavior or contract |
| Verification | `tests/unit/vscode/extension.test.ts` | Automated expectation |
| Verification | `tests/unit/vscode/panel.test.ts` | Automated expectation |
| Verification | `tests/unit/vscode/panel-export-resources.test.ts` | Export resource bridge tests |
| Verification | `tests/unit/vscode/panel-export-save.test.ts` | Export save bridge tests |
| Verification | `tests/node/vscode-font-service.test.mjs` | Managed VS Code font import/list/remove behavior |
| Verification | `tests/node/focus-fonts-zoom-settings-followup-contract.test.mjs` | Runtime gating, resource bridge, Settings, focus, and zoom contracts |
| Verification | `tests/unit/vscode/panelWatch.test.ts` | Automated expectation |
| Verification | `tests/unit/vscode/documentConversion.test.ts` | Automated expectation |

---

[← Tauri Desktop Runtime](02-tauri-desktop.md) · [Documentation index](../README.md) · [Chromium Extension Runtime →](04-chromium-extension.md)
