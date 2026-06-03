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
  WorkspaceSearchResult,
} from '../types';

export class MarkdownDocsPanel {
  static currentPanel: MarkdownDocsPanel | undefined;
  private static readonly VIEW_TYPE = 'markdownExplorer';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private readonly _extensionVersion: string;
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
    this._extensionVersion = String(_context.extension.packageJSON.version ?? '');
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
          case 'openExternal':
            if (/^https?:\/\//i.test(msg.url)) {
              await vscode.env.openExternal(vscode.Uri.parse(msg.url));
            }
            break;
          case 'refresh':
            await this.refresh();
            break;
          case 'searchWorkspace':
            await this._panel.webview.postMessage({
              command: 'workspaceSearchResults',
              requestId: msg.requestId,
              results: this._searchMarkdownItems(msg.query, msg.items),
            });
            break;
          case 'updateAppearance': {
            const config = vscode.workspace.getConfiguration('markdownExplorer');
            await config.update('theme', msg.theme, vscode.ConfigurationTarget.Global);
            await config.update('themeStyle', msg.themeStyle, vscode.ConfigurationTarget.Global);
            break;
          }
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
    await this._sendLoading();
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
      const themeStyle = config.get<string>('themeStyle') ?? 'default';
      const defaultExpanded = config.get<boolean>('defaultExpanded') ?? true;
      const ackMsg: ReadyAckMessage = {
        command: 'readyAck',
        fileList: this._flat,
        tree,
        theme,
        themeStyle,
        defaultExpanded,
        workspaceName,
        ...this._hostInfo(),
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
    const themeStyle = config.get<string>('themeStyle') ?? 'default';
    const defaultExpanded = config.get<boolean>('defaultExpanded') ?? true;
    const { tree, flat } = await WorkspaceScanner.scan();
    this._flat = flat;
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? 'Workspace';

    const ackMsg: ReadyAckMessage = {
      command: 'readyAck',
      fileList: this._flat,
      tree,
      theme,
      themeStyle,
      defaultExpanded,
      workspaceName,
      ...this._hostInfo(),
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

    // Rewrite local image/video paths to Webview URIs.
    const rewrittenHtml = this._rewriteRelativeMediaUrls(html);

    const msg: RenderContentMessage = {
      command: 'renderContent',
      html: rewrittenHtml,
      markdownSource: raw,
      frontmatter,
      toc,
      filePath: this._currentFile,
      relativePath: fileInfo.relativePath,
      title: fileInfo.title,
      fileList: this._flat,
    };
    await this._panel.webview.postMessage(msg);
  }

  private async _sendLoading(): Promise<void> {
    await this._panel.webview.postMessage({ command: 'setLoading' });
  }

  private _makeSearchExcerpt(text: string, index: number, queryLength: number): string {
    const beforeText = text.slice(0, index).replace(/\s+/g, ' ').trim();
    const matchText = text.slice(index, index + queryLength).replace(/\s+/g, ' ').trim();
    const afterText = text.slice(index + queryLength).replace(/\s+/g, ' ').trim();
    const beforeWords = beforeText ? beforeText.split(' ') : [];
    const afterWords = afterText ? afterText.split(' ') : [];
    const parts: string[] = [];

    if (beforeWords.length > 10) parts.push('...');
    parts.push(...beforeWords.slice(-10));
    if (matchText) parts.push(matchText);
    parts.push(...afterWords.slice(0, 10));
    if (afterWords.length > 10) parts.push('...');

    return parts.join(' ').trim();
  }

  private _hostInfo() {
    return {
      appVersion: this._extensionVersion,
      appRuntime: 'vscode' as const,
      hostPlatform: this._hostPlatform(),
      hostArch: process.arch,
    };
  }

  private _hostPlatform() {
    if (process.platform === 'win32') return 'windows' as const;
    if (process.platform === 'darwin') return 'macos' as const;
    if (process.platform === 'linux') return 'linux' as const;
    return 'unknown' as const;
  }

  private _searchMarkdownItems(
    rawQuery: string,
    rawItems?: readonly WorkspaceSearchResult[],
    limit = 80,
  ): readonly WorkspaceSearchResult[] {
    const query = String(rawQuery || '').trim().toLowerCase();
    if (!query || query.length < 2) return [];

    const items = rawItems && rawItems.length > 0 ? rawItems : this._flat;
    const results: Array<WorkspaceSearchResult & { score: number }> = [];
    const maxMatchesPerFile = 8;

    for (const item of items) {
      if (!item.fsPath || !fs.existsSync(item.fsPath)) continue;
      const ext = path.extname(item.fsPath).toLowerCase();
      if (ext !== '.md' && ext !== '.mdx') continue;

      const fileName = item.fileName || path.basename(item.fsPath);
      const relativePath = item.relativePath || fileName;
      const title = item.title || fileName.replace(/\.(md|mdx)$/i, '');
      const titleScore = title.toLowerCase().includes(query) ? 5 : 0;
      const fileNameScore = fileName.toLowerCase().includes(query) ? 4 : 0;
      const pathScore = relativePath.toLowerCase().includes(query) ? 2 : 0;
      const baseScore = titleScore + fileNameScore + pathScore;
      const contentMatches: Array<{ index: number; ordinal: number; excerpt: string }> = [];

      const raw = WorkspaceScanner.readFile(item.fsPath);
      if (raw) {
        const lowerRaw = raw.toLowerCase();
        let index = lowerRaw.indexOf(query);
        let ordinal = 0;
        while (index !== -1 && contentMatches.length < maxMatchesPerFile) {
          contentMatches.push({
            index,
            ordinal,
            excerpt: this._makeSearchExcerpt(raw, index, query.length),
          });
          ordinal += 1;
          index = lowerRaw.indexOf(query, index + query.length);
        }
      }

      if (contentMatches.length > 0) {
        for (const match of contentMatches) {
          results.push({
            fsPath: item.fsPath,
            title,
            fileName,
            relativePath,
            excerpt: match.excerpt,
            matchIndex: match.index,
            matchOrdinal: match.ordinal,
            score: baseScore + 3 - Math.min(match.ordinal, 20) / 100,
          });
        }
        continue;
      }

      if (baseScore > 0) {
        results.push({
          fsPath: item.fsPath,
          title,
          fileName,
          relativePath,
          excerpt: '',
          score: baseScore,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(({ score, ...result }) => result);
  }

  private _shouldKeepResourceUrl(src: string): boolean {
    return /^(https?:|data:|blob:|vscode-webview:|#)/i.test(src);
  }

  private _toWebviewResourceUri(src: string): string {
    if (this._shouldKeepResourceUrl(src)) return src;
    const fileDir = path.dirname(this._currentFile!);
    const absolutePath = path.resolve(fileDir, src);
    return this._panel.webview.asWebviewUri(vscode.Uri.file(absolutePath)).toString();
  }

  private _rewriteRelativeMediaUrls(html: string): string {
    const srcAttrRegex = /(<(?:img|video|source|track)\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi;
    const posterAttrRegex = /(<video\b[^>]*?\bposter\s*=\s*)(["'])([^"']+)(\2)/gi;

    const rewriteAttr = (match: string, prefix: string, quote: string, src: string, suffix: string) => {
      try {
        return `${prefix}${quote}${this._toWebviewResourceUri(src)}${suffix}`;
      } catch (err) {
        console.error('Failed to resolve relative media path:', src, err);
        return match;
      }
    };

    return html
      .replace(srcAttrRegex, rewriteAttr)
      .replace(posterAttrRegex, rewriteAttr);
  }

  // ---------------------------------------------------------------------------
  // Private: navigation
  // ---------------------------------------------------------------------------

  /** Normalize path for case-insensitive, separator-agnostic comparison (Windows-safe). */
  private _normPath(p: string): string {
    return p.toLowerCase().replace(/\\/g, '/');
  }

  private _stripNavigationFragment(href: string): string {
    const hashIndex = href.indexOf('#');
    return hashIndex === -1 ? href : href.slice(0, hashIndex);
  }

  private _decodeNavigationHref(href: string): string {
    try {
      return decodeURIComponent(href);
    } catch {
      return href;
    }
  }

  private _isRootRelativeWorkspaceHref(href: string): boolean {
    return (
      href.startsWith('/') &&
      !href.startsWith('//') &&
      !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href)
    );
  }

  private _isSameOrInsidePath(parentPath: string, childPath: string): boolean {
    const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
    return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  }

  private _resolveNavigationPath(href: string): string {
    const requestedPath = this._decodeNavigationHref(this._stripNavigationFragment(href));
    if (!requestedPath && this._currentFile) return this._currentFile;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const rootPath = workspaceFolder?.uri.fsPath ?? '';
    const dir = this._currentFile ? path.dirname(this._currentFile) : rootPath;

    if (
      rootPath &&
      path.isAbsolute(requestedPath) &&
      this._isSameOrInsidePath(rootPath, requestedPath)
    ) {
      return requestedPath;
    }

    if (rootPath && this._isRootRelativeWorkspaceHref(requestedPath)) {
      return path.resolve(rootPath, `.${requestedPath}`);
    }

    if (!path.isAbsolute(requestedPath)) {
      return path.resolve(dir, requestedPath);
    }

    return requestedPath;
  }

  private async _navigateTo(href: string | null): Promise<void> {
    if (!href) {
      this._currentFile = null;
      await this._sendWelcome();
      return;
    }

    const resolvedPath = this._resolveNavigationPath(href);

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
      markdownSource: '',
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
    const csp = `default-src 'none'; style-src 'unsafe-inline' ${cspSource}; script-src 'unsafe-inline' blob: ${cspSource}; worker-src blob:; img-src * data: blob: ${cspSource}; media-src * data: blob: ${cspSource}; frame-src 'self' data: ${cspSource} https://www.youtube.com https://www.youtube-nocookie.com; connect-src *;`;
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
