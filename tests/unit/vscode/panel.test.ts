import { describe, expect, test, vi, beforeEach } from 'vitest';
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
            cspSource: 'vscode-webview:',
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

describe('MarkdownDocsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostMessage.mockClear();
    mockOnDidReceiveMessage.mockClear();
    MarkdownDocsPanel.currentPanel = undefined;
    mockConfigGet = vi.fn(() => undefined);
  });

  describe('createOrShow', () => {
    test('creates a new panel when no current panel exists', () => {
      setupVscodeMock();
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);
      expect(MarkdownDocsPanel.currentPanel).toBeDefined();
    });

    test('reuses existing panel and navigates to path', () => {
      setupVscodeMock();
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;

      MarkdownDocsPanel.createOrShow(context, null);
      const panel = MarkdownDocsPanel.currentPanel;
      MarkdownDocsPanel.createOrShow(context, '/some/file.md');

      expect(MarkdownDocsPanel.currentPanel).toBe(panel);
    });
  });

  describe('message handler dispatch', () => {
    test('handles ready message', async () => {
      setupVscodeMock();
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);

      const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
      mockConfigGet = vi.fn((key: string) => {
        if (key === 'theme') return 'dark';
        if (key === 'themeStyle') return 'default';
        if (key === 'defaultExpanded') return true;
        return undefined;
      });
      await msgHandler({ command: 'ready', documentConversionEnabled: true });

      const ackMsg = mockPostMessage.mock.calls.find((call: any) => call[0].command === 'readyAck');
      expect(ackMsg).toBeDefined();
    });

    test('handles navigate message', async () => {
      setupVscodeMock();
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);

      const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
      await msgHandler({ command: 'navigate', path: '/some/file.md' });
    });

    test('handles searchWorkspace message', async () => {
      setupVscodeMock();
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);

      const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
      await msgHandler({ command: 'searchWorkspace', requestId: 'r1', query: 'test' });

      const searchMsg = mockPostMessage.mock.calls.find((call: any) => call[0].command === 'workspaceSearchResults');
      expect(searchMsg).toBeDefined();
      expect(searchMsg[0].requestId).toBe('r1');
    });

    test('handles refresh message', async () => {
      setupVscodeMock();
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);

      const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
      await msgHandler({ command: 'refresh' });
    });

    test('handles openExternal with HTTP URL', async () => {
      const openExternal = vi.fn();
      setupVscodeMock({ env: { clipboard: { writeText: vi.fn() }, openExternal } });
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);

      const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
      await msgHandler({ command: 'openExternal', url: 'https://example.com' });
      expect(openExternal).toHaveBeenCalled();
    });

    test('ignores openExternal with non-HTTP URL', async () => {
      const openExternal = vi.fn();
      setupVscodeMock({ env: { clipboard: { writeText: vi.fn() }, openExternal } });
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);

      const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
      await msgHandler({ command: 'openExternal', url: 'ftp://example.com' });
      expect(openExternal).not.toHaveBeenCalled();
    });

    test('handles copyCode message', async () => {
      const writeText = vi.fn();
      setupVscodeMock({ env: { clipboard: { writeText }, openExternal: vi.fn() } });
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);

      const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
      await msgHandler({ command: 'copyCode', text: 'console.log("hello")' });
      expect(writeText).toHaveBeenCalledWith('console.log("hello")');
    });

    test('handles openInEditor message', async () => {
      const openTextDocument = vi.fn(() => Promise.resolve({ fileName: '/fake/file.md' }));
      const showTextDocument = vi.fn();
      setupVscodeMock({
        workspace: {
          workspaceFolders: [],
          getConfiguration() { return { get: () => undefined, update: vi.fn() }; },
          textDocuments: [],
          openTextDocument,
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
              dispose: vi.fn(),
              title: '',
            };
          },
          showTextDocument,
        },
      });
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);

      const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
      await msgHandler({ command: 'openInEditor', path: '/fake/file.md' });
      expect(openTextDocument).toHaveBeenCalledWith('/fake/file.md');
    });

    test('handles setDocumentConversion message', async () => {
      setupVscodeMock();
      const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
      MarkdownDocsPanel.createOrShow(context, null);

      const msgHandler = mockOnDidReceiveMessage.mock.calls[0][0];
      mockConfigUpdate = vi.fn(() => Promise.resolve());
      await msgHandler({ command: 'setDocumentConversion', enabled: true });
      expect(mockConfigUpdate).toHaveBeenCalled();
    });
  });
});

describe('navigation helpers (pure logic)', () => {
  function makeSetup() {
    const tempDir = makeTempDir('panel-nav-');
    return { tempDir };
  }

  test('_normPath normalizes path to lowercase with forward slashes', () => {
    const panel = MarkdownDocsPanel.currentPanel as any;
    if (!panel) return;
    const normalized = panel._normPath('C:\\Users\\Path\\File.MD');
    expect(normalized).toBe('c:/users/path/file.md');
  });

  test('_stripNavigationFragment removes hash fragment', () => {
    const panel = MarkdownDocsPanel.currentPanel as any;
    if (!panel) return;
    const stripped = panel._stripNavigationFragment('file.md#section');
    expect(stripped).toBe('file.md');
    expect(panel._stripNavigationFragment('file.md')).toBe('file.md');
  });

  test('_decodeNavigationHref decodes URI components', () => {
    const panel = MarkdownDocsPanel.currentPanel as any;
    if (!panel) return;
    const decoded = panel._decodeNavigationHref('path%20to%20file');
    expect(decoded).toBe('path to file');
  });

  test('_isRootRelativeWorkspaceHref identifies root-relative paths', () => {
    const panel = MarkdownDocsPanel.currentPanel as any;
    if (!panel) return;
    expect(panel._isRootRelativeWorkspaceHref('/docs/readme.md')).toBe(true);
    expect(panel._isRootRelativeWorkspaceHref('//example.com')).toBe(false);
    expect(panel._isRootRelativeWorkspaceHref('https://example.com')).toBe(false);
  });

  test('_shouldKeepResourceUrl keeps known URL schemes', () => {
    const panel = MarkdownDocsPanel.currentPanel as any;
    if (!panel) return;
    expect(panel._shouldKeepResourceUrl('https://example.com/img.png')).toBe(true);
    expect(panel._shouldKeepResourceUrl('data:image/png;base64,abc')).toBe(true);
    expect(panel._shouldKeepResourceUrl('vscode-webview://img.png')).toBe(true);
    expect(panel._shouldKeepResourceUrl('#anchor')).toBe(true);
    expect(panel._shouldKeepResourceUrl('relative/image.png')).toBe(false);
  });
});