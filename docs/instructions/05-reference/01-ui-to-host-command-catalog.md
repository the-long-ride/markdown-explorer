---
timestamp: '2026-10-07T00:00:00+07:00'
name: UI-to-Host Command Catalog
topic: Exact active `WebviewMessage` command catalog
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../01-architecture/03-bridge-protocol.md
related_docs:
- 02-host-to-ui-message-catalog.md
- ../../git-history-diff.md
- ../../superpowers/specs/2026-09-17-pr48-as-built-sync.md
source_scope:
- ui/src/types/webviewMessages.ts
- ui/src/platform/bridge.ts
- ui/src/history/contracts.ts
- ui/src/history/historyClient.ts
- ui/src/insights/contracts.ts
- ui/src/workspace/workspaceEntriesClient.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-dispatcher-parity.test.ts
- tests/node/repository-history-pagination-contract.test.mjs
- tests/unit/ui/workspace/workspace-entries-client.test.ts
runtime_scope:
- shared
keywords:
- protocol
- commands
- git
- history
- repository snapshots
- pagination
---

# UI-to-Host Command Catalog

## Contract count

**61 active commands** are extracted from `ui/src/types/webviewMessages.ts`.

| Command | Interface and payload |
|---|---|
| `activateWorkspace` | `ActivateWorkspaceMessage` — workspaceOperationId?: string, workspaceTabId?: string, workspacePath: string, filePath?: string, openFirstFile?: boolean |
| `cancelAllWorkspaceScans` | `CancelAllWorkspaceScansMessage` — No payload |
| `cancelExternalLinkChecks` | `CancelExternalLinkChecksMessage` — requestId: string |
| `cancelInsightsScan` | `CancelInsightsScanMessage` — requestId: string |
| `cancelWorkspaceScan` | `CancelWorkspaceScanMessage` — workspaceOperationId: string |
| `checkExternalLinks` | `CheckExternalLinksMessage` — requestId: string, urls: readonly string[], timeoutMs: number, recheck?: boolean, approvedPrivateOrigins?: readonly string[] |
| `closeWorkspace` | `CloseWorkspaceMessage` — workspaceOperationId?: string, workspaceTabId?: string |
| `compareGitRevisions` | `CompareGitRevisionsMessage` — requestId: string, left: GitCompareSide, right: GitCompareSide |
| `confirmOpenPath` | `ConfirmOpenPathMessage` — path: string |
| `copyCode` | `CopyCodeMessage` — text: string |
| `createWorkspaceEntry` | `CreateWorkspaceEntryMessage` — requestId: string, parentPath: string ('/'-separated, '' = root), name: string, kind: 'file' \| 'folder' |
| `deleteRecentWorkspace` | `DeleteRecentWorkspaceMessage` — path: string |
| `renameWorkspaceEntry` | `RenameWorkspaceEntryMessage` — requestId, path, name, kind: 'file' \| 'folder' |
| `deleteWorkspaceEntries` | `DeleteWorkspaceEntriesMessage` — requestId: string, paths: string[] ('/'-separated, workspace-relative), mode?: 'trash' \| 'permanent' |
| `downloadUpdate` | `DownloadUpdateMessage` — version: string, url: string |
| `importDesktopFonts` | `ImportDesktopFontsMessage` — requestId: string |
| `indexWorkspaceSearchItems` | `IndexWorkspaceSearchItemsMessage` — items?: readonly CrossTabSearchResult[] |
| `listDesktopFonts` | `ListDesktopFontsMessage` — requestId: string |
| `listDocumentHistory` | `ListDocumentHistoryMessage` — requestId: string, filePath: string, limit?: number |
| `listRepositoryHistory` | `ListRepositoryHistoryMessage` — requestId: string, limit?: number, offset?: number |
| `listRevisionFiles` | `ListRevisionFilesMessage` — requestId: string, oid: string |
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
| `probeWorkspaceResource` | `ProbeWorkspaceResourceMessage` — requestId: string, documentPath: string, resourcePath: string |
| `readGitRevision` | `ReadGitRevisionMessage` — requestId: string, oid: string, path: string |
| `readInsightsDocumentSource` | `ReadInsightsDocumentSourceMessage` — requestId: string, relativePath: string, softLimitBytes: number, hardLimitBytes?: number |
| `readRevisionFile` | `ReadRevisionFileMessage` — requestId: string, oid: string, path: string |
| `readWorkspaceExportResource` | `ReadWorkspaceExportResourceMessage` — requestId: string, resourcePath: string, documentPath?: string |
| `readWorkspaceTextResource` | `ReadWorkspaceTextResourceMessage` — requestId: string, documentPath: string, resourcePath: string |
| `ready` | `WebviewReadyMessage` — documentConversionEnabled?: boolean |
| `refresh` | `RefreshMessage` — No payload |
| `removeImportedDesktopFont` | `RemoveImportedDesktopFontMessage` — requestId: string, id: string |
| `replaceRecentWorkspaces` | `ReplaceRecentWorkspacesMessage` — recentWorkspaces: readonly RecentWorkspace[] |
| `restartAndApplyUpdate` | `RestartAndApplyUpdateMessage` — No payload |
| `saveChartPng` | `SaveChartPngMessage` — fileName: string, dataUrl: string, requestId?: string |
| `saveDocument` | `SaveDocumentMessage` — requestId: string, filePath: string, source: string, expectedRevision: DocumentRevisionToken \| null, force?: boolean |
| `saveExportFile` | `SaveExportFileMessage` — requestId: string, fileName: string, mimeType: string, dataBase64: string |
| `scanInsightsWorkspace` | `ScanInsightsWorkspaceMessage` — requestId: string, workspaceOperationId?: string, userPatterns?: readonly string[], oversizedPatterns?: readonly string[], builtInExclusionVersion?: number |
| `scheduleDownloadedUpdate` | `ScheduleDownloadedUpdateMessage` — No payload |
| `searchAcrossWorkspaces` | `CrossTabSearchMessage` — requestId: string, query: string, matchCase?: boolean, tabIds?: readonly string[], items?: readonly CrossTabSearchResult[] |
| `searchWorkspace` | `WorkspaceSearchMessage` — requestId: string, query: string, matchCase?: boolean, items?: readonly WorkspaceSearchResult[] |
| `setDocumentConversion` | `SetDocumentConversionMessage` — enabled: boolean |
| `setInsightsWatchState` | `SetInsightsWatchStateMessage` — requestId: string, workspaceOperationId?: string, active: boolean, visible: boolean |
| `toggle-fullscreen` | `ToggleFullscreenMessage` — No payload |
| `updateAppearance` | `UpdateAppearanceMessage` — theme: ThemeMode, themeStyle: ThemeStyle |
| `window-close` | `WindowCloseMessage` — No payload |
| `window-maximize` | `WindowMaximizeMessage` — No payload |
| `window-minimize` | `WindowMinimizeMessage` — No payload |
| `zoom-in` | `ZoomInMessage` — No payload |
| `zoom-out` | `ZoomOutMessage` — No payload |
| `zoom-reset` | `ZoomResetMessage` — No payload |

## Git history request rules

- `listDocumentHistory`, `readGitRevision`, `compareGitRevisions`, `listRepositoryHistory`, `listRevisionFiles`, and `readRevisionFile` are correlated by `requestId`.
- Electron, Tauri, and VS Code route them to read-only local Git adapters. Chromium/Website return explicit unsupported responses and never start a local process.
- `listRepositoryHistory` is paged. `limit` bounds the page size and `offset` skips already loaded commits. The current History UI requests 50 commits initially and increments offset by the number already loaded.
- Electron, VS Code, and Tauri preserve identical pagination semantics; their local Git implementations use read-only `--skip=<offset>` and `-n <limit>` behavior.
- Repository pages report commit identity, all parents, author/time/subject, refs, and exact `HEAD` state; requesting a page never checks out a revision.
- `listRevisionFiles` enumerates the selected tree under the active workspace boundary. A repository subfolder workspace cannot list sibling repository files.
- `readRevisionFile` accepts a validated full OID plus workspace-relative path and returns historical source without mutating the index, working tree, branch, content tabs, split panes, or editable document sessions.
- Revision reads use validated full object IDs and repository/workspace-contained paths. No Git request accepts a shell command string.
- Historical reads never update editable document-session state.

## Document-save request rules

- `saveDocument` carries the complete intended source plus the last observed `expectedRevision` token.
- Hosts reject stale revisions with a conflict result rather than overwriting disk content silently.
- `force: true` is reserved for the explicit conflict-resolution flow; normal saves keep optimistic revision protection enabled.

## Workspace entry request rules

- `createWorkspaceEntry` and `deleteWorkspaceEntries` are correlated by `requestId` and answered by `createWorkspaceEntryResult` / `deleteWorkspaceEntriesResult`. The UI client (`workspaceEntriesClient.ts`) waits 15 seconds, then synthesizes a `failed` result: one `failed` reason for a create, one `failed` entry per requested path for a delete.
- Paths are workspace-relative and '/'-separated; `parentPath: ''` is the workspace root. Hosts never trim `name`; the UI trims it first and appends `.md` to a file name that contains no `.`.
- Runtimes: Electron, VS Code, Tauri, Chromium, and website file mode implement both commands. Electron, VS Code, and Tauri default to OS Trash (`mode: 'trash'`) with an explicit permanent override; the Chromium extension and website file mode remove them permanently with File System Access `removeEntry` (`mode: 'permanent'`).
- Create is exclusive and never overwrites an existing entry. Delete never follows a symlink entry, refuses any `.git` segment and the workspace root, and processes each path independently. Failure reasons are listed in the [Error and Reason Catalog](09-error-and-reason-catalog.md).
- The website demo implements create/rename/delete against localStorage-backed simulated entries; no real filesystem access occurs. Website `?mode=file` uses real directory handles and requires write permission.

## Workspace Insights request rules

- Insights scan/source/resource/external-link commands are correlated by `requestId`; workspace scans may additionally carry `workspaceOperationId`.
- Source/resource paths remain workspace-relative and hosts enforce workspace containment.
- External-link checks preserve the approved-private-origin boundary and caller-supplied timeout.

## Export request rules

- `readWorkspaceExportResource` reads a bounded binary resource by workspace-relative path; hosts canonicalize the request and reject workspace escapes.
- `saveExportFile` carries generated bytes and a suggested filename. The host chooses the final destination through its normal save capability; the UI cannot supply an arbitrary absolute destination path.
- PDF uses the same `saveExportFile` route as HTML and ZIP outputs. There is no special Electron-only `exportPdf` command or footer protocol.

## Dispatch requirements

- Command names and payload fields are case-sensitive.
- Workspace operations preserve `workspaceOperationId` and `workspaceTabId` when supplied.
- Search/resource/save/history/Insights requests preserve `requestId`.
- Search requests preserve original query casing; `matchCase: true` selects exact-case metadata/content matching.
- A runtime implements only capabilities it exposes; unsupported UI controls remain hidden or disabled, or return an explicit safe unsupported result when the shared protocol requires one.
- Adding/removing a command requires parity review and this catalog update.

## Example

```typescript
window.PlatformBridge.postMessage({
  command: 'listRepositoryHistory',
  requestId: 'history-page-3',
  limit: 50,
  offset: 100,
});
```

## Entry rename and explicit deletion mode

- `renameWorkspaceEntry`: `{ requestId, path, name, kind: 'file' | 'folder' }`; path is workspace-relative with `/` separators. Validate protected roots, containment and destination collisions; never overwrite.
- `deleteWorkspaceEntries` also accepts optional `mode: 'trash' | 'permanent'`. Native hosts honor the selected mode; browser and simulated hosts report permanent mode explicitly.
- All entry mutations refresh the workspace before replying on success. Demo mode updates only its localStorage-backed simulated workspace. Real browser rename uses move when supported; its copy fallback retains the complete destination if removing the original fails and reports that recovery location.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/webviewMessages.ts` | Active bridge request contract |
| Implementation | `ui/src/platform/bridge.ts` | Active bridge behavior |
| Implementation | `ui/src/history/historyClient.ts` | Correlated Git request client and pagination payload |
| Implementation | `ui/src/history/contracts.ts` | Git history and repository snapshot payload types |
| Implementation | `ui/src/insights/contracts.ts` | Workspace Insights payload types |
| Implementation | `ui/src/workspace/workspaceEntriesClient.ts` | Correlated create/delete entry requests and timeout results |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-dispatcher-parity.test.ts` | Automated expectation |
| Verification | `tests/node/repository-history-pagination-contract.test.mjs` | Cross-runtime offset/search/routing contract |
| Verification | `tests/unit/ui/workspace/workspace-entries-client.test.ts` | Request/response correlation and timeout results |

---

[← Runtime Parity and Capability Matrix](../04-runtimes/06-runtime-parity.md) · [Documentation index](../README.md) · [Host-to-UI Message Catalog →](02-host-to-ui-message-catalog.md)
