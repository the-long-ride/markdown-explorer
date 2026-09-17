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

async function getPanel(): Promise<typeof import('./core/panel').MarkdownDocsPanel> {
  return (await import('./core/panel')).MarkdownDocsPanel;
}

async function isKnownSupportedFilePath(filePath: string): Promise<boolean> {
  return (await import('./core/documentConversion')).isKnownSupportedFilePath(filePath);
}

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
    vscode.commands.registerCommand('markdownExplorer.open', async () => {
      let filePath: string | null = null;
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const doc = editor.document;
        if (doc.languageId === 'markdown' || await isKnownSupportedFilePath(doc.fileName)) {
          filePath = doc.fileName;
        }
      }
      (await getPanel()).createOrShow(context, filePath);
    }),
  );

  // Open docs viewer focused on a specific file
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.openFile', async (uri?: import('vscode').Uri) => {
      let filePath: string | null = null;
      if (uri?.fsPath) {
        filePath = uri.fsPath;
      } else {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const doc = editor.document;
          if (doc.languageId === 'markdown' || await isKnownSupportedFilePath(doc.fileName)) {
            filePath = doc.fileName;
          }
        }
      }
      (await getPanel()).createOrShow(context, filePath);
    }),
  );

  // Open folder in Markdown Explorer
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.openFolder', async (uri?: import('vscode').Uri) => {
      let folderPath: string | null = null;
      if (uri?.fsPath) {
        folderPath = uri.fsPath;
      }
      (await getPanel()).createOrShow(context, folderPath);
    }),
  );

  // Toggle Docs Viewer
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.toggle', async () => {
      const panel = await getPanel();
      if (panel.currentPanel) {
        panel.currentPanel.dispose();
      } else {
        let filePath: string | null = null;
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const doc = editor.document;
          if (doc.languageId === 'markdown' || await isKnownSupportedFilePath(doc.fileName)) {
            filePath = doc.fileName;
          }
        }
        panel.createOrShow(context, filePath);
      }
    }),
  );

  // Refresh the viewer
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownExplorer.refresh', async () => {
      await (await getPanel()).currentPanel?.refresh();
    }),
  );

  // Auto-refresh on file save (banner-style: only re-scan sidebar; if the
  // saved file is the one currently displayed, the panel emits a
  // `currentFileChanged` message so the UI shows the banner without
  // clobbering the open document).
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      const config = vscode.workspace.getConfiguration('markdownExplorer');
      if (config.get<boolean>('autoRefresh') && await isKnownSupportedFilePath(doc.fileName)) {
        const savedPath = doc.uri?.fsPath ?? doc.fileName;
        (await getPanel()).currentPanel?.refreshFromWatch?.(savedPath);
      }
    }),
  );

  // Auto-refresh on supported file create / change / delete
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{md,mdx,doc,docx,pdf,html,xls,xlsx,xlm,pptx,odt,odp,ods,rtf,txt}');
  watcher.onDidCreate(async (uri) => {
    (await getPanel()).currentPanel?.refreshFromWatch?.(uri?.fsPath);
  });
  watcher.onDidChange(async (uri) => {
    (await getPanel()).currentPanel?.refreshFromWatch?.(uri?.fsPath);
  });
  watcher.onDidDelete(async () => (await getPanel()).currentPanel?.refresh());
  context.subscriptions.push(watcher);
}
