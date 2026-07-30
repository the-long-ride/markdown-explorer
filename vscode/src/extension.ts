// ============================================================
// extension.ts — VS Code extension entry point
// ============================================================

let _vscode: any = null;

function getVscode(): typeof import('vscode') {
  if (!_vscode) {
    _vscode = require('vscode');
  }
  return _vscode;
}

export function overrideVscodeForTest(mock: any): void {
  _vscode = mock;
}

import { MarkdownDocsPanel } from './core/panel';
import { isKnownSupportedFilePath } from './core/documentConversion';

export function activate(context: import('vscode').ExtensionContext): void {
  _doActivate(context, getVscode());
}

export function deactivate(): void {}

export function _doActivate(
  context: import('vscode').ExtensionContext,
  vscode: typeof import('vscode'),
): void {
  console.log('Markdown Explorer activated');

  // Open the full docs viewer (all .md files)
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.open', () => {
      let filePath: string | null = null;
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const doc = editor.document;
        if (doc.languageId === 'markdown' || isKnownSupportedFilePath(doc.fileName)) {
          filePath = doc.fileName;
        }
      }
      MarkdownDocsPanel.createOrShow(context, filePath);
    }),
  );

  // Open docs viewer focused on a specific file
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.openFile', (uri?: import('vscode').Uri) => {
      let filePath: string | null = null;
      if (uri?.fsPath) {
        filePath = uri.fsPath;
      } else {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const doc = editor.document;
          if (doc.languageId === 'markdown' || isKnownSupportedFilePath(doc.fileName)) {
            filePath = doc.fileName;
          }
        }
      }
      MarkdownDocsPanel.createOrShow(context, filePath);
    }),
  );

  // Open folder in Markdown Explorer
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.openFolder', (uri?: import('vscode').Uri) => {
      let folderPath: string | null = null;
      if (uri?.fsPath) {
        folderPath = uri.fsPath;
      }
      MarkdownDocsPanel.createOrShow(context, folderPath);
    }),
  );

  // Toggle Docs Viewer
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.toggle', () => {
      if (MarkdownDocsPanel.currentPanel) {
        MarkdownDocsPanel.currentPanel.dispose();
      } else {
        let filePath: string | null = null;
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const doc = editor.document;
          if (doc.languageId === 'markdown' || isKnownSupportedFilePath(doc.fileName)) {
            filePath = doc.fileName;
          }
        }
        MarkdownDocsPanel.createOrShow(context, filePath);
      }
    }),
  );

  // Refresh the viewer
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.refresh', () => {
      MarkdownDocsPanel.currentPanel?.refresh();
    }),
  );

  // Auto-refresh on file save (banner-style: only re-scan sidebar; if the
  // saved file is the one currently displayed, the panel emits a
  // `currentFileChanged` message so the UI shows the banner without
  // clobbering the open document).
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const config = vscode.workspace.getConfiguration('markdownExplorer');
      if (config.get<boolean>('autoRefresh') && isKnownSupportedFilePath(doc.fileName)) {
        const savedPath = doc.uri?.fsPath ?? doc.fileName;
        MarkdownDocsPanel.currentPanel?.refreshFromWatch?.(savedPath);
      }
    }),
  );

  // Auto-refresh on supported file create / change / delete
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{md,mdx,doc,docx,pdf,html,xls,xlsx,xlm,pptx,odt,odp,ods,rtf,txt}');
  watcher.onDidCreate((uri) => {
    MarkdownDocsPanel.currentPanel?.refreshFromWatch?.(uri?.fsPath);
  });
  watcher.onDidChange((uri) => {
    MarkdownDocsPanel.currentPanel?.refreshFromWatch?.(uri?.fsPath);
  });
  watcher.onDidDelete(() => MarkdownDocsPanel.currentPanel?.refresh());
  context.subscriptions.push(watcher);
}
