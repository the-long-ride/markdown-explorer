---
timestamp: '2026-09-07T18:00:00+07:00'
name: Host-to-UI Message Catalog
topic: Exact active `HostMessage` command catalog
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../01-architecture/03-bridge-protocol.md
related_docs:
- 01-ui-to-host-command-catalog.md
- ../../git-history-diff.md
source_scope:
- ui/src/types/hostMessages.ts
- ui/src/types/content.ts
- ui/src/history/contracts.ts
- ui/src/insights/contracts.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-host-message-parity.test.ts
runtime_scope:
- shared
keywords:
- protocol
- messages
- git
- history
---

# Host-to-UI Message Catalog

## Contract count

**36 active messages** are extracted from `ui/src/types/hostMessages.ts` and `ui/src/types/content.ts`.

| Command | Interface and payload |
|---|---|
| `chartPngSaveResult` | `ChartPngSaveResultMessage` — ok: boolean, path?: string, error?: string, requestId?: string |
| `crossTabSearchResults` | `CrossTabSearchResultsMessage` — requestId: string, results: readonly CrossTabSearchResult[], done?: boolean, total?: number, truncated?: boolean, cancelled?: boolean, error?: string |
| `currentFileChanged` | `CurrentFileChangedMessage` — workspaceOperationId?: string, workspaceTabId?: string, filePath: string |
| `desktopFontsResult` | `DesktopFontsResultMessage` — requestId: string, fonts: readonly DesktopFontFamily[], importedId?: string, error?: string |
| `documentHistoryResult` | `DocumentHistoryResultMessage` — requestId: string, ok: boolean, revisions: readonly GitRevisionSummary[], reason?: string |
| `externalLinkCheckComplete` | `ExternalLinkCheckCompleteMessage` — requestId: string, cancelled: boolean |
| `externalLinkCheckResult` | `ExternalLinkCheckResultMessage` — requestId: string, url: string, status: ExternalLinkCheckStatus, httpStatus?: number, finalUrl?: string, checkedAt?: string, insecureDowngrade?: boolean, reason?: string, retryAfterMs?: number, privateOrigin?: string, requiresPrivateOriginConfirmation?: boolean |
| `externalOpenPath` | `ExternalOpenPathMessage` — path: string. Legacy compatibility fallback; new desktop shell launches use `externalOpenRequest`. |
| `externalOpenRequest` | `ExternalOpenRequestMessage` — request: `{ mode: 'file'; filePath } \| { mode: 'folder'; folderPath } \| { mode: 'file-with-parent-workspace'; filePath; folderPath }` |
| `fullscreenChanged` | `FullscreenStateChangedMessage` — isFullscreen: boolean |
| `gitCapabilityResult` | `GitCapabilityResultMessage` — requestId: string, capability: GitCapability |
| `gitComparisonResult` | `GitComparisonResultMessage` — requestId: string, ok: boolean, leftSource?: string, rightSource?: string, leftLabel?: string, rightLabel?: string, reason?: string |
| `gitRevisionResult` | `GitRevisionResultMessage` — requestId: string, ok: boolean, snapshot?: GitRevisionSnapshot, reason?: string |
| `insightsDocumentSourceResult` | `InsightsDocumentSourceResultMessage` — requestId: string, relativePath: string, status: InsightsSourceStatus, source?: string, sizeBytes?: number, mtimeMs?: number, contentHash?: string, hardLimit?: boolean |
| `insightsFsDelta` | `InsightsFsDeltaMessage` — requestId: string, workspaceOperationId?: string, deltas: readonly InsightsFsDelta[] |
| `insightsRuntimeCapabilities` | `InsightsRuntimeCapabilitiesMessage` — requestId: string, capabilities: { fileChanges: 'native' \| 'polling' \| 'unsupported'; externalLinkChecking: boolean; documentPreviewReuse: boolean } |
| `insightsScanBatch` | `InsightsScanBatchMessage` — requestId: string, entries: readonly InsightsWorkspaceEntry[], scannedEntries: number, excludedEntries: number |
| `insightsScanComplete` | `InsightsScanCompleteMessage` — requestId: string, totalEntries: number, excludedEntries: number, skippedEntries: number, truncated: boolean, truncatedReason?: string, cancelled?: boolean |
| `navNotFound` | `NavNotFoundMessage` — href: string |
| `readyAck` | `ReadyAckMessage` — workspaceOperationId?: string, workspaceTabId?: string, fileList: MdFile[], tree: FolderNode \| null, theme: string, themeStyle?: string, defaultExpanded: boolean, workspaceName: string, workspacePath?: string, recentWorkspaces?: readonly RecentWorkspace[], appVersion?: string, appRuntime?: AppRuntime, hostPlatform?: HostPlatform, hostArch?: string, canInstallUpdates?: boolean, documentConversionEnabled?: boolean, isMaximized?: boolean, isFullscreen?: boolean |
| `recentWorkspacesChanged` | `RecentWorkspacesChangedMessage` — recentWorkspaces: readonly RecentWorkspace[] |
| `renderContent` | `RenderContentMessage` — workspaceOperationId?: string, workspaceTabId?: string, html: string, markdownSource?: string \| null, sourceDocumentText?: string \| null, frontmatter: Frontmatter, toc: TocEntry[], filePath: string, relativePath: string, title: string, fileList: MdFile[], previewInfo?: DocumentPreviewInfo \| null, documentWrite?: DocumentWriteCapability |
| `saveDocumentResult` | `SaveDocumentResultMessage` — requestId: string, filePath: string, ok: boolean, revision?: DocumentRevisionToken, diskSource?: string, diskRevision?: DocumentRevisionToken, reason?: 'conflict' \| 'permission-denied' \| 'missing' \| 'outside-workspace' \| 'read-only' \| 'write-failed', error?: string |
| `searchPreviewResult` | `SearchPreviewResultMessage` — requestId: string, ok: boolean, filePath: string, markdownSource?: string, reason?: 'outside-workspace' \| 'missing' \| 'unreadable' \| 'unsupported' \| 'too-large' |
| `setLoading` | `SetLoadingMessage` — workspaceOperationId?: string, workspaceTabId?: string, label?: string, detail?: string |
| `updateStateChanged` | `UpdateStateChangedMessage` — state: UpdateState |
| `window-state-changed` | `WindowStateChangedMessage` — isMaximized: boolean |
| `workspaceExportResourceResult` | `WorkspaceExportResourceResultMessage` — requestId: string, ok: boolean, relativePath?: string, mimeType?: string, dataBase64?: string, reason?: ExportWorkspaceResourceHostFailureReason |
| `workspaceFilesChanged` | `WorkspaceFilesChangedMessage` — workspaceOperationId?: string, workspaceTabId?: string, fileList: MdFile[], tree: FolderNode \| null, workspaceName: string, workspacePath?: string, documentConversionEnabled?: boolean |
| `workspaceOpenCancelled` | `WorkspaceOpenCancelledMessage` — workspaceOperationId?: string, workspaceTabId?: string |
| `workspaceResourceProbeResult` | `WorkspaceResourceProbeResultMessage` — requestId: string, status: WorkspaceResourceProbeStatus, relativePath?: string, kind?: 'file' \| 'directory', sizeBytes?: number, mimeType?: string |
| `workspaceScanProgress` | `WorkspaceScanProgressMessage` — workspaceOperationId?: string, workspaceTabId?: string, scannedFiles: number, active: boolean |
| `workspaceSearchIndexLoaded` | `WorkspaceSearchIndexLoadedMessage` — tabs: readonly { tabId: string; workspacePath: string; fileList: MdFile[]; tree: FolderNode \| null }[] |
| `workspaceSearchResults` | `WorkspaceSearchResultsMessage` — requestId: string, results: readonly WorkspaceSearchResult[] |
| `workspaceTextResourceResult` | `WorkspaceTextResourceResultMessage` — requestId: string, ok: boolean, content?: string, resolvedPath?: string, reason?: 'outside-workspace' \| 'missing' \| 'unreadable' \| 'unsupported' |
| `workspaceUnavailable` | `WorkspaceUnavailableMessage` — workspaceOperationId?: string, workspaceTabId?: string, workspacePath: string, workspaceName: string, reason: WorkspaceUnavailableReason, recentWorkspaces?: readonly RecentWorkspace[], appVersion?: string, appRuntime?: AppRuntime, hostPlatform?: HostPlatform, hostArch?: string, canInstallUpdates?: boolean, isMaximized?: boolean |

## Git history response rules

- `gitCapabilityResult`, `documentHistoryResult`, `gitRevisionResult`, and `gitComparisonResult` preserve the initiating `requestId`.
- Unsupported browser hosts return a normal capability/result message instead of throwing across the bridge.
- Historical source is delivered only through History response state; it never replaces the editable `renderContent` source or document session.

## Document-save response rules

- `saveDocumentResult` is correlated by `requestId` and identifies the exact `filePath` being saved.
- A successful save returns the new revision token.
- A conflict returns the current disk source/revision so the UI can Reload, Compare, or explicitly force-save after user choice.

## Workspace Insights response rules

- Insights scan/source/probe/link messages preserve `requestId`; filesystem deltas may additionally preserve `workspaceOperationId`.
- Scan batches are incremental and completion is explicit through `insightsScanComplete`.
- Runtime capabilities describe watcher/link-check/preview reuse support without changing the shared protocol spelling.

## External-open request rules

`externalOpenRequest` preserves shell intent instead of reducing every launch to one path. `file-with-parent-workspace` is produced by the Windows `--open-with-folder` action and carries both the clicked Markdown file and its immediate parent folder. The UI opens/activates that folder as the workspace and focuses the supplied file. Plain file and folder modes retain the existing single-path behavior.

## Export response rules

`workspaceExportResourceResult` is correlated by `requestId`. Resource failures use typed reasons and do not expose arbitrary host paths. Saving generated artifacts uses the existing UI-to-host `saveExportFile` request and its runtime-specific response mechanism rather than an Electron-only PDF response protocol.

## Handling requirements

- `renderContent` is the render message discriminant and may include `documentWrite` capability/revision metadata.
- Correlated messages must carry and preserve their operation/request metadata.
- UI handlers ignore unknown messages and stale correlated messages safely.
- `readyAck` capability fields govern native/updater/window UI.
- Workspace resource results remain bounded and workspace-contained.
- History/diff responses do not mutate document sessions by themselves.

## Example

```typescript
const message = {
  command: 'gitCapabilityResult',
  requestId: 'history-42',
  capability: {
    supported: false,
    reason: 'unsupported-runtime',
  },
};
```

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/content.ts` | Render/write capability contract |
| Implementation | `ui/src/history/contracts.ts` | Git history response models |
| Implementation | `ui/src/insights/contracts.ts` | Workspace Insights response models |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-host-message-parity.test.ts` | Automated expectation |

---

[← UI-to-Host Command Catalog](01-ui-to-host-command-catalog.md) · [Documentation index](../README.md) · [Settings Catalog →](03-settings-catalog.md)
