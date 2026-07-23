// =============================================================================
// core/panel.ts — WebviewPanel: UI shell + message bridge
// =============================================================================

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

import * as path from 'path';
import * as fs from 'fs';

import { WorkspaceScanner } from './scanner';
import { scanWorkspaceIncrementally } from './incrementalScan';
import { refreshPanelFromWatch } from './panelWatch';
import { parse } from '../markdown/parser';
import { HtmlRenderer } from '../markdown/renderer';
import {
  createFailureMarkdown,
  DocumentConverter,
  getFileTypeLabel,
  isExtraDocumentFilePath,
  isMarkdownFilePath,
  isSupportedFilePath,
  stripKnownExtension,
} from './documentConversion';
import type {
  DocumentPreviewInfo,
  MdFile,
  RenderContentMessage,
  WebviewMessage,
  WorkspaceSearchResult,
} from '../types';
import { normalizePanelPath, resolvePanelNavigationPath, stripNavigationFragment, decodeNavigationHref, isRootRelativeWorkspaceHref, isSameOrInsidePath } from './panelNavigation';
import { buildWebviewShell } from './panelShell';
import { makeSearchExcerpt, searchMarkdownItems } from './panelSearch';

export { normalizePanelPath, stripNavigationFragment, decodeNavigationHref, isRootRelativeWorkspaceHref, isSameOrInsidePath, resolvePanelNavigationPath } from './panelNavigation';
export { buildWebviewShell } from './panelShell';
export { makeSearchExcerpt, searchMarkdownItems } from './panelSearch';

export { WORKSPACE_SCAN_BATCH_SIZE, WORKSPACE_SCAN_REVEAL_DELAY_MS } from './incrementalScan';

export class MarkdownDocsPanel {
  static currentPanel: MarkdownDocsPanel | undefined;
  private static readonly VIEW_TYPE = 'markdownExplorer';

  private readonly _panel: import('vscode').WebviewPanel;
  private readonly _extensionPath: string;
  private readonly _extensionVersion: string;
  private _currentFile: string | null;
  private _flat: MdFile[] = [];
  private _scanGeneration = 0;
  private _documentConversionEnabled: boolean;
  private readonly _documentConverter = new DocumentConverter();
  private readonly _disposables: import('vscode').Disposable[] = [];

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static createOrShow(context: import('vscode').ExtensionContext, initialFilePath: string | null): void {
    const column = getVscode().ViewColumn.Active;

    if (MarkdownDocsPanel.currentPanel) {
      MarkdownDocsPanel.currentPanel._panel.reveal(column);
      void MarkdownDocsPanel.currentPanel._navigateTo(initialFilePath);
      return;
    }

    const panel = getVscode().window.createWebviewPanel(
      MarkdownDocsPanel.VIEW_TYPE,
      'Markdown Explorer',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          getVscode().Uri.file(path.join(context.extensionPath, 'ui')),
          ...(getVscode().workspace.workspaceFolders?.map(f => f.uri) ?? []),
        ],
      },
    );

    MarkdownDocsPanel.currentPanel = new MarkdownDocsPanel(panel, context, initialFilePath);
  }

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  private constructor(
    panel: import('vscode').WebviewPanel,
    _context: import('vscode').ExtensionContext,
    initialFilePath: string | null,
  ) {
    this._panel = panel;
    this._extensionPath = _context.extensionPath;
    this._extensionVersion = String(_context.extension.packageJSON.version ?? '');
    this._currentFile = initialFilePath;
    this._documentConversionEnabled = this._readDocumentConversionEnabled();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (msg: WebviewMessage) => {
        switch (msg.command) {
          case 'navigate':
            await this._navigateTo(msg.path);
            break;
          case 'openInEditor':
            if (msg.path) {
              const doc = await getVscode().workspace.openTextDocument(msg.path);
              await getVscode().window.showTextDocument(doc, getVscode().ViewColumn.One);
            }
            break;
          case 'ready':
            if (typeof msg.documentConversionEnabled === 'boolean') {
              this._documentConversionEnabled = msg.documentConversionEnabled;
            }
            await this._onWebviewReady();
            break;
          case 'copyCode':
            await getVscode().env.clipboard.writeText(msg.text);
            break;
          case 'openExternal':
            if (/^https?:\/\//i.test(msg.url)) {
              await getVscode().env.openExternal(getVscode().Uri.parse(msg.url));
            }
            break;
          case 'refresh':
            await this.refresh();
            break;
          case 'setDocumentConversion':
            await this._setDocumentConversion(Boolean(msg.enabled));
            break;
          case 'searchWorkspace':
            await this._panel.webview.postMessage({
              command: 'workspaceSearchResults',
              requestId: msg.requestId,
              results: searchMarkdownItems(msg.query, msg.items, this._flat),
            });
            break;
          case 'updateAppearance': {
            const config = getVscode().workspace.getConfiguration('markdownExplorer');
            await config.update('theme', msg.theme, getVscode().ConfigurationTarget.Global);
            await config.update('themeStyle', msg.themeStyle, getVscode().ConfigurationTarget.Global);
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
    await this._sendLoading('Refreshing workspace...');
    await this._render();
  }

  /** Watcher-triggered refresh: re-scan sidebar, emit `currentFileChanged` banner when the saved file is the open one. See panelWatch.ts. */
  async refreshFromWatch(changedPath?: string | null): Promise<void> {
    if (!this._panel.webview.html) { await this._render(); return; }
    await refreshPanelFromWatch(
      {
        documentConversionEnabled: this._documentConversionEnabled,
        scanGeneration: this._scanGeneration,
        currentFile: this._currentFile,
        workspaceName: getVscode().workspace.workspaceFolders?.[0]?.name ?? 'Workspace',
        postMessage: (m) => this._panel.webview.postMessage(m),
        bumpScanGeneration: () => ++this._scanGeneration,
        isCurrentScan: (g) => g === this._scanGeneration,
        setFlat: (f) => { this._flat = f; },
      },
      changedPath,
    );
  }

  // ---------------------------------------------------------------------------
  // Private: scan + build shell
  // ---------------------------------------------------------------------------

  private async _render(): Promise<void> {
    if (!this._panel.webview.html) {
      this._panel.webview.html = buildWebviewShell(this._extensionPath, this._panel, getVscode());
      return;
    }
    await this._onWebviewReady();
  }

  // ---------------------------------------------------------------------------
  // Private: send rendered content to webview
  // ---------------------------------------------------------------------------

  private async _onWebviewReady(): Promise<void> {
    const config = getVscode().workspace.getConfiguration('markdownExplorer');
    const theme = config.get<string>('theme') ?? 'auto';
    const themeStyle = config.get<string>('themeStyle') ?? 'default';
    const defaultExpanded = config.get<boolean>('defaultExpanded') ?? true;
    const scanGeneration = ++this._scanGeneration;
    const workspaceName = getVscode().workspace.workspaceFolders?.[0]?.name ?? 'Workspace';
    await this._panel.webview.postMessage({ command: 'workspaceScanProgress', scannedFiles: 0, active: true });
    const result = await scanWorkspaceIncrementally({
      documentConversionEnabled: this._documentConversionEnabled,
      isCurrent: () => scanGeneration === this._scanGeneration,
      onProgress: scannedFiles => {
        void this._panel.webview.postMessage({ command: 'workspaceScanProgress', scannedFiles, active: true });
      },
      onReveal: next => {
        this._flat = next.fileList;
        void this._panel.webview.postMessage({
          command: 'readyAck', ...next, theme, themeStyle, defaultExpanded,
          workspaceName, documentConversionEnabled: this._documentConversionEnabled, ...this._hostInfo(),
        });
      },
      onChanged: next => {
        this._flat = next.fileList;
        void this._panel.webview.postMessage({ command: 'workspaceFilesChanged', ...next, workspaceName,
          documentConversionEnabled: this._documentConversionEnabled });
      },
    });
    if (!result) return;
    const { flat } = result;
    this._flat = flat;
    this._panel.title = `Markdown Explorer — ${workspaceName}`;
    await this._panel.webview.postMessage({ command: 'workspaceScanProgress', scannedFiles: flat.length, active: false });

    if (this._currentFile) {
      await this._sendContent();
    } else {
      await this._sendWelcome();
    }
  }

  private async _sendContent(): Promise<void> {
    if (!this._currentFile) return;
    if (!isSupportedFilePath(this._currentFile, this._documentConversionEnabled)) {
      this._currentFile = null;
      await this._sendWelcome();
      return;
    }

    let fileInfo = this._flat.find(f => normalizePanelPath(f.fsPath) === normalizePanelPath(this._currentFile!));
    if (!fileInfo) {
      const workspaceFolder = getVscode().workspace.workspaceFolders?.[0];
      const rootPath = workspaceFolder?.uri.fsPath ?? '';
      const relativePath = rootPath ? path.relative(rootPath, this._currentFile) : path.basename(this._currentFile);
      fileInfo = {
        fsPath: this._currentFile,
        relativePath,
        parts: relativePath.split(path.sep),
        fileName: path.basename(this._currentFile),
        title: stripKnownExtension(path.basename(this._currentFile)),
      };
    }

    let raw = '';
    let previewInfo: DocumentPreviewInfo | null = null;
    try {
      if (isMarkdownFilePath(this._currentFile)) {
        raw = WorkspaceScanner.readFile(this._currentFile);
      } else {
        await this._sendLoading(
          isExtraDocumentFilePath(this._currentFile) ? 'Preparing document preview...' : 'Loading docs...',
          `Preparing ${getFileTypeLabel(this._currentFile)} preview locally.`,
        );
        const result = await this._documentConverter.readMarkdown(this._currentFile);
        raw = result.markdown;
        previewInfo = result.previewInfo;
      }
    } catch (err) {
      console.error('Failed to prepare file preview:', this._currentFile, err);
      raw = createFailureMarkdown(this._currentFile, err);
      previewInfo = isExtraDocumentFilePath(this._currentFile)
        ? {
            kind: 'converted',
            sourceExtension: path.extname(this._currentFile).toLowerCase(),
            sourceLabel: getFileTypeLabel(this._currentFile),
            qualityWarning: 'Markdown Explorer could not convert this file. The details are shown below.',
          }
        : null;
    }

    const isMdx = this._currentFile.endsWith('.mdx');
    const { tokens, frontmatter } = parse(raw, isMdx);
    const config = getVscode().workspace.getConfiguration('markdownExplorer');
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
      previewInfo,
    };
    await this._panel.webview.postMessage(msg);
  }

  private async _sendLoading(label?: string, detail?: string): Promise<void> {
    await this._panel.webview.postMessage({ command: 'setLoading', label, detail });
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

  private _shouldKeepResourceUrl(src: string): boolean {
    return /^(https?:|data:|blob:|vscode-webview:|#)/i.test(src);
  }

  private _toWebviewResourceUri(src: string): string {
    if (this._shouldKeepResourceUrl(src)) return src;
    const fileDir = path.dirname(this._currentFile!);
    const absolutePath = path.resolve(fileDir, src);
    return this._panel.webview.asWebviewUri(getVscode().Uri.file(absolutePath)).toString();
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

  private _resolveNavigationPath(href: string): string {
    const rootPath = getVscode().workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    return resolvePanelNavigationPath(href, this._currentFile, rootPath);
  }

  _makeSearchExcerpt(text: string, index: number, matchLength: number) {
    return makeSearchExcerpt(text, index, matchLength);
  }

  _searchMarkdownItems(query: string, rawItems?: readonly WorkspaceSearchResult[]) {
    return searchMarkdownItems(query, rawItems, this._flat);
  }

  _isSameOrInsidePath(parentPath: string, childPath: string) {
    return isSameOrInsidePath(parentPath, childPath);
  }

  _normPath(value: string) { return normalizePanelPath(value); }
  _stripNavigationFragment(value: string) { return stripNavigationFragment(value); }
  _decodeNavigationHref(value: string) { return decodeNavigationHref(value); }
  _isRootRelativeWorkspaceHref(value: string) { return isRootRelativeWorkspaceHref(value); }
  _buildShell() { return buildWebviewShell(this._extensionPath, this._panel, getVscode()); }

  private async _navigateTo(href: string | null): Promise<void> {
    if (!href) {
      this._currentFile = null;
      await this._sendWelcome();
      return;
    }

    const resolvedPath = this._resolveNavigationPath(href);

    // Check if the resolved file actually exists on disk
    if (
      fs.existsSync(resolvedPath) &&
      fs.statSync(resolvedPath).isFile() &&
      isSupportedFilePath(resolvedPath, this._documentConversionEnabled)
    ) {
      this._currentFile = resolvedPath;
      await this._sendContent();
      return;
    }

    const normHref = normalizePanelPath(resolvedPath);
    const found = this._flat.find(
      f => normalizePanelPath(f.fsPath) === normHref || normalizePanelPath(f.relativePath) === normHref,
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
      previewInfo: null,
    };
    await this._panel.webview.postMessage(msg);
  }

  private _readDocumentConversionEnabled(): boolean {
    const config = getVscode().workspace.getConfiguration('markdownExplorer');
    return config.get<boolean>('documentConversion') === true;
  }

  private async _setDocumentConversion(enabled: boolean): Promise<void> {
    if (this._documentConversionEnabled === enabled) return;
    this._documentConversionEnabled = enabled;

    const config = getVscode().workspace.getConfiguration('markdownExplorer');
    await config.update('documentConversion', enabled, getVscode().ConfigurationTarget.Global);

    await this._sendLoading(enabled ? 'Finding supported documents...' : 'Refreshing Markdown files...');
    if (this._currentFile && !isSupportedFilePath(this._currentFile, enabled)) {
      this._currentFile = null;
    }
    await this._render();
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
