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

## Configuration

Configuration covers theme, theme style, auto refresh, document conversion, exclude rules, and default expansion. Runtime values must normalize before reaching shared state.

## Packaging

The extension compiles shared/copied UI assets and packages according to `vscode/package.json`; version synchronization is handled by root scripts/workflows.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `vscode/src/extension.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panel.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelNavigation.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelNavigationHandler.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelSearch.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelSearchPreview.ts` | Search document preview routing |
| Implementation | `vscode/src/core/panelShell.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelWatch.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/panelWorkspaceResources.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/incrementalScan.ts` | Active behavior or contract |
| Implementation | `vscode/src/core/documentConversion.ts` | Active behavior or contract |
| Implementation | `vscode/package.json` | Active behavior or contract |
| Verification | `tests/unit/vscode/extension.test.ts` | Automated expectation |
| Verification | `tests/unit/vscode/panel.test.ts` | Automated expectation |
| Verification | `tests/unit/vscode/panelWatch.test.ts` | Automated expectation |
| Verification | `tests/unit/vscode/documentConversion.test.ts` | Automated expectation |
| Verification | `tests/unit/build/vscode-runtime-scripts.test.ts` | Automated expectation |

---

[← Tauri Desktop Runtime](02-tauri-desktop.md) · [Documentation index](../README.md) · [Chromium Extension Runtime →](04-chromium-extension.md)
