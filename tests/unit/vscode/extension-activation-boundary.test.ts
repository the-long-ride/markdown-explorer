import { describe, expect, test, vi } from 'vitest';

function makeContext() {
  return {
    subscriptions: { push: vi.fn() },
  };
}

function makeVscode() {
  const registeredCommands: string[] = [];
  return {
    commands: {
      registerCommand: vi.fn((command: string) => {
        registeredCommands.push(command);
        return { dispose: vi.fn() };
      }),
    },
    window: { activeTextEditor: undefined },
    workspace: {
      onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
      getConfiguration: vi.fn(() => ({ get: vi.fn(() => false) })),
      createFileSystemWatcher: vi.fn(() => ({
        onDidCreate: vi.fn(),
        onDidChange: vi.fn(),
        onDidDelete: vi.fn(),
        dispose: vi.fn(),
      })),
    },
    registeredCommands,
  };
}

describe('VS Code activation boundary', () => {
  // Regression gate for the packaged 1.6.7 report: a viewer dependency failure
  // must not prevent VS Code from registering markdownExplorer.open.
  test('registers commands even when viewer modules are unavailable until a command runs', async () => {
    vi.resetModules();
    vi.doMock('../../../vscode/src/core/panel', () => {
      throw new Error('viewer module should load after activation');
    });
    vi.doMock('../../../vscode/src/core/documentConversion', () => {
      throw new Error('conversion module should load after activation');
    });

    const { _doActivate } = await import('../../../vscode/src/extension?activation-boundary');
    const vscode = makeVscode();

    expect(() => _doActivate(makeContext() as any, vscode as any)).not.toThrow();
    expect(vscode.registeredCommands).toContain('markdownExplorer.open');
  });
});
