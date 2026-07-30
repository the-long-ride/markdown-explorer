import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
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
let mockPanelDispose: any = vi.fn();

const mockWorkspaceFolders: any[] | undefined = [];

const { WorkspaceScanner } = await import('../../../vscode/src/core/scanner');

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

const { overrideVscodeForTest, MarkdownDocsPanel } = await import(
  '../../../vscode/src/core/panel'
);

function setupVscodeMock(overrides: any = {}) {
  mockPanelDispose = vi.fn();
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
            cspSource: 'vscode-webview:',
            html: '',
            options: {},
          },
          reveal: vi.fn(),
          dispose: mockPanelDispose,
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

function createPanel(workspaceFolders?: any[], initialFilePath?: string | null) {
  setupVscodeMock({
    workspace: {
      workspaceFolders: workspaceFolders ?? [],
      getConfiguration() {
        return { get: mockConfigGet, update: mockConfigUpdate };
      },
      textDocuments: [],
      openTextDocument: vi.fn(() => Promise.resolve({})),
    },
  });
  const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
  MarkdownDocsPanel.createOrShow(context, initialFilePath ?? null);
  return getPanel();
}

describe('Panel integration: navigation', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    MarkdownDocsPanel.currentPanel = undefined;
    mockConfigGet = vi.fn((key: string) => {
      if (key === 'theme') return 'dark';
      if (key === 'themeStyle') return 'default';
      if (key === 'defaultExpanded') return true;
      if (key === 'documentConversion') return false;
      return undefined;
    });
    tempDir = makeTempDir('panel-nav-');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('navigate to existing .md file on disk sends renderContent', async () => {
    const mdFile = path.join(tempDir, 'readme.md');
    writeFile(mdFile, '# Hello World\n\nSome content here.');
    const flat = [{
      fsPath: mdFile,
      relativePath: 'readme.md',
      parts: ['readme.md'],
      fileName: 'readme.md',
      title: 'Hello World',
    }];
    (WorkspaceScanner.scan as any).mockResolvedValue({ tree: null, flat });

    const panel = createPanel([{ name: 'test', uri: { fsPath: tempDir } }]);
    panel._flat = flat;
    panel._currentFile = null;

    const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
    await msgHandler({ command: 'navigate', path: mdFile });

    const renderMsg = mockPostMessage.mock.calls.find((c: any) => c[0].command === 'renderContent');
    expect(renderMsg).toBeDefined();
    expect(renderMsg[0].filePath).toBe(mdFile);
  });

  test('navigate with null href sends welcome message', async () => {
    const panel = createPanel();
    await panel._navigateTo(null);

    const welcomeMsg = mockPostMessage.mock.calls.find(
      (c: any) => c[0].command === 'renderContent' && c[0].title === 'Welcome',
    );
    expect(welcomeMsg).toBeDefined();
  });

  test('navigate to nonexistent file sends navNotFound', async () => {
    const panel = createPanel([{ name: 'test', uri: { fsPath: tempDir } }]);
    panel._flat = [];

    await panel._navigateTo('/nonexistent/file.md');

    const notFoundMsg = mockPostMessage.mock.calls.find((c: any) => c[0].command === 'navNotFound');
    expect(notFoundMsg).toBeDefined();
  });

  test('navigate finds file by path in flat list when not on disk', async () => {
    const mdPath = path.join(tempDir, 'ghost.md');
    const flat = [{
      fsPath: mdPath,
      relativePath: 'ghost.md',
      parts: ['ghost.md'],
      fileName: 'ghost.md',
      title: 'Ghost',
    }];
    const panel = createPanel([{ name: 'test', uri: { fsPath: tempDir } }]);
    panel._flat = flat;

    (WorkspaceScanner.readFile as any).mockReturnValue('# Ghost Title\n\nContent');

    await panel._navigateTo(mdPath);

    const renderMsg = mockPostMessage.mock.calls.find((c: any) => c[0].command === 'renderContent');
    expect(renderMsg).toBeDefined();
    expect(panel._currentFile).toBe(mdPath);
  });

  test('navigate to directory path selects first matching child file', async () => {
    const subFolder = path.join(tempDir, 'subfolder');
    if (!fs.existsSync(subFolder)) fs.mkdirSync(subFolder, { recursive: true });
    const childPath = path.join(subFolder, 'nested.md');
    fs.writeFileSync(childPath, '# Nested Doc');

    const flat = [{
      fsPath: childPath,
      relativePath: 'subfolder/nested.md',
      parts: ['subfolder', 'nested.md'],
      fileName: 'nested.md',
      title: 'Nested Doc',
    }];
    const panel = createPanel([{ name: 'test', uri: { fsPath: tempDir } }]);
    panel._flat = flat;

    (WorkspaceScanner.readFile as any).mockReturnValue('# Nested Doc');

    await panel._navigateTo(subFolder);

    expect(panel._currentFile).toBe(childPath);
    const renderMsg = mockPostMessage.mock.calls.find((c: any) => c[0].command === 'renderContent');
    expect(renderMsg).toBeDefined();
  });
});

describe('Panel integration: _resolveNavigationPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MarkdownDocsPanel.currentPanel = undefined;
    mockConfigGet = vi.fn(() => undefined);
  });

  afterEach(() => {
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('empty href with currentFile returns currentFile', () => {
    const panel = createPanel();
    panel._currentFile = '/project/docs/readme.md';
    const result = panel._resolveNavigationPath('');
    expect(result).toBe('/project/docs/readme.md');
  });

  test('absolute path inside workspace returns as-is', () => {
    const panel = createPanel([{ name: 'ws', uri: { fsPath: '/project' } }]);
    panel._currentFile = '/project/docs/readme.md';
    const result = panel._resolveNavigationPath('/project/docs/other.md');
    expect(result).toBe('/project/docs/other.md');
  });

  test('root-relative path resolves against workspace root', () => {
    const panel = createPanel([{ name: 'ws', uri: { fsPath: '/project' } }]);
    panel._currentFile = '/project/docs/readme.md';
    const result = panel._resolveNavigationPath('/docs/other.md');
    expect(result).toContain('docs');
    expect(result).toContain('other.md');
  });

  test('relative path resolves against current file directory', () => {
    const panel = createPanel([{ name: 'ws', uri: { fsPath: '/project' } }]);
    panel._currentFile = '/project/docs/readme.md';
    const result = panel._resolveNavigationPath('other.md');
    expect(result).toContain('other.md');
  });

  test('absolute path outside workspace still returns resolved path', () => {
    const panel = createPanel([{ name: 'ws', uri: { fsPath: '/project' } }]);
    panel._currentFile = '/project/docs/readme.md';
    const result = panel._resolveNavigationPath('/outside/file.md');
    expect(result).toContain('file.md');
  });

  test('decodes URI components in href', () => {
    const panel = createPanel([{ name: 'ws', uri: { fsPath: '/project' } }]);
    panel._currentFile = '/project/docs/readme.md';
    const result = panel._resolveNavigationPath('path%20to%20file.md');
    expect(result).toContain('path to file.md');
  });

  test('strips hash fragment before resolving', () => {
    const panel = createPanel([{ name: 'ws', uri: { fsPath: '/project' } }]);
    panel._currentFile = '/project/docs/readme.md';
    const result = panel._resolveNavigationPath('other.md#section');
    expect(result).toContain('other.md');
    expect(result).not.toContain('#section');
  });
});

describe('Panel integration: updateAppearance handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigUpdate = vi.fn(() => Promise.resolve());
    mockConfigGet = vi.fn(() => undefined);
    MarkdownDocsPanel.currentPanel = undefined;
  });

  afterEach(() => {
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('updateAppearance updates theme and themeStyle config', async () => {
    const panel = createPanel();
    const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];

    await msgHandler({ command: 'updateAppearance', theme: 'dark', themeStyle: 'glass' });

    expect(mockConfigUpdate).toHaveBeenCalledWith('theme', 'dark', 1);
    expect(mockConfigUpdate).toHaveBeenCalledWith('themeStyle', 'glass', 1);
  });
});

describe('Panel integration: openInEditor with null path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigGet = vi.fn(() => undefined);
    MarkdownDocsPanel.currentPanel = undefined;
  });

  afterEach(() => {
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('openInEditor with null path does not call openTextDocument', async () => {
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
    await msgHandler({ command: 'openInEditor', path: null });

    expect(openTextDocument).not.toHaveBeenCalled();
  });

  test('openInEditor with empty string path does not call openTextDocument', async () => {
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
});

describe('Panel integration: dispose', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigGet = vi.fn(() => undefined);
    MarkdownDocsPanel.currentPanel = undefined;
  });

  afterEach(() => {
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('dispose sets currentPanel to undefined', () => {
    const panel = createPanel();
    expect(MarkdownDocsPanel.currentPanel).toBeDefined();
    panel.dispose();
    expect(MarkdownDocsPanel.currentPanel).toBeUndefined();
  });

  test('dispose calls panel.dispose', () => {
    const panel = createPanel();
    panel.dispose();
    expect(mockPanelDispose).toHaveBeenCalled();
  });
});

describe('Panel integration: _hostPlatform branches', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigGet = vi.fn(() => undefined);
    MarkdownDocsPanel.currentPanel = undefined;
  });

  afterEach(() => {
    MarkdownDocsPanel.currentPanel = undefined;
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  function stubPlatform(value: string) {
    Object.defineProperty(process, 'platform', { value });
  }

  test('returns macos for darwin', () => {
    stubPlatform('darwin');
    const panel = createPanel();
    expect(panel._hostPlatform()).toBe('macos');
  });

  test('returns linux for linux', () => {
    stubPlatform('linux');
    const panel = createPanel();
    expect(panel._hostPlatform()).toBe('linux');
  });

  test('returns unknown for freebsd', () => {
    stubPlatform('freebsd');
    const panel = createPanel();
    expect(panel._hostPlatform()).toBe('unknown');
  });

  test('returns windows for win32', () => {
    stubPlatform('win32');
    const panel = createPanel();
    expect(panel._hostPlatform()).toBe('windows');
  });
});

describe('Panel integration: _sendContent', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigGet = vi.fn((key: string) => {
      if (key === 'theme') return 'dark';
      if (key === 'themeStyle') return 'default';
      if (key === 'defaultExpanded') return true;
      if (key === 'documentConversion') return false;
      return undefined;
    });
    MarkdownDocsPanel.currentPanel = undefined;
    tempDir = makeTempDir('panel-content-');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('_sendContent reads file and posts renderContent', async () => {
    const mdFile = path.join(tempDir, 'doc.md');
    writeFile(mdFile, '# Test Document\n\nHello from test.');
    const flat = [{
      fsPath: mdFile,
      relativePath: 'doc.md',
      parts: ['doc.md'],
      fileName: 'doc.md',
      title: 'Test Document',
    }];
    (WorkspaceScanner.scan as any).mockResolvedValue({ tree: null, flat });
    (WorkspaceScanner.readFile as any).mockReturnValue('# Test Document\n\nHello from test.');

    const panel = createPanel([{ name: 'test', uri: { fsPath: tempDir } }]);
    panel._flat = flat;
    panel._currentFile = mdFile;

    await panel._sendContent();

    const renderMsg = mockPostMessage.mock.calls.find((c: any) => c[0].command === 'renderContent');
    expect(renderMsg).toBeDefined();
    expect(renderMsg[0].filePath).toBe(mdFile);
  });

  test('_sendContent with unsupported file sends welcome', async () => {
    const panel = createPanel();
    panel._currentFile = '/fake/file.py';
    panel._flat = [];

    await panel._sendContent();

    const welcomeMsg = mockPostMessage.mock.calls.find(
      (c: any) => c[0].command === 'renderContent' && c[0].title === 'Welcome',
    );
    expect(welcomeMsg).toBeDefined();
    expect(panel._currentFile).toBeNull();
  });

  test('_sendContent with null currentFile returns without posting', async () => {
    const panel = createPanel();
    panel._currentFile = null;
    mockPostMessage.mockClear();
    await panel._sendContent();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});

describe('Panel integration: _searchMarkdownItems with file content', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigGet = vi.fn(() => undefined);
    MarkdownDocsPanel.currentPanel = undefined;
    tempDir = makeTempDir('panel-search-');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('search returns content matches from real file', async () => {
    const mdFile = path.join(tempDir, 'searchable.md');
    writeFile(mdFile, '# My Topic\n\nThis file has unicorn content.');
    const flat = [{
      fsPath: mdFile,
      relativePath: 'searchable.md',
      parts: ['searchable.md'],
      fileName: 'searchable.md',
      title: 'My Topic',
    }];
    (WorkspaceScanner.readFile as any).mockReturnValue('# My Topic\n\nThis file has unicorn content.');

    const panel = createPanel([{ name: 'test', uri: { fsPath: tempDir } }]);
    panel._flat = flat;

    const results = panel._searchMarkdownItems('unicorn');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].fsPath).toBe(mdFile);
    expect(results[0].excerpt).toContain('unicorn');
  });

  test('search with query < 2 chars returns empty', () => {
    const panel = createPanel();
    const results = panel._searchMarkdownItems('a');
    expect(results).toEqual([]);
  });

  test('search with empty query returns empty', () => {
    const panel = createPanel();
    const results = panel._searchMarkdownItems('');
    expect(results).toEqual([]);
  });

  test('search matches title without content', () => {
    const mdFile = path.join(tempDir, 'apitest.md');
    writeFile(mdFile, '# API Reference\n\nSome unrelated content.');
    const flat = [{
      fsPath: mdFile,
      relativePath: 'apitest.md',
      parts: ['apitest.md'],
      fileName: 'apitest.md',
      title: 'API Reference',
    }];
    (WorkspaceScanner.readFile as any).mockReturnValue('# API Reference\n\nSome unrelated content.');

    const panel = createPanel([{ name: 'test', uri: { fsPath: tempDir } }]);
    panel._flat = flat;

    const results = panel._searchMarkdownItems('api');
    expect(results.length).toBeGreaterThan(0);
  });
});
