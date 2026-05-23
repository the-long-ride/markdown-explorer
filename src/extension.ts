// ============================================================
// extension.ts — VS Code extension entry point
// ============================================================

import * as vscode from 'vscode';
import { MarkdownDocsPanel } from './core/panel';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Markdown Explorer activated');

  // Register sidebar webview provider
  const provider = new MarkdownExplorerSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(MarkdownExplorerSidebarProvider.viewType, provider),
  );

  // Open the full docs viewer (all .md files)
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.open', () => {
      let filePath: string | null = null;
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const doc = editor.document;
        if (doc.languageId === 'markdown' || doc.fileName.endsWith('.md')) {
          filePath = doc.fileName;
        }
      }
      MarkdownDocsPanel.createOrShow(context, filePath);
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

class MarkdownExplorerSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'markdownExplorerSidebar';
  constructor(private readonly _context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri]
    };

    webviewView.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            padding: 20px;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
            gap: 12px;
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <div style="font-size: 32px;">🔍</div>
        <h3>Markdown Explorer</h3>
        <p>Click the button below to open the interactive Docs Viewer.</p>
        <button id="openBtn">Open Markdown Explorer</button>
        <script>
          const vscode = acquireVsCodeApi();
          document.getElementById('openBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'open' });
          });
          // Automatically trigger opening on load
          vscode.postMessage({ command: 'open' });
        </script>
      </body>
      </html>
    `;

    webviewView.webview.onDidReceiveMessage(message => {
      if (message.command === 'open') {
        vscode.commands.executeCommand('markdownExplorer.open');
      }
    });
  }
}
