import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { registerRuntimeWorkspaceHandlers, WORKSPACE_SCAN_REVEAL_DELAY_MS } = require('../../../electron/core/runtime-workspace-handlers.js');
const utilities = require('../../../electron/core/runtime-utils.js');
const workspacePath = path.resolve('workspace');
const file = (number: number) => ({
  fsPath: path.join(workspacePath, 'notes', 'chapter', `file-${number}.md`),
  relativePath: `notes/chapter/file-${number}.md`,
  parts: ['notes', 'chapter', `file-${number}.md`],
});

function setup() {
  const state = {
    workspacePath, currentFile: null as string | null, flatList: [] as ReturnType<typeof file>[],
    workspaceWatch: { dispose: vi.fn() }, workspaceOperationId: 'scan', workspaceTabId: 'tab',
    documentConversionEnabled: true,
  };
  const fs = {
    accessSync: vi.fn(), existsSync: vi.fn(() => true),
    statSync: vi.fn((target: string) => ({ isFile: () => target !== workspacePath })),
    readFileSync: vi.fn(() => '<html>preview</html>'), constants: { R_OK: 4 },
  };
  const sendHostMessage = vi.fn();
  const sendLoading = vi.fn();
  const scanWorkspaceData = vi.fn();
  const index = { prime: vi.fn() };
  const worker = { dispose: vi.fn() };
  const createSearchWorkerController = vi.fn((_options) => worker);
  const getMainWindow = vi.fn(() => ({ isDestroyed: () => false }));
  const documentConverter = { readMarkdown: vi.fn(), createFailureMarkdown: vi.fn(() => '# failed') };
  const handlers = registerRuntimeWorkspaceHandlers({
    ...utilities, state, fs, pathApi: path, deps: { documentConverter },
    getMainWindow, sendHostMessage, sendLoading, scanWorkspaceData, getHostInfo: () => ({}),
    recentWorkspacesStore: { load: () => [] }, createSearchIndex: () => index, createSearchWorkerController,
  });
  return { state, fs, handlers, scanWorkspaceData, index, worker, getMainWindow, createSearchWorkerController,
    sendHostMessage, sendLoading, documentConverter };
}

afterEach(() => vi.useRealTimers());

describe('Electron workspace scan lifecycle', () => {
  test('reveals nested files incrementally and publishes the final tree including empty folders', async () => {
    vi.useFakeTimers();
    const { handlers, scanWorkspaceData, sendHostMessage, index } = setup();
    const flat = Array.from({ length: 32 }, (_, i) => file(i));
    const tree = { name: 'root', files: [], children: [{ name: 'notes', files: [], children: [
      { name: 'chapter', children: [], files: flat }, { name: 'empty', files: [], children: [] },
    ] }] };
    scanWorkspaceData.mockImplementation(async (_workspace, { onFile, isCurrent }) => {
      await vi.advanceTimersByTimeAsync(WORKSPACE_SCAN_REVEAL_DELAY_MS);
      expect(isCurrent()).toBe(true);
      flat.forEach((entry, i) => onFile(entry, i + 1));
      return { tree, flat };
    });
    await expect(handlers.sendWorkspaceData()).resolves.toBe(true);
    expect(sendHostMessage.mock.calls.map(([message]) => message.command)).toEqual([
      'readyAck', 'workspaceFilesChanged', 'workspaceFilesChanged',
    ]);
    const [incremental] = sendHostMessage.mock.calls[1];
    expect(incremental.tree.children[0].children[0]).toMatchObject({ path: 'notes/chapter' });
    expect(incremental.tree.children[0].children[0].files).toHaveLength(32);
    expect(sendHostMessage).toHaveBeenLastCalledWith(expect.objectContaining({ tree, workspaceOperationId: 'scan', workspaceTabId: 'tab' }));
    expect(index.prime).toHaveBeenCalledExactlyOnceWith(flat);
  });

  test.each(['different workspace', 'different scan', 'different tab', 'cancelled'])('drops progress and final state for a stale scan: %s', async (caseName) => {
    vi.useFakeTimers();
    const { handlers, state, scanWorkspaceData, sendHostMessage, index } = setup();
    scanWorkspaceData.mockImplementation(async (_workspace, { onFile, isCurrent }) => {
      expect(handlers.cancelWorkspaceScan('unrelated-scan')).toBe(false);
      onFile(file(0), 1);
      if (caseName === 'different workspace') state.workspacePath = path.resolve('other');
      if (caseName === 'different scan') state.workspaceOperationId = 'new';
      if (caseName === 'different tab') state.workspaceTabId = 'new';
      if (caseName === 'cancelled') expect(handlers.cancelWorkspaceScan('scan')).toBe(true);
      expect(isCurrent()).toBe(false);
      onFile(file(1), 2);
      await vi.advanceTimersByTimeAsync(WORKSPACE_SCAN_REVEAL_DELAY_MS);
      return { tree: null, flat: [file(0), file(1)] };
    });
    await expect(handlers.sendWorkspaceData()).resolves.toBe(false);
    expect(sendHostMessage).not.toHaveBeenCalled();
    expect(index.prime).not.toHaveBeenCalled();
  });

  test.each(['changed workspace', 'cancelled'])('does not apply a stale refresh: %s', async (caseName) => {
    const { handlers, state, scanWorkspaceData, sendHostMessage } = setup();
    scanWorkspaceData.mockImplementation(async (_workspace, { isCurrent }) => {
      expect(isCurrent()).toBe(true);
      if (caseName === 'cancelled') handlers.cancelAllWorkspaceScans();
      else state.workspacePath = path.resolve('other');
      expect(isCurrent()).toBe(false);
      return { tree: null, flat: [file(1)] };
    });
    await expect(handlers.sendWorkspaceFilesChanged()).resolves.toBe(false);
    expect(sendHostMessage).not.toHaveBeenCalled();
    expect(state.flatList).toEqual([]);
  });

  test('clears the active scan and watcher for unavailable workspaces', async () => {
    const { handlers, state, fs, sendHostMessage } = setup();
    fs.accessSync.mockImplementation(() => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); });
    await expect(handlers.sendWorkspaceFilesChanged()).resolves.toBe(false);
    await expect(handlers.sendWorkspaceData()).resolves.toBe(false);
    expect(state.workspaceWatch.dispose).toHaveBeenCalledOnce();
    expect(sendHostMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      command: 'workspaceUnavailable', workspacePath, workspaceOperationId: 'scan', workspaceTabId: 'tab', reason: 'locked',
    }));
    expect(state).toMatchObject({ workspacePath: null, workspaceOperationId: null, workspaceTabId: null });
  });
});

describe('Electron workspace navigation and content delivery', () => {
  test('renders local HTML and does not call the markdown converter', async () => {
    const { handlers, state, fs, sendHostMessage, documentConverter } = setup();
    state.currentFile = path.join(workspacePath, 'page.html');
    expect(handlers.resolveNavigationPath('#heading')).toBe(state.currentFile);
    await handlers.sendInitialContent(true);
    expect(fs.readFileSync).toHaveBeenCalledExactlyOnceWith(state.currentFile, 'utf8');
    expect(documentConverter.readMarkdown).not.toHaveBeenCalled();
    expect(sendHostMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      command: 'renderContent', filePath: state.currentFile, sourceDocumentText: '<html>preview</html>',
    }));
    fs.readFileSync.mockImplementation(() => { throw new Error('file removed'); });
    await handlers.sendContent();
    expect(documentConverter.createFailureMarkdown).not.toHaveBeenCalled();
    expect(sendHostMessage).toHaveBeenLastCalledWith(expect.objectContaining({ sourceDocumentText: null }));
  });

  test('discards slow conversion results after the current file changes', async () => {
    const { handlers, state, documentConverter, sendHostMessage, sendLoading } = setup();
    state.currentFile = path.join(workspacePath, 'report.pdf');
    documentConverter.readMarkdown.mockImplementation(async () => {
      state.currentFile = file(0).fsPath;
      return { markdown: '# stale', previewInfo: {} };
    });
    await handlers.sendContent();
    expect(sendLoading).toHaveBeenCalledExactlyOnceWith('Preparing document preview...', 'Preparing PDF preview locally.');
    expect(sendHostMessage).not.toHaveBeenCalled();
  });

  test('only routes search worker batches for live windows and meaningful messages', () => {
    const { handlers, createSearchWorkerController, getMainWindow, sendHostMessage, worker } = setup();
    expect(handlers.ensureCrossTabSearchWorker()).toBe(worker);
    expect(handlers.ensureCrossTabSearchWorker()).toBe(worker);
    const { onMessage } = createSearchWorkerController.mock.calls[0][0];
    getMainWindow.mockReturnValueOnce(null);
    onMessage({ type: 'batch', requestId: 'dropped', results: [] });
    onMessage({ type: 'progress', requestId: 'ignored' });
    onMessage({ type: 'done', requestId: 'done', total: 3, truncated: true, cancelled: true });
    expect(sendHostMessage).toHaveBeenCalledExactlyOnceWith({
      command: 'crossTabSearchResults', requestId: 'done', results: [], done: true,
      total: 3, truncated: true, cancelled: true, error: undefined,
    });
  });
});
