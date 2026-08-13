---
timestamp: '2026-08-01T22:54:00+07:00'
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

**18 active messages** are extracted from `ui/src/types/hostMessages.ts` and `ui/src/types/content.ts`.

| Command | Interface and payload |
|---|---|
| `crossTabSearchResults` | `CrossTabSearchResultsMessage` — requestId: string, results: readonly CrossTabSearchResult[], done?: boolean, total?: number, truncated?: boolean, cancelled?: boolean, error?: string |
| `currentFileChanged` | `CurrentFileChangedMessage` — workspaceOperationId?: string, workspaceTabId?: string, filePath: string |
| `desktopFontsResult` | `DesktopFontsResultMessage` — requestId: string, fonts: readonly DesktopFontFamily[], importedId?: string, error?: string |
| `externalOpenPath` | `ExternalOpenPathMessage` — path: string |
| `fullscreenChanged` | `FullscreenStateChangedMessage` — isFullscreen: boolean |
| `navNotFound` | `NavNotFoundMessage` — href: string |
| `readyAck` | `ReadyAckMessage` — workspaceOperationId?: string, workspaceTabId?: string, fileList: MdFile[], tree: FolderNode \| null, theme: string, themeStyle?: string, defaultExpanded: boolean, workspaceName: string, workspacePath?: string, recentWorkspaces?: readonly RecentWorkspace[], appVersion?: string, appRuntime?: AppRuntime, hostPlatform?: HostPlatform, hostArch?: string, canInstallUpdates?: boolean, documentConversionEnabled?: boolean, isMaximized?: boolean, isFullscreen?: boolean |
| `recentWorkspacesChanged` | `RecentWorkspacesChangedMessage` — recentWorkspaces: readonly RecentWorkspace[] |
| `renderContent` | `RenderContentMessage` — workspaceOperationId?: string, workspaceTabId?: string, html: string, markdownSource?: string \| null, sourceDocumentText?: string \| null, frontmatter: Frontmatter, toc: TocEntry[], filePath: string, relativePath: string, title: string, fileList: MdFile[], previewInfo?: DocumentPreviewInfo \| null |
| `setLoading` | `SetLoadingMessage` — workspaceOperationId?: string, workspaceTabId?: string, label?: string, detail?: string |
| `updateStateChanged` | `UpdateStateChangedMessage` — state: UpdateState |
| `window-state-changed` | `WindowStateChangedMessage` — isMaximized: boolean |
| `workspaceFilesChanged` | `WorkspaceFilesChangedMessage` — workspaceOperationId?: string, workspaceTabId?: string, fileList: MdFile[], tree: FolderNode \| null, workspaceName: string, workspacePath?: string, documentConversionEnabled?: boolean |
| `workspaceOpenCancelled` | `WorkspaceOpenCancelledMessage` — workspaceOperationId?: string, workspaceTabId?: string |
| `workspaceScanProgress` | `WorkspaceScanProgressMessage` — workspaceOperationId?: string, workspaceTabId?: string, scannedFiles: number, active: boolean |
| `workspaceSearchIndexLoaded` | `WorkspaceSearchIndexLoadedMessage` — tabs: readonly { readonly tabId: string; readonly workspacePath: string; readonly fileList: MdFile[]; readonly tree: FolderNode \| null }[] |
| `workspaceSearchResults` | `WorkspaceSearchResultsMessage` — requestId: string, results: readonly WorkspaceSearchResult[] |
| `workspaceTextResourceResult` | `WorkspaceTextResourceResultMessage` — requestId: string, ok: boolean, content?: string, resolvedPath?: string, reason?: 'outside-workspace' \| 'missing' \| 'unreadable' \| 'unsupported' |
| `workspaceUnavailable` | `WorkspaceUnavailableMessage` — workspaceOperationId?: string, workspaceTabId?: string, workspacePath: string, workspaceName: string, reason: WorkspaceUnavailableReason, recentWorkspaces?: readonly RecentWorkspace[], appVersion?: string, appRuntime?: AppRuntime, hostPlatform?: HostPlatform, hostArch?: string, canInstallUpdates?: boolean, isMaximized?: boolean |

## Desktop-font response rules

`desktopFontsResult` is correlated by `requestId`. A successful `importDesktopFonts` response may also include `importedId`; the renderer uses it only when the response matches the pending role-specific import request, then selects that family in the corresponding local typography draft. Each family reports normalized source/id/family plus available variants and host-approved URLs for imported faces only. Failures are non-fatal and may return an error with any successfully discovered families.

## Handling requirements

- `renderContent` is the render message discriminant.
- Correlated messages must carry and preserve their operation/request metadata.
- UI handlers ignore unknown messages and stale correlated messages safely.
- `readyAck` capability fields govern native/updater/window UI.
- `workspaceTextResourceResult` reasons remain typed and do not leak arbitrary filesystem data.

## Example

```typescript
const message = {
  command: 'workspaceScanProgress',
  workspaceOperationId: 'operation-42',
  scannedFiles: 320,
  active: true,
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
