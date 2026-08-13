import * as path from 'path';

import type { WebviewMessage } from '../types';
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

  async function handle(message: WebviewMessage): Promise<boolean> {
    switch (message.command) {
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
        return false;
    }
  }

  return { handle };
}
