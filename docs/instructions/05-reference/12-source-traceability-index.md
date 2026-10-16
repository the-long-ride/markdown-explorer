---
timestamp: '2026-10-07T00:00:00+07:00'
name: Source Traceability Index
topic: Active implementation ownership by product domain
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../06-quality/07-release-acceptance-matrix.md
source_scope:
- ui/src/main.tsx
- electron/core/main-runtime.js
- tauri/src/lib.rs
- vscode/src/extension.ts
- chromium-xtension/src/chrome-host.ts
- website-app/src/web-host.ts
- package.json
test_scope:
- tests/contracts/dead-code-removal.test.ts
- tests/contracts/host-message-parity.test.ts
- tests/manifest/coverage-manifest.test.ts
runtime_scope:
- shared
keywords:
- traceability
- source
---

# Source Traceability Index

| Domain | Shared UI | Electron | Tauri | VS Code | Chromium/Website |
|---|---|---|---|---|---|
| Entry/bridge | `ui/src/main.tsx`, `ui/src/platform/*` | preload/main runtime | preload/core bootstrap | panel/extension | chrome/web host |
| Workspace | components/desktop contexts | workspace scanner/watch/recents | workspace modules | scanner/incremental/watch | file access/scanner/file mode |
| File operations and empty folders | `ui/src/workspace/*`, Sidebar file-ops hooks/components | `workspace/workspace-entries.js`, `workspace/scanner.js` | `dispatcher/workspace_entries.rs`, `workspace/scanner.rs` | `panelWorkspaceEntries.ts`, `emptyDirectories.ts` | `workspace-entries.ts`, `scanner.ts` |
| Rendering | `ui/src/markdown/*`, Content | source/converter handlers | render/converter | `vscode/src/markdown/*` | host renderer paths |
| Search | Search components/effects | search index/worker | search modules | panel search | search index/test search |
| Bookmarks | `ui/src/bookmarks/*`, `markdown/sourceMapping.ts`, Bookmark components/navigation/jump | shared UI Tabs | shared UI Tabs | shared UI Focus mode | shared UI Focus mode |
| Export Center | `ui/src/export/*`, `ui/src/components/Export/*` | `runtime-export-resources.js`, `runtime-export-save.js` | `export_resources.rs`, native dialog save | `panelExportResources.ts`, `panelExportSave.ts` | `chrome-host-export.ts`, file-access / blob download |
| Scope View | `ui/src/components/Modal/ScopeViewModal.tsx`, `scopeHistory.ts`, `useScopeNavigationState.ts` | shared UI modal | shared UI modal | shared UI modal | shared UI modal |
| Navigation & Hardware | `ui/src/utils/mouseHistoryNavigation.ts`, `ui/src/hooks/useKeyboard.ts` | native menu / external open | dispatcher external open | webview navigation | chrome-host navigation |
| User manual | Welcome/UserManual components and `userManualTranslations.ts` | shared UI | shared UI | shared UI | shared UI |
| HTML/resources | HTML preview modules | preview server/resource handler | local file/HTML preview | preview server/resources | in-page sandbox |
| Settings/themes | Settings, contexts, theme, `DesktopTypographySettings`, `AvailableUpdateDialog`, `TooltipButton` | bridge persistence/update | preload/dispatcher settings/update | webview state/config; VS Code-owned install | chrome/web state |
| Localization | `translations*`, `auditedUiTranslations`, renderer/table copy | generated Markdown/DOM labels | shared renderer events | webview locale/font UI | chrome/web locale state |
| Desktop lifecycle | Desktop components | window/update/startup | window/update/bootstrap | host-owned | not applicable |
| Delivery | root scripts/docs | package/installer | Cargo/Tauri configs | extension package | extension/website builds |

## Sidebar file operations source-to-test map

| Source | Tests |
|---|---|
| `ui/src/workspace/workspaceEntryName.ts` | `tests/unit/ui/workspace/workspace-entry-name.test.ts` |
| `ui/src/workspace/workspaceEntryCapability.ts` | `tests/unit/ui/workspace/workspace-entry-capability.test.ts` |
| `ui/src/workspace/workspaceEntriesClient.ts` | `tests/unit/ui/workspace/workspace-entries-client.test.ts` |
| `ui/src/workspace/workspaceEntryPaths.ts` | `tests/unit/ui/workspace/workspace-entry-paths.test.ts` |
| `ui/src/workspace/workspaceEntryMessages.ts` | `tests/unit/ui/workspace/workspace-entry-messages.test.ts` |
| `ui/src/components/Sidebar/sidebarTreeContext.ts`, `SidebarTreeCheckboxes.tsx` | `tests/unit/ui/components/sidebar-tree-entry-context.test.tsx` |
| `ui/src/components/Sidebar/sidebarEntryIcons.tsx` | `tests/unit/ui/components/sidebar-file-ops.test.tsx`, `sidebar-item-menu-create.test.tsx` |
| `ui/src/components/Sidebar/SidebarInlineEntryInput.tsx` | `tests/unit/ui/components/sidebar-inline-entry-input.test.tsx` |
| `ui/src/components/Sidebar/useSidebarSelectionMode.ts` | `tests/unit/ui/components/sidebar-selection-mode.test.tsx` |
| `ui/src/components/Sidebar/useSidebarEntryCreation.ts` | `tests/unit/ui/components/sidebar-entry-creation.test.tsx` |
| `ui/src/components/Sidebar/useSidebarEntryDeletion.ts` | `tests/unit/ui/components/sidebar-entry-deletion.test.tsx` |
| `ui/src/components/Sidebar/SidebarSelectionActions.tsx` | `tests/unit/ui/components/sidebar-selection-actions.test.tsx` |
| `ui/src/components/Sidebar/useSidebarFileOps.tsx` | `tests/unit/ui/components/sidebar-file-ops.test.tsx` |
| `ui/src/components/Sidebar/SidebarConfirmDialog.tsx` | `tests/unit/ui/components/sidebar-confirm-dialog.test.tsx`, `sidebar-clear-pins-confirm.test.tsx` |
| `electron/workspace/workspace-entry-name.js`, `workspace-entries.js` | `tests/unit/electron/workspace-entries.test.ts` |
| `electron/workspace/scanner.js` (empty folders) | `tests/unit/electron/scanner-empty-dirs.test.ts` |
| `vscode/src/core/emptyDirectories.ts`, `scanner.ts`, `incrementalScan.ts` | `tests/unit/vscode/scanner-empty-dirs.test.ts` |
| `vscode/src/core/workspaceEntryName.ts`, `panelWorkspaceEntries.ts` | `tests/unit/vscode/panel-workspace-entries.test.ts`, `panel-workspace-entries-wiring.test.ts` |
| `chromium-xtension/src/workspace-entries.ts` | `tests/unit/chromium/workspace-entries.test.ts`, `web-file-workspace-entries.test.ts`, `chrome-host-workspace-entries.test.ts`, `web-host-workspace-entries.test.ts` |
| `chromium-xtension/src/scanner.ts` (empty folders) | `tests/unit/chromium/scanner-empty-dirs.test.ts` |
| `tauri/src/dispatcher/workspace_entries.rs`, `tauri/src/workspace/scanner.rs`, `tree_builder.rs` | Rust unit tests via `cargo test --manifest-path tauri/Cargo.toml` (not in the TypeScript coverage manifest) |

## Agent lookup procedure

1. Start with use-case ID.
2. Read its source/test scope.
3. Follow to matching feature specification.
4. Check exact command/message/settings references.
5. Inspect runtime spec before changing host behavior.
6. Update acceptance matrix and documentation when behavior changes.

## v1.7.1 follow-up sources

| Source | Behavior | Verification |
|---|---|---|
| `website-app/src/demo-entry-store.ts`, `web-demo-entry-router.ts` | localStorage-only simulated entry operations | `tests/unit/chromium/demo-entry-store.test.ts`, `web-demo-workspace-entries.test.ts` |
| `vscode/src/core/panelVscodeApi.ts`, `panel.ts`, `panelWatch.ts` | lazy VS Code API access and workspace identity propagation | VS Code panel/watch tests |
| `vscode/src/core/panelGitHistory.ts` | ordinary-folder not-repository classification | VS Code Git history tests and compiled-runtime smoke |
| `tauri/src/dispatcher/workspace_entry_paths.rs` | shared name/path guards and exclusive copy helper | Tauri workspace entry tests |
| `ui/src/workspace/workspaceEntryPaths.ts` | pure prefix remapping usable from Node-compatible bookmark storage | Node bookmark tests and UI rename-state tests |

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/main.tsx` | Active behavior or contract |
| Implementation | `electron/core/main-runtime.js` | Active behavior or contract |
| Implementation | `tauri/src/lib.rs` | Active behavior or contract |
| Implementation | `vscode/src/extension.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/chrome-host.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-host.ts` | Active behavior or contract |
| Implementation | `package.json` | Active behavior or contract |
| Verification | `tests/contracts/dead-code-removal.test.ts` | Automated expectation |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/manifest/coverage-manifest.test.ts` | Automated expectation |

---

[← Core Data Models](11-core-data-models.md) · [Documentation index](../README.md) · [Test Strategy →](../06-quality/01-test-strategy.md)
