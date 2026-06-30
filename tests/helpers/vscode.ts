import { vi } from 'vitest';

export interface VsCodeMockApi {
  commands: {
    registerCommand: ReturnType<typeof vi.fn>;
    executeCommand: ReturnType<typeof vi.fn>;
  };
  window: {
    createWebviewPanel: ReturnType<typeof vi.fn>;
    registerWebviewViewProvider: ReturnType<typeof vi.fn>;
    activeTextEditor: any;
    showTextDocument: ReturnType<typeof vi.fn>;
  };
  workspace: {
    workspaceFolders: any[];
    getConfiguration: ReturnType<typeof vi.fn>;
    onDidSaveTextDocument: ReturnType<typeof vi.fn>;
    createFileSystemWatcher: ReturnType<typeof vi.fn>;
    openTextDocument: ReturnType<typeof vi.fn>;
    findFiles: ReturnType<typeof vi.fn>;
    fs: any;
  };
  env: {
    clipboard: { writeText: ReturnType<typeof vi.fn> };
    openExternal: ReturnType<typeof vi.fn>;
  };
  Uri: {
    file: ReturnType<typeof vi.fn>;
    parse: ReturnType<typeof vi.fn>;
    joinPath: ReturnType<typeof vi.fn>;
  };
  ExtensionMode: { Production: string; Development: string; Test: string };
}

export function createVsCodeMock(overrides: Partial<VsCodeMockApi> = {}): VsCodeMockApi & {
  context: any;
  subscriptions: any[];
  postMessage: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  setState: ReturnType<typeof vi.fn>;
  reset: () => void;
} {
  const subscriptions: any[] = [];
  const context = {
    subscriptions,
    extensionUri: { fsPath: '/tmp/test-extension' },
    extensionPath: '/tmp/test-extension',
    storageUri: { fsPath: '/tmp/test-storage' },
    globalState: { get: vi.fn(), update: vi.fn() },
    workspaceState: { get: vi.fn(), update: vi.fn() },
  };

  const stateStore: Record<string, any> = {};
  const postedMessages: any[] = [];

  const api: VsCodeMockApi & {
    context: any;
    subscriptions: any[];
    postMessage: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
    setState: ReturnType<typeof vi.fn>;
    reset: () => void;
  } = {
    commands: {
      registerCommand: vi.fn((_id: string, handler: Function) => {
        subscriptions.push({ dispose: vi.fn() });
        return { dispose: vi.fn() };
      }),
      executeCommand: vi.fn(),
    },
    window: {
      createWebviewPanel: vi.fn(() => ({
        webview: {
          html: '',
          options: {},
          asWebviewUri: vi.fn((uri: any) => uri),
          onDidReceiveMessage: vi.fn(),
          postMessage: vi.fn((msg: any) => {
            postedMessages.push(msg);
            return Promise.resolve(true);
          }),
        },
        onDidDispose: vi.fn(),
        onDidChangeViewState: vi.fn(),
        visible: true,
        active: true,
        dispose: vi.fn(),
        reveal: vi.fn(),
      })),
      registerWebviewViewProvider: vi.fn(() => {
        subscriptions.push({ dispose: vi.fn() });
        return { dispose: vi.fn() };
      }),
      activeTextEditor: null,
      showTextDocument: vi.fn(),
    },
    workspace: {
      workspaceFolders: [],
      getConfiguration: vi.fn((section: string) => ({
        get: vi.fn((key: string, defaultValue?: any) => defaultValue),
        update: vi.fn(),
        inspect: vi.fn(),
      })),
      onDidSaveTextDocument: vi.fn((handler: Function) => {
        subscriptions.push({ dispose: vi.fn() });
        return { dispose: vi.fn() };
      }),
      createFileSystemWatcher: vi.fn(() => ({
        onDidCreate: vi.fn((handler: Function) => {
          subscriptions.push({ dispose: vi.fn() });
          return { dispose: vi.fn() };
        }),
        onDidDelete: vi.fn((handler: Function) => {
          subscriptions.push({ dispose: vi.fn() });
          return { dispose: vi.fn() };
        }),
        dispose: vi.fn(),
      })),
      openTextDocument: vi.fn(() => Promise.resolve({})),
      findFiles: vi.fn(() => Promise.resolve([])),
      fs: { readFile: vi.fn() },
    },
    env: {
      clipboard: { writeText: vi.fn() },
      openExternal: vi.fn(),
    },
    Uri: {
      file: vi.fn((p: string) => ({ fsPath: p, path: p, scheme: 'file', toString: () => p })),
      parse: vi.fn((s: string) => ({ fsPath: s, path: s, scheme: 'file', toString: () => s })),
      joinPath: vi.fn((base: any, ...segments: string[]) => ({
        fsPath: [base.fsPath ?? base, ...segments].join('/'),
        path: [base.path ?? base, ...segments].join('/'),
        scheme: 'file',
        toString: () => [base.fsPath ?? base, ...segments].join('/'),
      })),
    },
    ExtensionMode: { Production: 'Production', Development: 'Development', Test: 'Test' },
    context,
    subscriptions,
    postMessage: vi.fn((msg: any) => {
      postedMessages.push(msg);
    }),
    getState: vi.fn(() => Object.keys(stateStore).length > 0 ? stateStore : undefined),
    setState: vi.fn((state: any) => Object.assign(stateStore, state)),
    reset() {
      subscriptions.length = 0;
      postedMessages.length = 0;
      Object.keys(stateStore).forEach((key) => delete stateStore[key]);
    },
    ...overrides,
  };

  return api;
}
