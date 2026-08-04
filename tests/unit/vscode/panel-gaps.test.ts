import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

const mockPostMessage = vi.fn();
const mockOnDidReceiveMessage = vi.fn();
const mockOnDidDispose = vi.fn();
const mockAsWebviewUri = vi.fn(() => ({ toString: () => 'vscode-webview://fake/file.png' }));
let mockConfigGet: any = vi.fn(() => undefined);
let mockConfigUpdate: any = vi.fn(() => Promise.resolve());

const mockWorkspaceFolders: any[] | undefined = [];

vi.mock('../../../vscode/src/core/scanner', () => ({
  WorkspaceScanner: {
    scan: vi.fn(() => Promise.resolve({ tree: null, flat: [] })),
    readFile: vi.fn(() => '# test content'),
    buildFileEntry: vi.fn(),
    buildTree: vi.fn(),
    extractTitle: vi.fn(),
    extractMdxTitle: vi.fn(),
  },
}));

const { WorkspaceScanner } = await import('../../../vscode/src/core/scanner');

const { overrideVscodeForTest, MarkdownDocsPanel } = await import(
  '../../../vscode/src/core/panel'
);

function setupVscodeMock(overrides: any = {}) {
  overrideVscodeForTest({
    workspace: {
      workspaceFolders: mockWorkspaceFolders,
      getConfiguration() {
        return {
          get: mockConfigGet,
          update: mockConfigUpdate,
        };
      },
      textDocuments: [],
      openTextDocument: vi.fn(() => Promise.resolve({})),
    },
    window: {
      createWebviewPanel() {
        return {
          onDidDispose: mockOnDidDispose,
          webview: {
            onDidReceiveMessage: mockOnDidReceiveMessage,
            postMessage: mockPostMessage,
            asWebviewUri: mockAsWebviewUri,
            cspSource: 'vscode-csp-source',
            html: '',
            options: {},
          },
          reveal: vi.fn(),
          dispose: vi.fn(),
          title: '',
        };
      },
      showTextDocument: vi.fn(() => Promise.resolve()),
    },
    ViewColumn: { Active: 1, One: 1 },
    Uri: {
      file: vi.fn((f: string) => ({ fsPath: f })),
      parse: vi.fn((url: string) => url),
    },
    env: {
      clipboard: { writeText: vi.fn() },
      openExternal: vi.fn(),
    },
    ConfigurationTarget: { Global: 1 },
    ...overrides,
  });
}

function getPanel(): any {
  return MarkdownDocsPanel.currentPanel as any;
}

function ensurePanel(overrides: any = {}) {
  setupVscodeMock(overrides);
  const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
  MarkdownDocsPanel.createOrShow(context, null);
  return getPanel();
}

describe('_buildShell', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    MarkdownDocsPanel.currentPanel = undefined;
    mockConfigGet = vi.fn(() => undefined);
    tempDir = makeTempDir('panel-shell-');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    MarkdownDocsPanel.currentPanel = undefined;
  });

  it('injects CSP meta tag with cspSource into head', () => {
    const distPath = path.join(tempDir, 'ui', 'dist');
    writeFile(path.join(distPath, 'index.html'), '<html><head><title>Test</title></head><body></body></html>');

    const panel = ensurePanel();
    panel._extensionPath = tempDir;
    panel._panel.webview.cspSource = 'my-csp-source';
    panel._panel.webview.asWebviewUri = (uri: any) => ({ toString: () => `vscode-webview://dist` });

    const html = panel._buildShell();

    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('my-csp-source');
  });

  it('injects base href with webview URI', () => {
    const distPath = path.join(tempDir, 'ui', 'dist');
    writeFile(path.join(distPath, 'index.html'), '<html><head></head><body></body></html>');

    const panel = ensurePanel();
    panel._extensionPath = tempDir;
    panel._panel.webview.asWebviewUri = (uri: any) => ({ toString: () => 'vscode-webview://base-href' });

    const html = panel._buildShell();

    expect(html).toContain('<base href="vscode-webview://base-href/"');
  });

  it('returns fallback HTML when index.html does not exist', () => {
    const panel = ensurePanel();
    panel._extensionPath = path.join(tempDir, 'nonexistent');

    const html = panel._buildShell();

    expect(html).toContain('Markdown Explorer UI has not been built');
    expect(html).toContain('pnpm run build');
  });
});

describe('_readDocumentConversionEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MarkdownDocsPanel.currentPanel = undefined;
  });

  afterEach(() => {
    MarkdownDocsPanel.currentPanel = undefined;
  });

  it('returns true when config returns true', () => {
    mockConfigGet = vi.fn((key: string) => {
      if (key === 'documentConversion') return true;
      return undefined;
    });
    const panel = ensurePanel();
    expect(panel._documentConversionEnabled).toBe(true);
  });

  it('returns false when config returns false', () => {
    mockConfigGet = vi.fn((key: string) => {
      if (key === 'documentConversion') return false;
      return undefined;
    });
    const panel = ensurePanel();
    expect(panel._documentConversionEnabled).toBe(false);
  });

  it('returns false by default when config key is not set', () => {
    mockConfigGet = vi.fn(() => undefined);
    const panel = ensurePanel();
    expect(panel._documentConversionEnabled).toBe(false);
  });
});

describe('refresh method', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigGet = vi.fn((key: string) => {
      if (key === 'theme') return 'dark';
      if (key === 'themeStyle') return 'default';
      if (key === 'defaultExpanded') return true;
      return undefined;
    });
    MarkdownDocsPanel.currentPanel = undefined;
  });

  afterEach(() => {
    MarkdownDocsPanel.currentPanel = undefined;
  });

  it('calls _sendLoading then _render', async () => {
    (WorkspaceScanner.scan as any).mockResolvedValue({ tree: null, flat: [] });
    const panel = ensurePanel();
    panel._panel.webview.html = '<html>existing</html>';
    mockPostMessage.mockClear();

    await panel.refresh();

    const loadingMsg = mockPostMessage.mock.calls.find((c: any) => c[0].command === 'setLoading');
    expect(loadingMsg).toBeDefined();
    expect(loadingMsg[0].label).toBe('Refreshing workspace...');

    const ackMsg = mockPostMessage.mock.calls.find((c: any) => c[0].command === 'readyAck');
    expect(ackMsg).toBeDefined();
  });
});

describe('_searchMarkdownItems with rawItems parameter', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigGet = vi.fn(() => undefined);
    MarkdownDocsPanel.currentPanel = undefined;
    tempDir = makeTempDir('panel-search-raw-');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    MarkdownDocsPanel.currentPanel = undefined;
  });

  it('uses rawItems when provided and non-empty', () => {
    const mdFile = path.join(tempDir, 'custom.md');
    writeFile(mdFile, '# Custom Doc\n\nCustom content with unicorns.');
    (WorkspaceScanner.readFile as any).mockReturnValue('# Custom Doc\n\nCustom content with unicorns.');

    const panel = ensurePanel([{ name: 'ws', uri: { fsPath: tempDir } }]);
    panel._flat = [];

    const rawItems = [{
      fsPath: mdFile,
      relativePath: 'custom.md',
      fileName: 'custom.md',
      title: 'Custom Doc',
    }];

    const results = panel._searchMarkdownItems('unicorn', rawItems);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].fsPath).toBe(mdFile);
  });

  it('keeps an explicit empty rawItems scope empty', () => {
    const mdFile = path.join(tempDir, 'resident.md');
    writeFile(mdFile, '# Resident Doc\n\nUnique scoped content.');
    (WorkspaceScanner.readFile as any).mockReturnValue('# Resident Doc\n\nUnique scoped content.');

    const panel = ensurePanel([{ name: 'ws', uri: { fsPath: tempDir } }]);
    panel._flat = [{
      fsPath: mdFile,
      relativePath: 'resident.md',
      parts: ['resident.md'],
      fileName: 'resident.md',
      title: 'Resident Doc',
    }];

    const results = panel._searchMarkdownItems('scoped', []);
    expect(results).toEqual([]);
  });

  it('falls back to _flat when rawItems is undefined', () => {
    const mdFile = path.join(tempDir, 'resident.md');
    writeFile(mdFile, '# Resident Doc\n\nUnique workspace content.');
    (WorkspaceScanner.readFile as any).mockReturnValue('# Resident Doc\n\nUnique workspace content.');

    const panel = ensurePanel([{ name: 'ws', uri: { fsPath: tempDir } }]);
    panel._flat = [{
      fsPath: mdFile,
      relativePath: 'resident.md',
      parts: ['resident.md'],
      fileName: 'resident.md',
      title: 'Resident Doc',
    }];

    const results = panel._searchMarkdownItems('workspace', undefined);
    expect(results).toHaveLength(1);
    expect(results[0].fsPath).toBe(mdFile);
  });

  it('skips items where fsPath does not exist on disk', () => {
    const panel = ensurePanel();
    const rawItems = [{
      fsPath: '/nonexistent/path/ghost.md',
      relativePath: 'ghost.md',
      fileName: 'ghost.md',
      title: 'Ghost',
    }];

    const results = panel._searchMarkdownItems('ghost', rawItems);
    expect(results).toEqual([]);
  });
});

describe('openInEditor with empty path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigGet = vi.fn(() => undefined);
    MarkdownDocsPanel.currentPanel = undefined;
  });

  afterEach(() => {
    MarkdownDocsPanel.currentPanel = undefined;
  });

  it('does not call openTextDocument for empty string path', async () => {
    const openTextDocument = vi.fn(() => Promise.resolve({}));
    setupVscodeMock({
      workspace: {
        workspaceFolders: [],
        getConfiguration() { return { get: () => undefined, update: vi.fn() }; },
        textDocuments: [],
        openTextDocument,
      },
    });
    const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
    MarkdownDocsPanel.createOrShow(context, null);

    const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
    await msgHandler({ command: 'openInEditor', path: '' });

    expect(openTextDocument).not.toHaveBeenCalled();
  });

  it('does not call openTextDocument for falsy 0 path', async () => {
    const openTextDocument = vi.fn(() => Promise.resolve({}));
    setupVscodeMock({
      workspace: {
        workspaceFolders: [],
        getConfiguration() { return { get: () => undefined, update: vi.fn() }; },
        textDocuments: [],
        openTextDocument,
      },
    });
    const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
    MarkdownDocsPanel.createOrShow(context, null);

    const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
    await msgHandler({ command: 'openInEditor', path: 0 as any });

    expect(openTextDocument).not.toHaveBeenCalled();
  });
});

describe('_rewriteRelativeMediaUrls with audio element', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAsWebviewUri.mockClear();
    MarkdownDocsPanel.currentPanel = undefined;
  });

  it('does not rewrite audio src (not in tag list)', () => {
    const panel = ensurePanel();
    panel._currentFile = '/project/docs/readme.md';
    const html = '<audio src="song.mp3"></audio>';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('src="song.mp3"');
    expect(mockAsWebviewUri).not.toHaveBeenCalled();
  });

  it('rewrites track src inside audio element', () => {
    const panel = ensurePanel();
    panel._currentFile = '/project/docs/readme.md';
    const fakeUri = { toString: () => 'vscode-webview://project/docs/captions.vtt' };
    mockAsWebviewUri.mockReturnValue(fakeUri);
    const html = '<audio><track src="captions.vtt" kind="captions"></audio>';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('vscode-webview://project/docs/captions.vtt');
  });

  it('rewrites source src inside audio element', () => {
    const panel = ensurePanel();
    panel._currentFile = '/project/docs/readme.md';
    const fakeUri = { toString: () => 'vscode-webview://project/docs/song.mp3' };
    mockAsWebviewUri.mockReturnValue(fakeUri);
    const html = '<audio><source src="song.mp3" type="audio/mpeg"></audio>';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('vscode-webview://project/docs/song.mp3');
  });

  it('keeps blob URLs in source src', () => {
    const panel = ensurePanel();
    const html = '<audio><source src="blob:https://example.com/audio" type="audio/mpeg"></audio>';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('blob:https://example.com/audio');
  });
});
