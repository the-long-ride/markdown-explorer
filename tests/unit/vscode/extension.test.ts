import { describe, expect, test, vi, beforeEach } from 'vitest';

vi.mock('../../../vscode/src/core/panel', () => ({
  MarkdownDocsPanel: {
    currentPanel: undefined,
    createOrShow: vi.fn(),
  },
}));

vi.mock('../../../vscode/src/core/documentConversion', () => ({
  isKnownSupportedFilePath: vi.fn((fp: string) => fp.endsWith('.md') || fp.endsWith('.txt')),
}));

const { _doActivate, overrideVscodeForTest, deactivate } = await import(
  '../../../vscode/src/extension'
);

const { MarkdownDocsPanel: Panel } = await import(
  '../../../vscode/src/core/panel'
);

function makeSubscriptionArray() {
  const subs: Array<{ dispose(): void } | (() => void)> = [];
  return {
    subs,
    push(item: any) {
      subs.push(item);
    },
  };
}

function makeVscodeMock(overrides: any = {}) {
  const registeredCommands: Record<string, Function> = {};
  const registeredProviders: Record<string, any> = {};
  const onDidSaveHandlers: Function[] = [];
  const watcherEvents: Record<string, Function[]> = { onDidCreate: [], onDidChange: [], onDidDelete: [] };

  return {
    window: {
      registerWebviewViewProvider: vi.fn((_type: string, _provider: any) => ({
        dispose: vi.fn(),
      })),
      activeTextEditor: undefined,
    },
    commands: {
      registerCommand: vi.fn((name: string, fn: any) => {
        registeredCommands[name] = fn;
        return { dispose: vi.fn() };
      }),
    },
    workspace: {
      onDidSaveTextDocument: vi.fn((handler: Function) => {
        onDidSaveHandlers.push(handler);
        return { dispose: vi.fn() };
      }),
      getConfiguration: vi.fn(() => ({
        get: vi.fn(() => false),
      })),
      createFileSystemWatcher: vi.fn(() => ({
        onDidCreate: vi.fn((h: any) => { watcherEvents.onDidCreate.push(h); }),
        onDidChange: vi.fn((h: any) => { watcherEvents.onDidChange.push(h); }),
        onDidDelete: vi.fn((h: any) => { watcherEvents.onDidDelete.push(h); }),
        dispose: vi.fn(),
      })),
      workspaceFolders: [],
    },
    _registeredCommands: registeredCommands,
    _registeredProviders: registeredProviders,
    _onDidSaveHandlers: onDidSaveHandlers,
    _watcherEvents: watcherEvents,
    ...overrides,
  };
}

describe('_doActivate', () => {
  let context: { subscriptions: ReturnType<typeof makeSubscriptionArray> };
  let vscode: ReturnType<typeof makeVscodeMock>;

  beforeEach(() => {
    context = { subscriptions: makeSubscriptionArray() };
    vscode = makeVscodeMock();
    overrideVscodeForTest(null);
  });

  test('registers sidebar webview provider', () => {
    _doActivate(context as any, vscode as any);
    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      'markdownExplorerSidebar',
      expect.any(Object),
    );
  });

  test('registers markdownExplorer.open command', () => {
    _doActivate(context as any, vscode as any);
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'markdownExplorer.open',
      expect.any(Function),
    );
  });

  test('markdownExplorer.open uses active editor markdown file', () => {
    vscode.window.activeTextEditor = {
      document: { languageId: 'markdown', fileName: '/test/readme.md' },
    };
    _doActivate(context as any, vscode as any);
    const openFn = vscode._registeredCommands['markdownExplorer.open'];
    openFn();
    expect(Panel.createOrShow).toHaveBeenCalledWith(context, '/test/readme.md');
  });

  test('markdownExplorer.open ignores unsupported editor', () => {
    vscode.window.activeTextEditor = {
      document: { languageId: 'python', fileName: '/test/main.py' },
    };
    _doActivate(context as any, vscode as any);
    const openFn = vscode._registeredCommands['markdownExplorer.open'];
    openFn();
    expect(Panel.createOrShow).toHaveBeenCalledWith(context, null);
  });

  test('markdownExplorer.openFile uses URI fsPath', () => {
    _doActivate(context as any, vscode as any);
    const openFileFn = vscode._registeredCommands['markdownExplorer.openFile'];
    openFileFn({ fsPath: '/test/page.md' });
    expect(Panel.createOrShow).toHaveBeenCalledWith(context, '/test/page.md');
  });

  test('markdownExplorer.openFile falls back to editor when no URI', () => {
    vscode.window.activeTextEditor = {
      document: { languageId: 'markdown', fileName: '/test/doc.md' },
    };
    _doActivate(context as any, vscode as any);
    const openFileFn = vscode._registeredCommands['markdownExplorer.openFile'];
    openFileFn(undefined);
    expect(Panel.createOrShow).toHaveBeenCalledWith(context, '/test/doc.md');
  });

  test('markdownExplorer.toggle disposes existing panel', () => {
    const mockDispose = vi.fn();
    Panel.currentPanel = { dispose: mockDispose };
    _doActivate(context as any, vscode as any);
    const toggleFn = vscode._registeredCommands['markdownExplorer.toggle'];
    toggleFn();
    expect(mockDispose).toHaveBeenCalled();
    Panel.currentPanel = undefined;
  });

  test('markdownExplorer.toggle creates panel when none exists', () => {
    Panel.currentPanel = undefined;
    vscode.window.activeTextEditor = {
      document: { languageId: 'markdown', fileName: '/test/file.md' },
    };
    _doActivate(context as any, vscode as any);
    const toggleFn = vscode._registeredCommands['markdownExplorer.toggle'];
    toggleFn();
    expect(Panel.createOrShow).toHaveBeenCalled();
  });

  test('markdownExplorer.refresh calls panel refresh', () => {
    const mockRefresh = vi.fn();
    Panel.currentPanel = { refresh: mockRefresh };
    _doActivate(context as any, vscode as any);
    const refreshFn = vscode._registeredCommands['markdownExplorer.refresh'];
    refreshFn();
    expect(mockRefresh).toHaveBeenCalled();
    Panel.currentPanel = undefined;
  });

  test('markdownExplorer.refresh handles null panel gracefully', () => {
    _doActivate(context as any, vscode as any);
    const refreshFn = vscode._registeredCommands['markdownExplorer.refresh'];
    expect(() => refreshFn()).not.toThrow();
  });

  test('auto-refresh on supported file save', () => {
    const mockRefreshFromWatch = vi.fn();
    Panel.currentPanel = { refreshFromWatch: mockRefreshFromWatch };
    vscode.workspace.getConfiguration.mockReturnValue({
      get: vi.fn(() => true),
    });
    _doActivate(context as any, vscode as any);
    vscode._onDidSaveHandlers[0]({ fileName: '/test/readme.md' });
    expect(mockRefreshFromWatch).toHaveBeenCalled();
    Panel.currentPanel = undefined;
  });

  test('auto-refresh skips non-supported files', () => {
    const mockRefresh = vi.fn();
    Panel.currentPanel = { refresh: mockRefresh };
    vscode.workspace.getConfiguration.mockReturnValue({
      get: vi.fn(() => true),
    });
    _doActivate(context as any, vscode as any);
    vscode._onDidSaveHandlers[0]({ fileName: '/test/file.py' });
    expect(mockRefresh).not.toHaveBeenCalled();
    Panel.currentPanel = undefined;
  });

  test('auto-refresh skips when autoRefresh disabled', () => {
    const mockRefresh = vi.fn();
    Panel.currentPanel = { refresh: mockRefresh };
    vscode.workspace.getConfiguration.mockReturnValue({
      get: vi.fn(() => false),
    });
    _doActivate(context as any, vscode as any);
    vscode._onDidSaveHandlers[0]({ fileName: '/test/readme.md' });
    expect(mockRefresh).not.toHaveBeenCalled();
    Panel.currentPanel = undefined;
  });

  test('registers file system watcher', () => {
    _doActivate(context as any, vscode as any);
    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
  });

  test('file watcher onDidCreate refreshes panel', () => {
    const mockRefreshFromWatch = vi.fn();
    Panel.currentPanel = { refreshFromWatch: mockRefreshFromWatch };
    _doActivate(context as any, vscode as any);
    vscode._watcherEvents.onDidCreate[0]({ fsPath: '/test/new.md' });
    expect(mockRefreshFromWatch).toHaveBeenCalled();
    Panel.currentPanel = undefined;
  });

  test('file watcher onDidChange refreshes panel with file path', () => {
    const mockRefreshFromWatch = vi.fn();
    Panel.currentPanel = { refreshFromWatch: mockRefreshFromWatch };
    _doActivate(context as any, vscode as any);
    vscode._watcherEvents.onDidChange[0]({ fsPath: '/test/changed.md' });
    expect(mockRefreshFromWatch).toHaveBeenCalledWith('/test/changed.md');
    Panel.currentPanel = undefined;
  });

  test('file watcher onDidDelete refreshes panel', () => {
    const mockRefresh = vi.fn();
    Panel.currentPanel = { refresh: mockRefresh };
    _doActivate(context as any, vscode as any);
    vscode._watcherEvents.onDidDelete[0]();
    expect(mockRefresh).toHaveBeenCalled();
    Panel.currentPanel = undefined;
  });

  test('pushes all subscriptions to context', () => {
    _doActivate(context as any, vscode as any);
    expect(context.subscriptions.subs.length).toBeGreaterThanOrEqual(6);
  });

  test('registerCommand calls return disposables pushed to context', () => {
    _doActivate(context as any, vscode as any);
    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(4);
  });

  test('onDidSaveTextDocument called with handler', () => {
    _doActivate(context as any, vscode as any);
    expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalled();
  });

  test('uses known supported file extensions in editor check', () => {
    vscode.window.activeTextEditor = {
      document: { languageId: 'plaintext', fileName: '/test/notes.txt' },
    };
    _doActivate(context as any, vscode as any);
    const openFn = vscode._registeredCommands['markdownExplorer.open'];
    openFn();
    expect(Panel.createOrShow).toHaveBeenCalledWith(context, '/test/notes.txt');
  });

  test('openFile without URI and without editor sends null', () => {
    vscode.window.activeTextEditor = undefined;
    _doActivate(context as any, vscode as any);
    const openFileFn = vscode._registeredCommands['markdownExplorer.openFile'];
    openFileFn();
    expect(Panel.createOrShow).toHaveBeenCalledWith(context, null);
  });

  test('deactivate is a no-op', () => {
    expect(() => deactivate()).not.toThrow();
  });
});