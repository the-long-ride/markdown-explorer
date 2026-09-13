import type { RecentWorkspace } from './files';
import type { DocumentRevisionToken, WorkspaceOperationMetadata } from './content';
import type { CrossTabSearchResult, WorkspaceSearchResult } from './hostMessages';
import type { ShellLocationMode, ThemeMode, ThemeStyle } from './settings';
import type { ExternalLinkCheckRequest, InsightsScanRequest } from '../insights/contracts';
import type { GitCompareSide } from '../history/contracts';

export interface ReadWorkspaceTextResourceMessage { readonly command: 'readWorkspaceTextResource'; readonly requestId: string; readonly documentPath: string; readonly resourcePath: string; }
export interface ReadWorkspaceExportResourceMessage { readonly command: 'readWorkspaceExportResource'; readonly requestId: string; readonly resourcePath: string; readonly documentPath?: string; }
export interface SaveExportFileMessage { readonly command: 'saveExportFile'; readonly requestId: string; readonly fileName: string; readonly mimeType: string; readonly dataBase64: string; }
export interface SaveDocumentMessage { readonly command: 'saveDocument'; readonly requestId: string; readonly filePath: string; readonly source: string; readonly expectedRevision: DocumentRevisionToken | null; readonly force?: boolean; }
export interface GetGitCapabilityMessage { readonly command: 'getGitCapability'; readonly requestId: string; }
export interface ListDocumentHistoryMessage { readonly command: 'listDocumentHistory'; readonly requestId: string; readonly filePath: string; readonly limit?: number; }
export interface ReadGitRevisionMessage { readonly command: 'readGitRevision'; readonly requestId: string; readonly oid: string; readonly path: string; }
export interface CompareGitRevisionsMessage { readonly command: 'compareGitRevisions'; readonly requestId: string; readonly left: GitCompareSide; readonly right: GitCompareSide; }
export interface NavigateMessage { readonly command: 'navigate'; readonly path: string; }
export interface OpenInEditorMessage { readonly command: 'openInEditor'; readonly path: string; }
export interface WebviewReadyMessage { readonly command: 'ready'; readonly documentConversionEnabled?: boolean; }
export interface CopyCodeMessage { readonly command: 'copyCode'; readonly text: string; }
export interface RefreshMessage { readonly command: 'refresh'; }

export interface ScanInsightsWorkspaceMessage extends InsightsScanRequest { readonly command: 'scanInsightsWorkspace'; }
export interface CancelInsightsScanMessage { readonly command: 'cancelInsightsScan'; readonly requestId: string; }
export interface ReadInsightsDocumentSourceMessage {
  readonly command: 'readInsightsDocumentSource';
  readonly requestId: string;
  readonly relativePath: string;
  readonly softLimitBytes: number;
  readonly hardLimitBytes?: number;
}
export interface ProbeWorkspaceResourceMessage {
  readonly command: 'probeWorkspaceResource';
  readonly requestId: string;
  readonly documentPath: string;
  readonly resourcePath: string;
}
export interface SetInsightsWatchStateMessage {
  readonly command: 'setInsightsWatchState';
  readonly requestId: string;
  readonly workspaceOperationId?: string;
  readonly active: boolean;
  readonly visible: boolean;
}
export interface CheckExternalLinksMessage extends ExternalLinkCheckRequest { readonly command: 'checkExternalLinks'; }
export interface CancelExternalLinkChecksMessage { readonly command: 'cancelExternalLinkChecks'; readonly requestId: string; }

export interface OpenFolderMessage extends WorkspaceOperationMetadata { readonly command: 'openFolder'; readonly openFirstFile?: boolean; readonly handle?: any; readonly replaceRecentWorkspacePath?: string; }
export interface OpenFileMessage extends WorkspaceOperationMetadata { readonly command: 'openFile'; }
export interface OpenFileHandleMessage extends WorkspaceOperationMetadata { readonly command: 'openFileHandle'; readonly handle?: any; }
export interface OpenPathMessage extends WorkspaceOperationMetadata { readonly command: 'openPath'; readonly path: string; readonly openFirstFile?: boolean; }
export interface ActivateWorkspaceMessage extends WorkspaceOperationMetadata { readonly command: 'activateWorkspace'; readonly workspacePath: string; readonly filePath?: string; readonly openFirstFile?: boolean; }
export interface CrossTabSearchMessage { readonly command: 'searchAcrossWorkspaces'; readonly requestId: string; readonly query: string; readonly matchCase?: boolean; readonly tabIds?: readonly string[]; readonly items?: readonly CrossTabSearchResult[]; }
export interface SearchPreviewRequestMessage { readonly command: 'loadSearchPreview'; readonly requestId: string; readonly filePath: string; readonly tabId?: string; }
export interface WorkspaceSearchMessage { readonly command: 'searchWorkspace'; readonly requestId: string; readonly query: string; readonly matchCase?: boolean; readonly items?: readonly WorkspaceSearchResult[]; }
export interface IndexWorkspaceSearchItemsMessage { readonly command: 'indexWorkspaceSearchItems'; readonly items?: readonly CrossTabSearchResult[]; }
export interface LoadWorkspaceSearchIndexesMessage { readonly command: 'loadWorkspaceSearchIndexes'; readonly tabs: readonly { readonly tabId: string; readonly workspacePath: string }[]; }
export interface ConfirmOpenPathMessage { readonly command: 'confirmOpenPath'; readonly path: string; }
export interface OpenRecentWorkspaceMessage extends WorkspaceOperationMetadata { readonly command: 'openRecentWorkspace'; readonly path: string; readonly openFirstFile?: boolean; }
export interface CloseWorkspaceMessage extends WorkspaceOperationMetadata { readonly command: 'closeWorkspace'; }
export interface CancelWorkspaceScanMessage { readonly command: 'cancelWorkspaceScan'; readonly workspaceOperationId: string; }
export interface CancelAllWorkspaceScansMessage { readonly command: 'cancelAllWorkspaceScans'; }
export interface DeleteRecentWorkspaceMessage { readonly command: 'deleteRecentWorkspace'; readonly path: string; }
export interface ReplaceRecentWorkspacesMessage { readonly command: 'replaceRecentWorkspaces'; readonly recentWorkspaces: readonly RecentWorkspace[]; }
export interface WindowMinimizeMessage { readonly command: 'window-minimize'; }
export interface WindowMaximizeMessage { readonly command: 'window-maximize'; }
export interface WindowCloseMessage { readonly command: 'window-close'; }
export interface ToggleFullscreenMessage { readonly command: 'toggle-fullscreen'; }
export interface ZoomInMessage { readonly command: 'zoom-in'; }
export interface ZoomOutMessage { readonly command: 'zoom-out'; }
export interface ZoomResetMessage { readonly command: 'zoom-reset'; }
export interface UpdateAppearanceMessage { readonly command: 'updateAppearance'; readonly theme: ThemeMode; readonly themeStyle: ThemeStyle; }
export interface OpenShellLocationMessage { readonly command: 'openShellLocation'; readonly path: string; readonly mode: ShellLocationMode; }
export interface OpenExternalMessage { readonly command: 'openExternal'; readonly url: string; }
export interface OpenHtmlPreviewMessage { readonly command: 'openHtmlPreview'; readonly documentHtml: string; }
export interface SetDocumentConversionMessage { readonly command: 'setDocumentConversion'; readonly enabled: boolean; }
export interface DownloadUpdateMessage { readonly command: 'downloadUpdate'; readonly version: string; readonly url: string; }
export interface ScheduleDownloadedUpdateMessage { readonly command: 'scheduleDownloadedUpdate'; }
export interface RestartAndApplyUpdateMessage { readonly command: 'restartAndApplyUpdate'; }
export interface ListDesktopFontsMessage { readonly command: 'listDesktopFonts'; readonly requestId: string; }
export interface ImportDesktopFontsMessage { readonly command: 'importDesktopFonts'; readonly requestId: string; }
export interface RemoveImportedDesktopFontMessage { readonly command: 'removeImportedDesktopFont'; readonly requestId: string; readonly id: string; }
export interface SaveChartPngMessage { readonly command: 'saveChartPng'; readonly fileName: string; readonly dataUrl: string; readonly requestId?: string; }

export type WebviewMessage =
  | ReadWorkspaceTextResourceMessage | ReadWorkspaceExportResourceMessage | SaveExportFileMessage | SaveDocumentMessage
  | GetGitCapabilityMessage | ListDocumentHistoryMessage | ReadGitRevisionMessage | CompareGitRevisionsMessage
  | ScanInsightsWorkspaceMessage | CancelInsightsScanMessage | ReadInsightsDocumentSourceMessage
  | ProbeWorkspaceResourceMessage | SetInsightsWatchStateMessage | CheckExternalLinksMessage | CancelExternalLinkChecksMessage
  | NavigateMessage | OpenInEditorMessage | WebviewReadyMessage
  | CopyCodeMessage | RefreshMessage | OpenFolderMessage | OpenFileMessage
  | OpenFileHandleMessage | OpenPathMessage | ActivateWorkspaceMessage | CrossTabSearchMessage
  | SearchPreviewRequestMessage | WorkspaceSearchMessage | IndexWorkspaceSearchItemsMessage | LoadWorkspaceSearchIndexesMessage
  | ConfirmOpenPathMessage | OpenRecentWorkspaceMessage | CloseWorkspaceMessage
  | CancelWorkspaceScanMessage | CancelAllWorkspaceScansMessage | DeleteRecentWorkspaceMessage
  | ReplaceRecentWorkspacesMessage | ZoomInMessage | ZoomOutMessage | ZoomResetMessage | WindowMinimizeMessage
  | WindowMaximizeMessage | WindowCloseMessage | ToggleFullscreenMessage | UpdateAppearanceMessage
  | OpenShellLocationMessage | OpenExternalMessage | OpenHtmlPreviewMessage
  | SetDocumentConversionMessage | DownloadUpdateMessage | ScheduleDownloadedUpdateMessage
  | RestartAndApplyUpdateMessage | ListDesktopFontsMessage | ImportDesktopFontsMessage
  | RemoveImportedDesktopFontMessage | SaveChartPngMessage;
