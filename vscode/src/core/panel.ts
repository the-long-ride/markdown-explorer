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
    const welcomeHtml = this._buildWelcomeHtml();
    const msg: RenderContentMessage = {
      command: 'renderContent',
      html: welcomeHtml,
      frontmatter: {},
      toc: [],
      filePath: '',
      relativePath: 'Welcome Page',
      title: 'Welcome',
      fileList: this._flat,
    };
    await this._panel.webview.postMessage(msg);
  }

  private _buildWelcomeHtml(): string {
    return `
<div class="welcome-container" style="max-width: 800px; margin: 0 auto; padding: 20px 10px; font-family: var(--font-ui);">
  <!-- Hero Section -->
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 2.2em; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 8px; color: var(--tx);">Welcome to Markdown Explorer</h1>
    <p style="font-size: 1.15em; color: var(--tx2); margin-bottom: 12px; line-height: 1.5;">A premium, local-first documentation viewer and navigator for Visual Studio Code.</p>
    <div style="font-size: 0.95em; color: var(--tx2);">
      Created by <a href="https://github.com/the-long-ride" target="_blank" rel="noopener noreferrer" style="color: var(--accent-text); text-decoration: none; font-weight: 600;">the-long-ride</a> · 
      Repository: <a href="https://github.com/the-long-ride/vscode-extension-markdown-explorer" target="_blank" rel="noopener noreferrer" style="color: var(--accent-text); text-decoration: none; font-weight: 600;">vscode-extension-markdown-explorer</a> · 
      License: <a href="https://github.com/the-long-ride/vscode-extension-markdown-explorer/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" style="color: var(--accent-text); text-decoration: none; font-weight: 600;">MIT</a>
    </div>
  </div>

  <!-- Privacy Pledge -->
  <div style="background: rgba(52, 211, 153, 0.07); border: 1px solid rgba(52, 211, 153, 0.35); border-radius: var(--r-lg); padding: 16px 20px; margin-bottom: 32px;">
    <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--success); margin-bottom: 8px;">
      <span>🔒 100% Private, Offline-First & Independent</span>
    </div>
    <div style="font-size: 12.5px; line-height: 1.6; color: var(--tx2);">
      We believe your documentation should be kept completely private. 
      <strong>Markdown Explorer</strong> operates entirely on your local machine:
      <ul style="margin: 8px 0 0 20px; padding: 0; list-style-type: disc;">
        <li style="margin-bottom: 4px;"><strong>No Tracking & No Telemetry</strong>: We do not collect or send any usage data, analytics, or keystrokes.</li>
        <li style="margin-bottom: 4px;"><strong>No External Libraries</strong>: This extension does not package or load any third-party external trackers, analytic scripts, or telemetry libraries.</li>
        <li style="margin-bottom: 0;"><strong>100% Offline Support</strong>: All markdown parsing, scanning, rendering, and quick search indexing are executed locally with zero remote dependencies.</li>
      </ul>
    </div>
  </div>

  <!-- Feature Guidelines -->
  <div style="margin-bottom: 32px;">
    <h2 style="font-size: 1.4em; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid var(--bd-s); padding-bottom: 6px; color: var(--tx);">How to Use All Features</h2>
    
    <div style="display: grid; grid-template-columns: 1fr; gap: 16px;">
      
      <!-- Feature 1 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">📁 Workspace Navigation Tree</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          The left sidebar displays an interactive folder structure scanning all markdown files in your workspace. Simply click any file to open it in preview mode. You can filter files by name using the search bar at the top of the sidebar.
        </div>
      </div>

      <!-- Feature 2 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">🔍 Instant Quick Search (<kbd>Ctrl+K</kbd>)</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Press <kbd>Ctrl+K</kbd> (or <kbd>Cmd+K</kbd> on Mac) from anywhere in the preview window to open the quick search overlay. Type a query to search across all markdown file names instantly. Use the mouse or keyboard to select and open a file.
        </div>
      </div>

      <!-- Feature 3 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">📋 Excel-Style Interactive Data Tables</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Standard markdown tables are automatically converted to interactive tables. You can sort columns by clicking their headers, use the funnel icon on headers to filter rows by values, and type inside the search bar above the table to search row contents.
        </div>
      </div>

      <!-- Feature 4 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">📊 One-Click Table-to-Chart Switcher</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          For tables containing numeric columns, a view switcher will appear. Click the <strong>Bar</strong>, <strong>Line</strong>, or <strong>Pie</strong> buttons to instantly visualize the table data as an interactive Chart.js chart.
        </div>
      </div>

      <!-- Feature 5 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">🎨 Syntax Highlighting & Mermaid Diagrams</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Enjoy high-contrast, premium syntax highlighting for code blocks (TypeScript, JavaScript, etc.) with custom overrides for comments and optional properties. Markdown Explorer also natively renders standard <code>mermaid</code> code blocks into responsive sequence, flowchart, and class diagrams.
        </div>
      </div>

      <!-- Feature 6 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">🖼️ Zoomable Backdrop Media Modal</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Click any image or diagram within your documents to launch a premium backdrop-blur modal. You can scroll to zoom in/out, click and drag to pan across high-res graphics, or use the arrow keys to cycle through all images in the document.
        </div>
      </div>

      <!-- Feature 7 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">⌨️ Keyboard Shortcuts & Navigation</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Use <kbd>Ctrl+Shift+M</kbd> (<kbd>Cmd+Shift+M</kbd> on Mac) to open Markdown Explorer, and <kbd>Ctrl+Alt+V</kbd> (<kbd>Cmd+Alt+V</kbd> on Mac) or click the editor title button 
          <span style="display: inline-flex; align-items: center; justify-content: center; background: rgba(128, 128, 128, 0.15); border: 1px solid var(--bd-s); border-radius: 4px; padding: 2px 4px; margin-left: 2px; vertical-align: middle;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 180" style="width: 14px; height: 10px; display: block;">
              <g transform="translate(10, 10)">
                <rect x="10" y="10" width="188" height="108" rx="15" ry="15" stroke="currentColor" stroke-width="12" fill="none" />
                <path d="M30 90 V30 h20 l20 25 l20-25 h20 v60 h-18 V55 l-17 22 h-10 l-17-22 v35 H30 Z" fill="currentColor" />
                <path d="M 155 90 l -25 -30 h 15 v -30 h 20 v 30 h 15 z" fill="currentColor" />
                <circle cx="185" cy="105" r="32" fill="transparent" />
                <circle cx="185" cy="105" r="26" stroke="currentColor" stroke-width="10" fill="transparent" />
                <path d="M 168 95 A 18 18 0 0 1 192 85" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.2"/>
                <line x1="203" y1="123" x2="235" y2="155" stroke="currentColor" stroke-width="16" stroke-linecap="round" />
              </g>
            </svg>
          </span>
          to quickly toggle the Markdown Explorer view on a markdown file.
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; color: var(--tx2);">
            <thead>
              <tr style="border-bottom: 1px solid var(--bd-s); text-align: left;">
                <th style="padding: 4px 8px 4px 0; font-weight: 600;">Action</th>
                <th style="padding: 4px 8px; font-weight: 600;">Default Shortcut</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Back to previous file</td><td style="padding: 4px 8px;"><kbd>Ctrl+←</kbd> (or <kbd>Cmd+←</kbd>) or Mouse Back button</td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Go to next file</td><td style="padding: 4px 8px;"><kbd>Ctrl+→</kbd> (or <kbd>Cmd+→</kbd>) or Mouse Forward button</td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Go to welcome page</td><td style="padding: 4px 8px;"><kbd>Ctrl+H</kbd></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Open settings modal</td><td style="padding: 4px 8px;"><kbd>Ctrl+I</kbd></td></tr>
              <tr><td style="padding: 4px 8px 4px 0;">Toggle light/dark mode</td><td style="padding: 4px 8px;"><kbd>Ctrl+Shift+L</kbd></td></tr>
            </tbody>
          </table>
          <div style="margin-top: 8px; font-style: italic; font-size: 10.5px;">Note: You can change all keyboard shortcuts from the **Settings Modal** (click settings button or press <kbd>Ctrl+I</kbd>).</div>
        </div>
      </div>

    </div>
  </div>
</div>
    `;
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
    const csp = `default-src 'none'; style-src 'unsafe-inline' ${cspSource}; script-src 'unsafe-inline' ${cspSource}; img-src * data: ${cspSource}; frame-src 'self' data: ${cspSource}; connect-src *;`;
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
