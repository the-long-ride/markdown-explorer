import { describe, expect, test, vi, beforeEach } from 'vitest';

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

function getPanel(): any {
  return MarkdownDocsPanel.currentPanel as any;
}

function ensurePanel() {
  setupVscodeMock();
  const context = { extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any;
  MarkdownDocsPanel.createOrShow(context, null);
  return getPanel();
}

describe('_makeSearchExcerpt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('returns text around match index', () => {
    const panel = ensurePanel();
    const text = 'The quick brown fox jumps over the lazy dog and runs away quickly';
    const result = panel._makeSearchExcerpt(text, text.indexOf('fox'), 3);
    expect(result).toContain('fox');
  });

  test('adds ellipsis before when more than 10 words before match', () => {
    const panel = ensurePanel();
    const words = Array.from({ length: 15 }, (_, i) => `word${i}`).join(' ');
    const text = `${words} target more words here`;
    const idx = text.indexOf('target');
    const result = panel._makeSearchExcerpt(text, idx, 6);
    expect(result).toContain('...');
    expect(result).toContain('target');
  });

  test('adds ellipsis after when more than 10 words after match', () => {
    const panel = ensurePanel();
    const words = Array.from({ length: 15 }, (_, i) => `word${i}`).join(' ');
    const text = `target ${words}`;
    const result = panel._makeSearchExcerpt(text, 0, 6);
    expect(result).toContain('...');
  });

  test('no ellipsis when context is short', () => {
    const panel = ensurePanel();
    const text = 'hello world';
    const result = panel._makeSearchExcerpt(text, 0, 5);
    expect(result).not.toContain('...');
    expect(result).toContain('hello');
  });

  test('match at position 0 with short text', () => {
    const panel = ensurePanel();
    const text = 'find this text';
    const result = panel._makeSearchExcerpt(text, 0, 4);
    expect(result).toContain('find');
  });

  test('normalizes whitespace in match text', () => {
    const panel = ensurePanel();
    const text = 'before  \n\t  match  \n  after';
    const idx = text.indexOf('match');
    const result = panel._makeSearchExcerpt(text, idx, 5);
    expect(result).toContain('match');
  });

  test('empty before and after', () => {
    const panel = ensurePanel();
    const text = 'x';
    const result = panel._makeSearchExcerpt(text, 0, 1);
    expect(result).toContain('x');
  });
});

describe('_isSameOrInsidePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('same path returns true', () => {
    const panel = ensurePanel();
    expect(panel._isSameOrInsidePath('/a/b', '/a/b')).toBe(true);
  });

  test('child path returns true', () => {
    const panel = ensurePanel();
    expect(panel._isSameOrInsidePath('/a/b', '/a/b/c')).toBe(true);
  });

  test('sibling path returns false', () => {
    const panel = ensurePanel();
    expect(panel._isSameOrInsidePath('/a/b', '/a/c')).toBe(false);
  });

  test('parent path returns false', () => {
    const panel = ensurePanel();
    expect(panel._isSameOrInsidePath('/a/b/c', '/a/b')).toBe(false);
  });

  test('unrelated path returns false', () => {
    const panel = ensurePanel();
    expect(panel._isSameOrInsidePath('/a/b', '/x/y')).toBe(false);
  });

  test('deeply nested child returns true', () => {
    const panel = ensurePanel();
    expect(panel._isSameOrInsidePath('/a', '/a/b/c/d')).toBe(true);
  });

  test('trailing slash same path', () => {
    const panel = ensurePanel();
    expect(panel._isSameOrInsidePath('/a/b/', '/a/b')).toBe(true);
  });
});

describe('_toWebviewResourceUri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAsWebviewUri.mockClear();
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('keeps https URLs unchanged', () => {
    const panel = ensurePanel();
    const result = panel._toWebviewResourceUri('https://example.com/img.png');
    expect(result).toBe('https://example.com/img.png');
  });

  test('keeps data URLs unchanged', () => {
    const panel = ensurePanel();
    const result = panel._toWebviewResourceUri('data:image/png;base64,abc');
    expect(result).toBe('data:image/png;base64,abc');
  });

  test('keeps vscode-webview URLs unchanged', () => {
    const panel = ensurePanel();
    const result = panel._toWebviewResourceUri('vscode-webview://img.png');
    expect(result).toBe('vscode-webview://img.png');
  });

  test('keeps anchor URLs unchanged', () => {
    const panel = ensurePanel();
    const result = panel._toWebviewResourceUri('#section');
    expect(result).toBe('#section');
  });

  test('resolves relative path via asWebviewUri', () => {
    const panel = ensurePanel();
    panel._currentFile = '/project/docs/readme.md';
    const fakeUri = { toString: () => 'vscode-webview://project/docs/img.png' };
    mockAsWebviewUri.mockReturnValue(fakeUri);
    const result = panel._toWebviewResourceUri('img.png');
    expect(mockAsWebviewUri).toHaveBeenCalled();
    expect(result).toBe('vscode-webview://project/docs/img.png');
  });
});

describe('_rewriteRelativeMediaUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAsWebviewUri.mockClear();
    MarkdownDocsPanel.currentPanel = undefined;
  });

  test('rewrites img src relative path', () => {
    const panel = ensurePanel();
    panel._currentFile = '/project/docs/readme.md';
    const fakeUri = { toString: () => 'vscode-webview://project/docs/image.png' };
    mockAsWebviewUri.mockReturnValue(fakeUri);
    const html = '<img src="image.png" />';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('vscode-webview://project/docs/image.png');
  });

  test('keeps absolute https img src', () => {
    const panel = ensurePanel();
    const html = '<img src="https://example.com/img.png" />';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('https://example.com/img.png');
  });

  test('rewrites video src relative path', () => {
    const panel = ensurePanel();
    panel._currentFile = '/project/docs/readme.md';
    const fakeUri = { toString: () => 'vscode-webview://project/docs/vid.mp4' };
    mockAsWebviewUri.mockReturnValue(fakeUri);
    const html = '<video src="vid.mp4"></video>';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('vscode-webview://project/docs/vid.mp4');
  });

  test('rewrites video poster attribute', () => {
    const panel = ensurePanel();
    panel._currentFile = '/project/docs/readme.md';
    const fakeUri = { toString: () => 'vscode-webview://project/docs/poster.jpg' };
    mockAsWebviewUri.mockReturnValue(fakeUri);
    const html = '<video poster="poster.jpg"></video>';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('vscode-webview://project/docs/poster.jpg');
  });

  test('keeps data URIs in img src', () => {
    const panel = ensurePanel();
    const html = '<img src="data:image/png;base64,abc" />';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('data:image/png;base64,abc');
  });

  test('rewrites source src inside picture', () => {
    const panel = ensurePanel();
    panel._currentFile = '/project/docs/readme.md';
    const fakeUri = { toString: () => 'vscode-webview://project/docs/img.webp' };
    mockAsWebviewUri.mockReturnValue(fakeUri);
    const html = '<source src="img.webp" type="image/webp">';
    const result = panel._rewriteRelativeMediaUrls(html);
    expect(result).toContain('vscode-webview://project/docs/img.webp');
  });
});
