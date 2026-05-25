// =============================================================================
// core/panel.ts — WebviewPanel: UI shell + message bridge
// =============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { WorkspaceScanner } from './scanner';
import { parse } from '../markdown/parser';
import { HtmlRenderer } from '../markdown/renderer';
import { renderButton } from '../utils';
import type {
  MdFile,
  FolderNode,
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
          vscode.Uri.file(path.join(context.extensionPath, 'media')),
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

    this._panel.webview.html = this._buildShell(tree, flat, workspaceName);
  }

  // ---------------------------------------------------------------------------
  // Private: send rendered content to webview
  // ---------------------------------------------------------------------------

  private async _onWebviewReady(): Promise<void> {
    const config = vscode.workspace.getConfiguration('markdownExplorer');
    const theme = config.get<string>('theme') ?? 'auto';
    const defaultExpanded = config.get<boolean>('defaultExpanded') ?? true;

    const ackMsg: ReadyAckMessage = {
      command: 'readyAck',
      fileList: this._flat,
      theme,
      defaultExpanded,
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
          to quickly toggle the Markdown Explorer view on a markdown file. Navigate back and forward between documents using the arrow buttons in the topbar or <kbd>Alt+Left</kbd> and <kbd>Alt+Right</kbd>.
        </div>
      </div>

    </div>
  </div>
</div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Private: HTML shell
  // The webview HTML lives in media/panel.html as a static template.
  // Dynamic values are injected by replacing {{PLACEHOLDER}} tokens.
  // ---------------------------------------------------------------------------

  private _buildShell(tree: FolderNode, flat: MdFile[], workspaceName: string): string {
    const config = vscode.workspace.getConfiguration('markdownExplorer');
    const theme = config.get<string>('theme') ?? 'auto';
    const navItems = this._renderNode(tree, 0);

    const templatePath = path.join(this._extensionPath, 'media', 'panel.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    const cssUri = this._panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this._extensionPath, 'media', 'panel.css'))
    ).toString();

    const iconUri = (name: string) => this._panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this._extensionPath, 'media', 'icons', name))
    ).toString();

    const moonIconUri = iconUri('moon-icon.svg');
    const sunIconUri  = iconUri('day-sunny-icon.svg');
    const logoUri = this._panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this._extensionPath, 'media', 'logos', 'logo-128.png'))
    ).toString();

    const replacements: Record<string, string> = {
      '{{THEME}}': theme,
      '{{WORKSPACE_NAME}}': this._escHtml(workspaceName),
      '{{FILE_COUNT}}': String(flat.length),
      '{{NAV_ITEMS}}': navItems,
      '{{PANEL_CSS_URI}}': cssUri,
      '{{ICON_MOON_URI}}': moonIconUri,
      '{{ICON_SUN_URI}}': sunIconUri,
      '{{ICON_MD_URI}}': logoUri,
      '{{HOME_BTN}}': renderButton({
        id: 'homeBtn', className: 'btn btn--icon', onClick: 'Nav.go(null)',
        label: 'Welcome Page', tooltipPos: 'below',
        iconHtml: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 113.97" width="13" height="13" fill="currentColor"><path d="M18.69,73.37,59.18,32.86c2.14-2.14,2.41-2.23,4.63,0l40.38,40.51V114h-30V86.55a3.38,3.38,0,0,0-3.37-3.37H52.08a3.38,3.38,0,0,0-3.37,3.37V114h-30V73.37ZM60.17.88,0,57.38l14.84,7.79,42.5-42.86c3.64-3.66,3.68-3.74,7.29-.16l43.41,43,14.84-7.79L62.62.79c-1.08-1-1.24-1.13-2.45.09Z" fill-rule="evenodd"/></svg>',
      }),
      '{{BACK_BTN}}': renderButton({
        id: 'backBtn', className: 'btn btn--icon', onClick: 'DocHistory.back()',
        label: 'Go Back', disabled: true, tooltipPos: 'below',
        iconHtml: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>',
      }),
      '{{FORWARD_BTN}}': renderButton({
        id: 'forwardBtn', className: 'btn btn--icon', onClick: 'DocHistory.forward()',
        label: 'Go Forward', disabled: true, tooltipPos: 'below',
        iconHtml: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>',
      }),
      '{{EXPAND_ALL_BTN}}': renderButton({
        className: 'btn', onClick: 'UI.expandAll()', label: 'Expand All', onlyIcon: true, tooltipPos: 'below',
        iconHtml: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>',
      }),
      '{{COLLAPSE_ALL_BTN}}': renderButton({
        className: 'btn', onClick: 'UI.collapseAll()', label: 'Collapse All', tooltip: 'Collapse', onlyIcon: true, tooltipPos: 'below',
        iconHtml: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>',
      }),
      '{{EDIT_BTN}}': renderButton({
        className: 'btn', onClick: 'Nav.openInEditor()', label: 'Edit', tooltip: 'Open current file in editor', tooltipPos: 'below',
        iconHtml: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
      }),
      '{{THEME_BTN}}': renderButton({
        id: 'themeBtn', className: 'btn btn--icon', onClick: 'UI.toggleTheme()', label: 'Toggle Theme', tooltipPos: 'below',
        iconHtml: `<img id="themeBtnIcon" src="${moonIconUri}" width="14" height="14" alt="theme" style="opacity:0.8;filter:invert(0)" />`,
      }),
      '{{SETTINGS_BTN}}': renderButton({
        id: 'settingsBtn', className: 'btn btn--icon', onClick: 'UI.openSettings()', label: 'Settings', tooltipPos: 'below',
        iconHtml: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
      }),
      '{{TOGGLE_SIDEBAR_BTN}}': renderButton({
        className: 'btn btn--icon', onClick: 'UI.toggleSidebar()', label: 'Toggle Sidebar', tooltipPos: 'below',
        iconHtml: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>',
      }),
      '{{SCROLL_TO_TOP_BTN}}': renderButton({
        id: 'scrollToTopBtn', className: 'scroll-to-top-btn', onClick: 'UI.scrollToTop()',
        label: 'Scroll to Top', onlyIcon: true, tooltipPos: 'above',
        iconHtml: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>',
      }),
      '{{MEDIA_CLOSE_BTN}}': renderButton({
        className: 'mdn-modal-close', onClick: 'ModalViewer.close()', label: 'Close modal', tooltip: 'Close', onlyIcon: true, tooltipPos: 'below', iconHtml: '&times;',
      }),
      '{{MEDIA_PREV_BTN}}': renderButton({
        className: 'mdn-modal-btn mdn-modal-btn--prev', onClick: 'ModalViewer.prev()', label: 'Previous media', tooltip: 'Previous', onlyIcon: true, tooltipPos: 'above',
        iconHtml: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
      }),
      '{{MEDIA_NEXT_BTN}}': renderButton({
        className: 'mdn-modal-btn mdn-modal-btn--next', onClick: 'ModalViewer.next()', label: 'Next media', tooltip: 'Next', onlyIcon: true, tooltipPos: 'above',
        iconHtml: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
      }),
      '{{ZOOM_IN_BTN}}': renderButton({
        className: 'mdn-modal-tool', onClick: 'ModalViewer.zoomIn()', label: 'Zoom In', onlyIcon: true, tooltipPos: 'above',
        iconHtml: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
      }),
      '{{ZOOM_OUT_BTN}}': renderButton({
        className: 'mdn-modal-tool', onClick: 'ModalViewer.zoomOut()', label: 'Zoom Out', onlyIcon: true, tooltipPos: 'above',
        iconHtml: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
      }),
      '{{RESET_ZOOM_BTN}}': renderButton({
        className: 'mdn-modal-tool', onClick: 'ModalViewer.reset()', label: 'Reset Zoom', onlyIcon: true, tooltipPos: 'above',
        iconHtml: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>',
      }),
    };

    for (const [token, value] of Object.entries(replacements)) {
      html = html.split(token).join(value);
    }

    return html;
  }

  // ---------------------------------------------------------------------------
  // Private: nav HTML builder
  // ---------------------------------------------------------------------------

  private _renderNode(node: FolderNode, depth: number): string {
    let html = '';

    for (const file of node.files) {
      html += `<div class="tree-file"
        data-path="${this._escAttr(file.fsPath)}"
        data-title="${this._escAttr(file.title)}"
        data-filename="${this._escAttr(file.fileName)}"
        onclick="Nav.go('${this._escAttr(file.fsPath)}')"
        title="${this._escAttr(file.relativePath)}"
        role="treeitem" tabindex="0"
        onkeydown="if(event.key==='Enter')Nav.go('${this._escAttr(file.fsPath)}')">
        <span class="tree-file__name">${this._escHtml(file.title)}</span>
      </div>`;
    }

    for (const child of node.children) {
      html += `<div class="tree-folder is-open" role="treeitem">
        <div class="tree-folder__header" onclick="Sidebar.toggleFolder(this)"
             role="button" tabindex="0" aria-expanded="true">
          <span class="tree-folder__chevron" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._escHtml(child.name)}</span>
        </div>
        <div class="tree-folder__children" role="group">${this._renderNode(child, depth + 1)}</div>
      </div>`;
    }

    return html;
  }

  private _escAttr(s: string): string {
    return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  private _escHtml(s: string): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
