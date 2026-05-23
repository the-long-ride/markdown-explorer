// ============================================================
// extension.ts — VS Code extension entry point
// ============================================================

import * as vscode from 'vscode';
import { MarkdownDocsPanel } from './core/panel';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Markdown Explorer activated');

  // Open the full docs viewer (all .md files)
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.open', () => {
      MarkdownDocsPanel.createOrShow(context, null);
    }),
  );

  // Open docs viewer focused on a specific file
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.openFile', (uri?: vscode.Uri) => {
      let filePath: string | null = null;
      if (uri?.fsPath) {
        filePath = uri.fsPath;
      } else {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const doc = editor.document;
          if (doc.languageId === 'markdown' || doc.fileName.endsWith('.md')) {
            filePath = doc.fileName;
          }
        }
      }
      MarkdownDocsPanel.createOrShow(context, filePath);
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
          if (doc.languageId === 'markdown' || doc.fileName.endsWith('.md')) {
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

  // Auto-refresh on file save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const config = vscode.workspace.getConfiguration('markdownExplorer');
      if (config.get<boolean>('autoRefresh') && doc.fileName.endsWith('.md')) {
        MarkdownDocsPanel.currentPanel?.refresh();
      }
    }),
  );

  // Auto-refresh on .md file create / delete
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
  watcher.onDidCreate(() => MarkdownDocsPanel.currentPanel?.refresh());
  watcher.onDidDelete(() => MarkdownDocsPanel.currentPanel?.refresh());
  context.subscriptions.push(watcher);
}

export function deactivate(): void {}
