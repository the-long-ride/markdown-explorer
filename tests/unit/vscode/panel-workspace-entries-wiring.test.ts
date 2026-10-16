import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mockPostMessage = vi.fn();
const mockOnDidReceiveMessage = vi.fn();
let workspaceRoot = '';

const { overrideVscodeForTest, MarkdownDocsPanel } = await import('../../../vscode/src/core/panel');

function createPanel(): any {
  overrideVscodeForTest({
    workspace: {
      get workspaceFolders() { return [{ uri: { fsPath: workspaceRoot }, name: 'ws' }]; },
      getConfiguration() { return { get: () => undefined, update: vi.fn() }; },
      fs: { delete: vi.fn(async () => {}) },
    },
    window: {
      createWebviewPanel() {
        return {
          onDidDispose: vi.fn(),
          webview: { onDidReceiveMessage: mockOnDidReceiveMessage, postMessage: mockPostMessage, asWebviewUri: vi.fn(), cspSource: 'csp', html: '', options: {} },
          reveal: vi.fn(), dispose: vi.fn(), title: '',
        };
      },
    },
    ViewColumn: { Active: 1, One: 1 },
    Uri: { file: (f: string) => ({ fsPath: f }), parse: (u: string) => u },
    env: { clipboard: { writeText: vi.fn() }, openExternal: vi.fn() },
    ConfigurationTarget: { Global: 1 },
  });
  MarkdownDocsPanel.createOrShow({ extensionPath: '/fake/ext', extension: { packageJSON: { version: '1.0' } } } as any, null);
  return MarkdownDocsPanel.currentPanel;
}

describe('panel workspace entry wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MarkdownDocsPanel.currentPanel = undefined;
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vsc-wiring-'));
  });
  afterEach(() => {
    MarkdownDocsPanel.currentPanel = undefined;
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('routes createWorkspaceEntry through the panel, refreshing from the watcher path before replying', async () => {
    const panel = createPanel();
    const order: string[] = [];
    panel.refreshFromWatch = vi.fn(async () => { order.push('refresh'); });
    mockPostMessage.mockImplementation((message: any) => { order.push(message.command); });
    const handler = mockOnDidReceiveMessage.mock.calls[0][0];
    await handler({ command: 'createWorkspaceEntry', requestId: 'w1', parentPath: '', name: 'notes.md', kind: 'file' });
    expect(fs.existsSync(path.join(workspaceRoot, 'notes.md'))).toBe(true);
    expect(panel.refreshFromWatch).toHaveBeenCalledWith(null);
    expect(order).toEqual(['refresh', 'createWorkspaceEntryResult']);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'createWorkspaceEntryResult', requestId: 'w1', ok: true, kind: 'file', path: 'notes.md' });
  });

  it('routes deleteWorkspaceEntries through workspace.fs trash', async () => {
    createPanel();
    fs.writeFileSync(path.join(workspaceRoot, 'a.md'), 'a');
    (MarkdownDocsPanel.currentPanel as any).refreshFromWatch = vi.fn(async () => {});
    const handler = mockOnDidReceiveMessage.mock.calls[0][0];
    await handler({ command: 'deleteWorkspaceEntries', requestId: 'w2', paths: ['a.md'] });
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'deleteWorkspaceEntriesResult', requestId: 'w2', mode: 'trash', deleted: ['a.md'], failed: [] });
  });
});
