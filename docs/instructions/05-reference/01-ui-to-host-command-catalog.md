---
timestamp: '2026-08-20T01:00:00+07:00'
name: UI-to-Host Command Catalog
topic: Exact active `WebviewMessage` command catalog
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../01-architecture/03-bridge-protocol.md
related_docs:
- 02-host-to-ui-message-catalog.md
source_scope:
- ui/src/types/webviewMessages.ts
- ui/src/platform/bridge.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-dispatcher-parity.test.ts
runtime_scope:
- shared
keywords:
- protocol
- commands
---

# UI-to-Host Command Catalog

## Contract count

**45 active commands** are extracted from `ui/src/types/webviewMessages.ts`.

| Command | Interface and payload |
|---|---|
| `activateWorkspace` | `ActivateWorkspaceMessage` — workspaceOperationId?: string, workspaceTabId?: string, workspacePath: string, filePath?: string, openFirstFile?: boolean |
| `cancelAllWorkspaceScans` | `CancelAllWorkspaceScansMessage` — No payload |
| `cancelWorkspaceScan` | `CancelWorkspaceScanMessage` — workspaceOperationId: string |
| `closeWorkspace` | `CloseWorkspaceMessage` — workspaceOperationId?: string, workspaceTabId?: string |
| `confirmOpenPath` | `ConfirmOpenPathMessage` — path: string |
| `copyCode` | `CopyCodeMessage` — text: string |
| `deleteRecentWorkspace` | `DeleteRecentWorkspaceMessage` — path: string |
| `downloadUpdate` | `DownloadUpdateMessage` — version: string, url: string |
| `importDesktopFonts` | `ImportDesktopFontsMessage` — requestId: string |
| `indexWorkspaceSearchItems` | `IndexWorkspaceSearchItemsMessage` — items?: readonly CrossTabSearchResult[] |
| `listDesktopFonts` | `ListDesktopFontsMessage` — requestId: string |
| `listWorkspaceExportResources` | `ListWorkspaceExportResourcesMessage` — requestId: string |
| `loadSearchPreview` | `SearchPreviewRequestMessage` — requestId: string, filePath: string, tabId?: string |
| `loadWorkspaceSearchIndexes` | `LoadWorkspaceSearchIndexesMessage` — tabs: readonly { tabId: string; workspacePath: string }[] |
| `navigate` | `NavigateMessage` — path: string |
| `openExternal` | `OpenExternalMessage` — url: string |
| `openFile` | `OpenFileMessage` — workspaceOperationId?: string, workspaceTabId?: string |
| `openFileHandle` | `OpenFileHandleMessage` — workspaceOperationId?: string, workspaceTabId?: string, handle?: any |
| `openFolder` | `OpenFolderMessage` — workspaceOperationId?: string, workspaceTabId?: string, openFirstFile?: boolean, handle?: any, replaceRecentWorkspacePath?: string |
| `openHtmlPreview` | `OpenHtmlPreviewMessage` — documentHtml: string |
| `openInEditor` | `OpenInEditorMessage` — path: string |
| `openPath` | `OpenPathMessage` — workspaceOperationId?: string, workspaceTabId?: string, path: string, openFirstFile?: boolean |
| `openRecentWorkspace` | `OpenRecentWorkspaceMessage` — workspaceOperationId?: string, workspaceTabId?: string, path: string, openFirstFile?: boolean |
| `openShellLocation` | `OpenShellLocationMessage` — path: string, mode: ShellLocationMode |
| `readWorkspaceExportResource` | `ReadWorkspaceExportResourceMessage` — requestId: string, resourcePath: string, documentPath?: string |
| `readWorkspaceTextResource` | `ReadWorkspaceTextResourceMessage` — requestId: string, documentPath: string, resourcePath: string |
| `ready` | `WebviewReadyMessage` — documentConversionEnabled?: boolean |
| `refresh` | `RefreshMessage` — No payload |
| `removeImportedDesktopFont` | `RemoveImportedDesktopFontMessage` — requestId: string, id: string |
| `replaceRecentWorkspaces` | `ReplaceRecentWorkspacesMessage` — recentWorkspaces: readonly RecentWorkspace[] |
| `restartAndApplyUpdate` | `RestartAndApplyUpdateMessage` — No payload |
| `saveChartPng` | `SaveChartPngMessage` — fileName: string, dataUrl: string, requestId?: string |
| `saveExportFile` | `SaveExportFileMessage` — requestId: string, fileName: string, mimeType: string, dataBase64: string |
| `scheduleDownloadedUpdate` | `ScheduleDownloadedUpdateMessage` — No payload |
| `searchAcrossWorkspaces` | `CrossTabSearchMessage` — requestId: string, query: string, matchCase?: boolean, tabIds?: readonly string[], items?: readonly CrossTabSearchResult[] |
| `searchWorkspace` | `WorkspaceSearchMessage` — requestId: string, query: string, matchCase?: boolean, items?: readonly WorkspaceSearchResult[] |
| `setDocumentConversion` | `SetDocumentConversionMessage` — enabled: boolean |
| `toggle-fullscreen` | `ToggleFullscreenMessage` — No payload |
| `updateAppearance` | `UpdateAppearanceMessage` — theme: ThemeMode, themeStyle: ThemeStyle |
| `window-close` | `WindowCloseMessage` — No payload |
| `window-maximize` | `WindowMaximizeMessage` — No payload |
| `window-minimize` | `WindowMinimizeMessage` — No payload |
| `zoom-in` | `ZoomInMessage` — No payload |
| `zoom-out` | `ZoomOutMessage` — No payload |
| `zoom-reset` | `ZoomResetMessage` — No payload |

## Export request rules

- `listWorkspaceExportResources` enumerates host-approved workspace resources for the Additional workspace files selector.
- `readWorkspaceExportResource` reads a bounded binary resource by workspace-relative path; hosts canonicalize the request and reject workspace escapes.
- `saveExportFile` carries generated bytes and a suggested filename. The host chooses the final destination through its normal save capability; the UI cannot supply an arbitrary absolute destination path.
- PDF uses the same `saveExportFile` route as HTML and ZIP outputs. There is no special Electron-only `exportPdf` command or footer protocol.

## Dispatch requirements

- Command names and payload fields are case-sensitive.
- Workspace operations preserve `workspaceOperationId` and `workspaceTabId` when supplied.
- Search/resource/save requests preserve `requestId`.
- Search requests preserve original query casing; `matchCase: true` selects exact-case metadata/content matching.
- A runtime implements only capabilities it exposes; unsupported UI controls remain hidden or disabled.
- Adding/removing a command requires parity review and this catalog update.

## Example

```typescript
window.PlatformBridge.postMessage({
  command: 'saveExportFile',
  requestId: 'export-42',
  fileName: 'docs.zip',
  mimeType: 'application/zip',
  dataBase64: '<generated-bytes>',
});
```

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/webviewMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/platform/bridge.ts` | Active behavior or contract |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-dispatcher-parity.test.ts` | Automated expectation |

---

[← Runtime Parity and Capability Matrix](../04-runtimes/06-runtime-parity.md) · [Documentation index](../README.md) · [Host-to-UI Message Catalog →](02-host-to-ui-message-catalog.md)
