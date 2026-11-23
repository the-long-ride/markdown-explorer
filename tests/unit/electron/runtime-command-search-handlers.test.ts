import { createRequire } from 'node:module';
import { afterEach, describe, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createRuntimeCommandSearchHandlers } = require('../../../electron/core/runtime-command-search-handlers.js');

const current = { fsPath: '/workspace/current.md' };
const indexed = { fsPath: '/indexed/other.md' };

function setup(searchIncremental?: Function) {
  const index = { prime: vi.fn(), read: vi.fn(), search: vi.fn(() => [current]), searchIncremental };
  const worker = { search: vi.fn(), setItems: vi.fn() };
  const scanWorkspaceData = vi.fn();
  const sendHostMessage = vi.fn();
  const fs = { existsSync: vi.fn(() => true) };
  const handlers = createRuntimeCommandSearchHandlers({
    state: { flatList: [null, current] },
    fs,
    ensureHeavyModules: vi.fn(),
    ensureSearchIndex: () => index,
    ensureCrossTabSearchWorker: () => worker,
    scanWorkspaceData,
    sendHostMessage,
  });
  return { handlers, index, worker, scanWorkspaceData, sendHostMessage, fs };
}

afterEach(() => vi.useRealTimers());

describe('Electron workspace search commands', () => {
  test('normalizes cross-workspace searches and optional tab filters', () => {
    const { handlers, worker } = setup();
    handlers.handleSearchAcrossWorkspaces({ requestId: 'all' });
    handlers.handleSearchAcrossWorkspaces({ requestId: 'filtered', query: ' query ', tabIds: [1, '2'], matchCase: true });
    expect(worker.search.mock.calls).toEqual([
      [{ requestId: 'all', query: '', matchCase: false }],
      [{ requestId: 'filtered', query: 'query', matchCase: true, tabIds: ['1', '2'] }],
    ]);
  });

  test('answers synchronous searches even when the index throws', () => {
    const { handlers, index, sendHostMessage } = setup();
    handlers.handleSearchWorkspace({ requestId: 'ok', query: ' find ', items: [indexed], matchCase: true });
    expect(index.search).toHaveBeenCalledWith('find', [indexed], 10000, { matchCase: true });
    index.search.mockImplementationOnce(() => { throw new Error('read failed'); });
    handlers.handleSearchWorkspace({ requestId: 'failed' });
    expect(index.search).toHaveBeenLastCalledWith('', [null, current], 10000, { matchCase: false });
    expect(sendHostMessage.mock.calls).toEqual([
      [{ command: 'workspaceSearchResults', requestId: 'ok', results: [current], done: true, total: 1, truncated: false, cancelled: false }],
      [{ command: 'workspaceSearchResults', requestId: 'failed', results: [], done: true, total: 0, truncated: false, cancelled: false }],
    ]);
  });

  test('streams batches and completion only for the latest incremental request', async () => {
    vi.useFakeTimers();
    type Options = { shouldCancel: () => boolean; onBatch: (results: unknown[]) => void };
    type Summary = { total: number; truncated: boolean; cancelled: boolean };
    const searches: { options: Options; resolve: (value: Summary) => void; reject: (reason: unknown) => void }[] = [];
    const search = vi.fn((_query, _items, options: Options) =>
      new Promise<Summary>((resolve, reject) => searches.push({ options, resolve, reject })));
    const { handlers, sendHostMessage } = setup(search);
    for (const requestId of ['stale success', 'stale failure', 'current']) {
      handlers.handleSearchWorkspace({ requestId });
    }
    expect(searches.map(({ options }) => options.shouldCancel())).toEqual([true, true, false]);
    const summary = { total: 1, truncated: false, cancelled: false };
    searches[0].options.onBatch([indexed]);
    searches[0].resolve(summary);
    searches[1].reject(new Error('stale failure'));
    searches[2].options.onBatch([current]);
    searches[2].resolve(summary);
    await vi.runAllTimersAsync();
    expect(sendHostMessage.mock.calls).toEqual([
      [{ command: 'workspaceSearchResults', requestId: 'current', results: [current], done: false }],
      [{ command: 'workspaceSearchResults', requestId: 'current', results: [], done: true, ...summary }],
    ]);
  });

  test.each([new Error('bad index'), 'bad index'])('reports incremental failure (%s)', async (error) => {
    const { handlers, sendHostMessage } = setup(vi.fn().mockRejectedValue(error));
    handlers.handleSearchWorkspace({ requestId: 'failed' });
    await vi.waitFor(() => expect(sendHostMessage).toHaveBeenCalledWith({
      command: 'workspaceSearchResults', requestId: 'failed', results: [], done: true,
      total: 0, truncated: false, cancelled: false, error: 'bad index',
    }));
  });

  test('loads search previews only for current or indexed files', () => {
    const { handlers, index, worker, sendHostMessage } = setup();
    const items = [null, {}, indexed];
    handlers.handleIndexWorkspaceSearchItems({ items });
    expect(index.prime).toHaveBeenCalledWith(items);
    expect(worker.setItems).toHaveBeenCalledWith(items);
    index.read.mockReturnValue('# source');
    handlers.handleLoadSearchPreview({ requestId: 'current', filePath: current.fsPath });
    handlers.handleLoadSearchPreview({ requestId: 'indexed', filePath: indexed.fsPath });
    handlers.handleIndexWorkspaceSearchItems({});
    handlers.handleLoadSearchPreview({ requestId: 'outside', filePath: indexed.fsPath });
    handlers.handleLoadSearchPreview({ requestId: 'missing-path' });
    handlers.handleLoadSearchPreview({ filePath: current.fsPath });
    expect(index.read.mock.calls).toEqual([[current.fsPath], [indexed.fsPath]]);
    expect(sendHostMessage.mock.calls).toEqual([
      [{ command: 'searchPreviewResult', requestId: 'current', filePath: current.fsPath, ok: true, markdownSource: '# source' }],
      [{ command: 'searchPreviewResult', requestId: 'indexed', filePath: indexed.fsPath, ok: true, markdownSource: '# source' }],
      [{ command: 'searchPreviewResult', requestId: 'outside', filePath: indexed.fsPath, ok: false, reason: 'outside-workspace' }],
      [{ command: 'searchPreviewResult', requestId: 'missing-path', filePath: '', ok: false, reason: 'outside-workspace' }],
      [{ command: 'searchPreviewResult', requestId: '', filePath: current.fsPath, ok: false, reason: 'outside-workspace' }],
    ]);
  });

  test('distinguishes unsupported, missing, and unreadable search previews', () => {
    const { handlers, index, fs, sendHostMessage } = setup();
    index.read.mockReturnValueOnce(null).mockReturnValueOnce(null).mockImplementationOnce(() => { throw new Error('denied'); });
    fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
    for (const requestId of ['unsupported', 'missing', 'unreadable']) {
      handlers.handleLoadSearchPreview({ requestId, filePath: current.fsPath });
      expect(sendHostMessage).toHaveBeenLastCalledWith({
        command: 'searchPreviewResult', requestId, filePath: current.fsPath, ok: false, reason: requestId,
      });
    }
  });

  test('loads available tab indexes, skips malformed tabs, and reports unavailable tabs', async () => {
    vi.useFakeTimers();
    const { handlers, scanWorkspaceData, fs, index, sendHostMessage } = setup();
    const tree = { name: 'workspace' };
    scanWorkspaceData.mockResolvedValueOnce({ tree, flat: [current] }).mockRejectedValueOnce(new Error('denied'));
    fs.existsSync.mockImplementation((workspacePath: string) => workspacePath !== '/missing');
    handlers.handleLoadWorkspaceSearchIndexes({});
    handlers.handleLoadWorkspaceSearchIndexes({
      tabs: [null, { tabId: 'malformed' }, { tabId: 'missing', workspacePath: '/missing' },
        { tabId: 'ok', workspacePath: '/workspace' }, { tabId: 'denied', workspacePath: '/denied' }],
    });
    await vi.runAllTimersAsync();
    expect(scanWorkspaceData.mock.calls).toEqual([
      ['/workspace', { emitProgress: false }], ['/denied', { emitProgress: false }],
    ]);
    expect(index.prime).toHaveBeenCalledExactlyOnceWith([current]);
    expect(sendHostMessage.mock.calls).toEqual([
      [{ command: 'workspaceSearchIndexLoaded', tabs: [{ tabId: 'missing', workspacePath: '/missing', fileList: [], tree: null }] }],
      [{ command: 'workspaceSearchIndexLoaded', tabs: [{ tabId: 'ok', workspacePath: '/workspace', fileList: [current], tree }] }],
      [{ command: 'workspaceSearchIndexLoaded', tabs: [{ tabId: 'denied', workspacePath: '/denied', fileList: [], tree: null }] }],
    ]);
  });
});
