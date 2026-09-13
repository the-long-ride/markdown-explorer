import * as path from 'path';
import * as fs from 'fs';

import type { WebviewMessage } from '../types';
import { createPanelInsightsHost } from '../core/panelInsights';
import { createInsightsExternalHost } from '../core/panelInsightsExternal';
import { handlePanelExportResourceMessage } from '../core/panelExportResources';
import { handlePanelExportSaveMessage } from '../core/panelExportSave';
import { handlePanelGitHistoryMessage } from '../core/panelGitHistory';
import { createVsCodeFontService, type VsCodeFontFamily } from './fontService';

export function getGlobalStorageUri(
  context: import('vscode').ExtensionContext,
  vscodeApi: typeof import('vscode'),
): import('vscode').Uri {
  return context.globalStorageUri
    ?? vscodeApi.Uri.file(path.join(context.extensionPath, '.markdown-explorer-global-storage'));
}

export function createPanelFontBridge(
  webview: import('vscode').Webview,
  context: import('vscode').ExtensionContext,
  vscodeApi: typeof import('vscode'),
) {
  const globalStorageUri = getGlobalStorageUri(context, vscodeApi);
  const fontService = createVsCodeFontService({
    managedRoot: path.join(globalStorageUri.fsPath, 'fonts'),
    resolveCssUrl: (filePath) => webview.asWebviewUri(vscodeApi.Uri.file(filePath)).toString(),
  });
  const postMessage = async (message: any) => { await webview.postMessage(message); };
  const insightsHost = createPanelInsightsHost({
    fs,
    pathApi: path,
    workspaceRoot: () => vscodeApi.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null,
    postMessage,
  });
  const externalHost = createInsightsExternalHost({ postMessage });
  context.subscriptions?.push({
    dispose: () => {
      insightsHost.dispose();
      externalHost.dispose();
    },
  });

  async function sendResult(requestId: string, importedId?: string, error?: string): Promise<void> {
    let fonts: VsCodeFontFamily[] = [];
    let finalError = error;
    try {
      fonts = await fontService.listFonts();
    } catch (fontError) {
      finalError ||= String(fontError instanceof Error ? fontError.message : fontError);
    }
    await webview.postMessage({
      command: 'desktopFontsResult',
      requestId,
      fonts,
      ...(importedId ? { importedId } : {}),
      ...(finalError ? { error: finalError } : {}),
    });
  }

  async function handle(message: WebviewMessage | any): Promise<boolean> {
    switch (message.command) {
      case 'scanInsightsWorkspace':
        await insightsHost.scanInsightsWorkspace(message);
        return true;
      case 'cancelInsightsScan':
        insightsHost.cancelInsightsScan(message);
        return true;
      case 'readInsightsDocumentSource':
        await insightsHost.readInsightsDocumentSource(message);
        return true;
      case 'probeWorkspaceResource':
        await insightsHost.probeWorkspaceResource(message);
        return true;
      case 'setInsightsWatchState':
        await insightsHost.setInsightsWatchState(message);
        return true;
      case 'checkExternalLinks':
        await externalHost.checkExternalLinks(message);
        return true;
      case 'cancelExternalLinkChecks':
        externalHost.cancelExternalLinkChecks(message);
        return true;
      case 'listDesktopFonts':
        await sendResult(message.requestId);
        return true;
      case 'importDesktopFonts': {
        const selected = await vscodeApi.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { Fonts: ['ttf', 'otf'] },
          title: 'Import font file',
        });
        if (!selected?.length) {
          await sendResult(message.requestId);
          return true;
        }
        try {
          const imported = await fontService.importFontFiles(selected.map((uri) => uri.fsPath));
          await sendResult(message.requestId, imported.id);
        } catch (error) {
          await sendResult(message.requestId, undefined, String(error instanceof Error ? error.message : error));
        }
        return true;
      }
      case 'removeImportedDesktopFont':
        try {
          await fontService.removeImportedFont(message.id);
          await sendResult(message.requestId);
        } catch (error) {
          await sendResult(message.requestId, undefined, String(error instanceof Error ? error.message : error));
        }
        return true;
      default:
        if (await handlePanelGitHistoryMessage(
          message,
          vscodeApi.workspace.workspaceFolders?.[0]?.uri.fsPath,
          postMessage,
        )) return true;
        if (await handlePanelExportSaveMessage(
          message,
          vscodeApi,
          (payload) => webview.postMessage(payload),
        )) return true;
        return handlePanelExportResourceMessage(
          message,
          vscodeApi.workspace.workspaceFolders?.[0]?.uri.fsPath,
          (uri) => vscodeApi.Uri.parse(uri).fsPath,
          (payload) => webview.postMessage(payload),
        );
    }
  }

  return {
    handle,
    dispose: () => {
      insightsHost.dispose();
      externalHost.dispose();
    },
  };
}
