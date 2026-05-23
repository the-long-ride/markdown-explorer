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
      if (initialFilePath) {
        void MarkdownDocsPanel.currentPanel._navigateTo(initialFilePath);
      }
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

    if (!this._currentFile && flat.length > 0) {
      const readme = flat.find(f => f.fileName.toLowerCase() === 'readme.md');
      this._currentFile = readme?.fsPath ?? flat[0].fsPath;
    }

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
    }
  }

  private async _sendContent(): Promise<void> {
    if (!this._currentFile || !this._flat.length) return;
    const fileInfo = this._flat.find(f => this._normPath(f.fsPath) === this._normPath(this._currentFile!));
    if (!fileInfo) return;

    const raw = WorkspaceScanner.readFile(this._currentFile);
    const { tokens, frontmatter } = parse(raw);
    const renderer = new HtmlRenderer();
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

  private async _navigateTo(href: string): Promise<void> {
    // Resolve relative .md links
    if (!path.isAbsolute(href)) {
      const dir = path.dirname(this._currentFile ?? '');
      href = path.resolve(dir, href.split('#')[0]);
    }

    const normHref = this._normPath(href);
    const found = this._flat.find(
      f => this._normPath(f.fsPath) === normHref || this._normPath(f.relativePath) === normHref,
    );

    if (found) {
      this._currentFile = found.fsPath;
      await this._sendContent();
    } else {
      await this._panel.webview.postMessage({ command: 'navNotFound', href });
    }
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
    const mdIconUri   = iconUri('markdown-icon.svg');

    const replacements: Record<string, string> = {
      '{{THEME}}': theme,
      '{{WORKSPACE_NAME}}': this._escHtml(workspaceName),
      '{{FILE_COUNT}}': String(flat.length),
      '{{NAV_ITEMS}}': navItems,
      '{{PANEL_CSS_URI}}': cssUri,
      '{{ICON_MOON_URI}}': moonIconUri,
      '{{ICON_SUN_URI}}': sunIconUri,
      '{{ICON_MD_URI}}': mdIconUri,
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
        onclick="Nav.go('${this._escAttr(file.fsPath)}')"
        title="${this._escAttr(file.relativePath)}"
        role="treeitem" tabindex="0"
        onkeydown="if(event.key==='Enter')Nav.go('${this._escAttr(file.fsPath)}')">
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
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
