---
timestamp: '2026-08-20T01:00:00+07:00'
name: Host-to-UI Message Catalog
topic: Exact active `HostMessage` command catalog
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../01-architecture/03-bridge-protocol.md
related_docs:
- 01-ui-to-host-command-catalog.md
source_scope:
- ui/src/types/hostMessages.ts
- ui/src/types/content.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-host-message-parity.test.ts
runtime_scope:
- shared
keywords:
- protocol
- messages
---

# Host-to-UI Message Catalog

## Contract count

**24 active messages** are extracted from `ui/src/types/hostMessages.ts` and `ui/src/types/content.ts`.

| Command | Interface and payload |
|---|---|
| `chartPngSaveResult` | `ChartPngSaveResultMessage` — ok: boolean, path?: string, error?: string, requestId?: string |
| `crossTabSearchResults` | `CrossTabSearchResultsMessage` — requestId: string, results: readonly CrossTabSearchResult[], done?: boolean, total?: number, truncated?: boolean, cancelled?: boolean, error?: string |
| `currentFileChanged` | `CurrentFileChangedMessage` — workspaceOperationId?: string, workspaceTabId?: string, filePath: string |
| `desktopFontsResult` | `DesktopFontsResultMessage` — requestId: string, fonts: readonly DesktopFontFamily[], importedId?: string, error?: string |
| `externalOpenPath` | `ExternalOpenPathMessage` — path: string. Legacy compatibility fallback; new desktop shell launches use `externalOpenRequest`. |
| `externalOpenRequest` | `ExternalOpenRequestMessage` — request: `{ mode: 'file'; filePath } \| { mode: 'folder'; folderPath } \| { mode: 'file-with-parent-workspace'; filePath; folderPath }` |
| `fullscreenChanged` | `FullscreenStateChangedMessage` — isFullscreen: boolean |
| `navNotFound` | `NavNotFoundMessage` — href: string |
| `readyAck` | `ReadyAckMessage` — workspaceOperationId?: string, workspaceTabId?: string, fileList: MdFile[], tree: FolderNode \| null, theme: string, themeStyle?: string, defaultExpanded: boolean, workspaceName: string, workspacePath?: string, recentWorkspaces?: readonly RecentWorkspace[], appVersion?: string, appRuntime?: AppRuntime, hostPlatform?: HostPlatform, hostArch?: string, canInstallUpdates?: boolean, documentConversionEnabled?: boolean, isMaximized?: boolean, isFullscreen?: boolean |
| `recentWorkspacesChanged` | `RecentWorkspacesChangedMessage` — recentWorkspaces: readonly RecentWorkspace[] |
| `renderContent` | `RenderContentMessage` — workspaceOperationId?: string, workspaceTabId?: string, html: string, markdownSource?: string \| null, sourceDocumentText?: string \| null, frontmatter: Frontmatter, toc: TocEntry[], filePath: string, relativePath: string, title: string, fileList: MdFile[], previewInfo?: DocumentPreviewInfo \| null |
| `searchPreviewResult` | `SearchPreviewResultMessage` — requestId: string, ok: boolean, filePath: string, markdownSource?: string, reason?: 'outside-workspace' \| 'missing' \| 'unreadable' \| 'unsupported' \| 'too-large' |
| `setLoading` | `SetLoadingMessage` — workspaceOperationId?: string, workspaceTabId?: string, label?: string, detail?: string |
| `updateStateChanged` | `UpdateStateChangedMessage` — state: UpdateState |
| `window-state-changed` | `WindowStateChangedMessage` — isMaximized: boolean |
| `workspaceExportResourceResult` | `WorkspaceExportResourceResultMessage` — requestId: string, ok: boolean, relativePath?: string, mimeType?: string, dataBase64?: string, reason?: ExportWorkspaceResourceHostFailureReason |
| `workspaceExportResourcesResult` | `WorkspaceExportResourcesResultMessage` — requestId: string, ok: boolean, resources?: readonly ExportWorkspaceResourceInfo[], error?: string |
| `workspaceFilesChanged` | `WorkspaceFilesChangedMessage` — workspaceOperationId?: string, workspaceTabId?: string, fileList: MdFile[], tree: FolderNode \| null, workspaceName: string, workspacePath?: string, documentConversionEnabled?: boolean |
| `workspaceOpenCancelled` | `WorkspaceOpenCancelledMessage` — workspaceOperationId?: string, workspaceTabId?: string |
| `workspaceScanProgress` | `WorkspaceScanProgressMessage` — workspaceOperationId?: string, workspaceTabId?: string, scannedFiles: number, active: boolean |
| `workspaceSearchIndexLoaded` | `WorkspaceSearchIndexLoadedMessage` — tabs: readonly { tabId: string; workspacePath: string; fileList: MdFile[]; tree: FolderNode \| null }[] |
| `workspaceSearchResults` | `WorkspaceSearchResultsMessage` — requestId: string, results: readonly WorkspaceSearchResult[] |
| `workspaceTextResourceResult` | `WorkspaceTextResourceResultMessage` — requestId: string, ok: boolean, content?: string, resolvedPath?: string, reason?: 'outside-workspace' \| 'missing' \| 'unreadable' \| 'unsupported' |
| `workspaceUnavailable` | `WorkspaceUnavailableMessage` — workspaceOperationId?: string, workspaceTabId?: string, workspacePath: string, workspaceName: string, reason: WorkspaceUnavailableReason, recentWorkspaces?: readonly RecentWorkspace[], appVersion?: string, appRuntime?: AppRuntime, hostPlatform?: HostPlatform, hostArch?: string, canInstallUpdates?: boolean, isMaximized?: boolean |

## External-open request rules

`externalOpenRequest` preserves shell intent instead of reducing every launch to one path. `file-with-parent-workspace` is produced by the Windows `--open-with-folder` action and carries both the clicked Markdown file and its immediate parent folder. The UI opens/activates that folder as the workspace and focuses the supplied file. Plain file and folder modes retain the existing single-path behavior.

## Export response rules

`workspaceExportResourcesResult` and `workspaceExportResourceResult` are correlated by `requestId`. Resource failures use typed reasons and do not expose arbitrary host paths. Saving generated artifacts uses the existing UI-to-host `saveExportFile` request and its runtime-specific response mechanism rather than an Electron-only PDF response protocol.

## Handling requirements

- `renderContent` is the render message discriminant.
- Correlated messages must carry and preserve their operation/request metadata.
- UI handlers ignore unknown messages and stale correlated messages safely.
- `readyAck` capability fields govern native/updater/window UI.
- Workspace resource results remain bounded and workspace-contained.

## Example

```typescript
const message = {
  command: 'externalOpenRequest',
  request: {
    mode: 'file-with-parent-workspace',
    folderPath: 'C:/repo/docs',
    filePath: 'C:/repo/docs/guide.md',
  },
};
```

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/content.ts` | Active behavior or contract |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-host-message-parity.test.ts` | Automated expectation |

---

[← UI-to-Host Command Catalog](01-ui-to-host-command-catalog.md) · [Documentation index](../README.md) · [Settings Catalog →](03-settings-catalog.md)
