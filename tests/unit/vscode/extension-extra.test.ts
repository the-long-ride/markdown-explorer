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

const { overrideVscodeForTest, deactivate, _doActivate, activate } = await import(
  '../../../vscode/src/extension'
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
  const registeredProviders: Record<string, any> = [];
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
      executeCommand: vi.fn(),
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
        onDidChange: vi.fn((h: any) => { watcherEvents.onDidChange?.push(h); }),
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

describe('deactivate', () => {
  test('deactivate is exported as a function', () => {
    expect(typeof deactivate).toBe('function');
  });

  test('deactivate returns undefined', () => {
    expect(deactivate()).toBeUndefined();
  });

  test('deactivate does not throw', () => {
    expect(() => deactivate()).not.toThrow();
  });

  test('calling deactivate multiple times is safe', () => {
    deactivate();
    deactivate();
    deactivate();
  });
});

describe('activate', () => {
  test('activate is exported as a function', () => {
    expect(typeof activate).toBe('function');
  });

  test('activate calls _doActivate with vscode from getVscode', () => {
    const vscode = makeVscodeMock();
    overrideVscodeForTest(vscode);
    const context = { subscriptions: makeSubscriptionArray() };
    activate(context as any);
    expect(vscode.commands.registerCommand).toHaveBeenCalled();
  });
});

describe('module exports', () => {
  test('_doActivate is exported', () => {
    expect(typeof _doActivate).toBe('function');
  });

  test('overrideVscodeForTest is exported', () => {
    expect(typeof overrideVscodeForTest).toBe('function');
  });
});

describe('MarkdownExplorerSidebarProvider', () => {
  let vscode: ReturnType<typeof makeVscodeMock>;

  beforeEach(() => {
    vscode = makeVscodeMock();
    overrideVscodeForTest(vscode);
  });

  test('does not register obsolete sidebar webview provider', () => {
    const context = { subscriptions: makeSubscriptionArray() };
    _doActivate(context as any, vscode as any);

    expect(vscode.window.registerWebviewViewProvider).not.toHaveBeenCalled();
  });
});
