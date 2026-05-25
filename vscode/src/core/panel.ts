// =============================================================================
// core/panel.ts — WebviewPanel: UI shell + message bridge
// =============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { WorkspaceScanner } from './scanner';
import { parse } from '../markdown/parser';
import { HtmlRenderer } from '../markdown/renderer';
import type {
  MdFile,
  RenderContentMessage,
  ReadyAckMessage,
  WebviewMessage,
} from '../types';

export class MarkdownDocsPanel {
  static currentPanel: MarkdownDocsPanel | undefined;
  private static readonly VIEW_TYPE = 'markdownExplorer';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _currentFile: string | null;
  private _flat: MdFile[] = [];
  private readonly _disposables: vscode.Disposable[] = [];

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static createOrShow(context: vscode.ExtensionContext, initialFilePath: string | null): void {
    const column = vscode.ViewColumn.Active;

    if (MarkdownDocsPanel.currentPanel) {
      MarkdownDocsPanel.currentPanel._panel.reveal(column);
      void MarkdownDocsPanel.currentPanel._navigateTo(initialFilePath);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      MarkdownDocsPanel.VIEW_TYPE,
      'Markdown Explorer',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'ui')),
          ...(vscode.workspace.workspaceFolders?.map(f => f.uri) ?? []),
        ],
      },
    );

    MarkdownDocsPanel.currentPanel = new MarkdownDocsPanel(panel, context, initialFilePath);
  }

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  private constructor(
    panel: vscode.WebviewPanel,
    _context: vscode.ExtensionContext,
    initialFilePath: string | null,
  ) {
    this._panel = panel;
    this._extensionPath = _context.extensionPath;
    this._currentFile = initialFilePath;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (msg: WebviewMessage) => {
        switch (msg.command) {
          case 'navigate':
            await this._navigateTo(msg.path);
            break;
          case 'openInEditor':
            if (msg.path) {
              const doc = await vscode.workspace.openTextDocument(msg.path);
              await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            }
            break;
          case 'ready':
            await this._onWebviewReady();
            break;
          case 'copyCode':
            await vscode.env.clipboard.writeText(msg.text);
            break;
          case 'refresh':
            await this.refresh();
            break;
        }
      },
      null,
      this._disposables,
    );

    void this._render();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async refresh(): Promise<void> {
    await this._render();
  }

  // ---------------------------------------------------------------------------
  // Private: scan + build shell
  // ---------------------------------------------------------------------------

  private async _render(): Promise<void> {
    const { tree, flat } = await WorkspaceScanner.scan();
    this._flat = flat;

    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? 'Workspace';
    this._panel.title = `Markdown Explorer — ${workspaceName}`;

    // Do not auto-initialize _currentFile to allow showing the Welcome page by default when null

    if (!this._panel.webview.html) {
      this._panel.webview.html = this._buildShell();
    } else {
      // Send updated data to the already running webview
      const config = vscode.workspace.getConfiguration('markdownExplorer');
      const theme = config.get<string>('theme') ?? 'auto';
      const defaultExpanded = config.get<boolean>('defaultExpanded') ?? true;
      const ackMsg: ReadyAckMessage = {
        command: 'readyAck',
        fileList: this._flat,
        tree,
        theme,
        defaultExpanded,
        workspaceName,
      };
      await this._panel.webview.postMessage(ackMsg);
      if (this._currentFile) {
        await this._sendContent();
      } else {
        await this._sendWelcome();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private: send rendered content to webview
  // ---------------------------------------------------------------------------

  private async _onWebviewReady(): Promise<void> {
    const config = vscode.workspace.getConfiguration('markdownExplorer');
    const theme = config.get<string>('theme') ?? 'auto';
    const defaultExpanded = config.get<boolean>('defaultExpanded') ?? true;
    const { tree, flat } = await WorkspaceScanner.scan();
    this._flat = flat;
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? 'Workspace';

    const ackMsg: ReadyAckMessage = {
      command: 'readyAck',
      fileList: this._flat,
      tree,
      theme,
      defaultExpanded,
      workspaceName,
    };
    await this._panel.webview.postMessage(ackMsg);

    if (this._currentFile) {
      await this._sendContent();
    } else {
      await this._sendWelcome();
    }
  }

  private async _sendContent(): Promise<void> {
    if (!this._currentFile) return;
    let fileInfo = this._flat.find(f => this._normPath(f.fsPath) === this._normPath(this._currentFile!));
    if (!fileInfo) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const rootPath = workspaceFolder?.uri.fsPath ?? '';
      const relativePath = rootPath ? path.relative(rootPath, this._currentFile) : path.basename(this._currentFile);
      fileInfo = {
        fsPath: this._currentFile,
        relativePath,
        parts: relativePath.split(path.sep),
        fileName: path.basename(this._currentFile),
        title: path.basename(this._currentFile).replace(/\.(md|mdx)$/i, ''),
      };
    }

    const raw = WorkspaceScanner.readFile(this._currentFile);
    const isMdx = this._currentFile.endsWith('.mdx');
    const { tokens, frontmatter } = parse(raw, isMdx);
    const config = vscode.workspace.getConfiguration('markdownExplorer');
    const theme = config.get<string>('theme') ?? 'auto';
    const renderer = new HtmlRenderer({ theme, isMdx });
    const { html, toc } = renderer.render(tokens);

    // Rewrite relative image paths to Webview URIs
    let rewrittenHtml = html;
    const imgRegex = /<img\s+([^>]*?)src="([^"]+?)"/g;
    rewrittenHtml = rewrittenHtml.replace(imgRegex, (match, before, src) => {
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('vscode-webview:')) {
        return match;
      }
      try {
        const fileDir = path.dirname(this._currentFile!);
        const absolutePath = path.resolve(fileDir, src);
        const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(absolutePath));
        return `<img ${before}src="${webviewUri.toString()}"`;
      } catch (err) {
        console.error('Failed to resolve relative image path:', src, err);
        return match;
      }
    });

    const msg: RenderContentMessage = {
      command: 'renderContent',
      html: rewrittenHtml,
      frontmatter,
      toc,
      filePath: this._currentFile,
      relativePath: fileInfo.relativePath,
      title: fileInfo.title,
      fileList: this._flat,
    };
    await this._panel.webview.postMessage(msg);
  }

  // ---------------------------------------------------------------------------
  // Private: navigation
  // ---------------------------------------------------------------------------

  /** Normalize path for case-insensitive, separator-agnostic comparison (Windows-safe). */
  private _normPath(p: string): string {
    return p.toLowerCase().replace(/\\/g, '/');
  }

  private async _navigateTo(href: string | null): Promise<void> {
    if (!href) {
      this._currentFile = null;
      await this._sendWelcome();
      return;
    }

    try {
      href = decodeURIComponent(href);
    } catch {
      // ignore
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const rootPath = workspaceFolder?.uri.fsPath ?? '';
    const dir = this._currentFile ? path.dirname(this._currentFile) : rootPath;

    let resolvedPath = href.split('#')[0];
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.resolve(dir, resolvedPath);
    }

    // Check if the resolved file actually exists on disk
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      this._currentFile = resolvedPath;
      await this._sendContent();
      return;
    }

    const normHref = this._normPath(resolvedPath);
    const found = this._flat.find(
      f => this._normPath(f.fsPath) === normHref || this._normPath(f.relativePath) === normHref,
    );

    if (found) {
      this._currentFile = found.fsPath;
      await this._sendContent();
    } else {
      await this._panel.webview.postMessage({ command: 'navNotFound', href: resolvedPath });
    }
  }

  private async _sendWelcome(): Promise<void> {
    const msg: RenderContentMessage = {
      command: 'renderContent',
      html: '',
      frontmatter: {},
      toc: [],
      filePath: '',
      relativePath: 'Welcome Page',
      title: 'Welcome',
      fileList: this._flat,
    };
    await this._panel.webview.postMessage(msg);
  }

  // ---------------------------------------------------------------------------
  // Private: HTML shell
  // Loads built React assets from ui/dist/index.html and configures CSP + base href.
  // ---------------------------------------------------------------------------

  private _buildShell(): string {
    const distPath = path.join(this._extensionPath, 'ui', 'dist');
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Markdown Explorer UI Not Found</title>
        </head>
        <body style="font-family: sans-serif; padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background);">
          <h2>Markdown Explorer UI has not been built.</h2>
          <p>Please run <code>npm run build</code> in the <code>ui/</code> folder or <code>npm run compile</code> in the extension folder to build the UI assets.</p>
        </body>
        </html>
      `;
    }

    let html = fs.readFileSync(indexPath, 'utf8');

    // CSP and Base Href
    const cspSource = this._panel.webview.cspSource;
    const csp = `default-src 'none'; style-src 'unsafe-inline' ${cspSource}; script-src 'unsafe-inline' blob: ${cspSource}; worker-src blob:; img-src * data: blob: ${cspSource}; frame-src 'self' data: ${cspSource}; connect-src *;`;
    const baseUri = this._panel.webview.asWebviewUri(vscode.Uri.file(distPath));

    // Inject base href and CSP into the <head> section
    const headInjection = `
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <base href="${baseUri.toString()}/" />`;

    html = html.replace('<head>', `<head>${headInjection}`);

    return html;
  }

  // ---------------------------------------------------------------------------
  // Dispose
  // ---------------------------------------------------------------------------

  dispose(): void {
    MarkdownDocsPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables.length = 0;
  }
}
