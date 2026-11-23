import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { makeSearchExcerpt, searchMarkdownItems, searchMarkdownItemsIncremental } from '../../../vscode/src/core/panelSearch';
import { handlePanelWorkspaceSearch } from '../../../vscode/src/core/panelWorkspaceSearch';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-search-stream-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function fixture(file: string, source: string) {
  const fsPath = path.join(root, file);
  fs.writeFileSync(fsPath, source);
  return { fsPath, fileName: '', relativePath: '', title: '', parts: [file] };
}

test('skips absent and unsupported paths, matches binary files by name, and reports capped batches', async () => {
  const hits = fixture('notes.txt', 'needle here, needle again Needle');
  const metadata = fixture('needle.pdf', 'binary fixture');
  const unsupported = fixture('needle.png', 'needle');
  const items = [{ ...hits, fsPath: '' }, { ...hits, fsPath: path.join(root, 'missing.md') }, unsupported, hits, metadata];
  expect(searchMarkdownItems('n', undefined, items)).toEqual([]);
  expect(searchMarkdownItems('needle', items, [], 10, { matchCase: true })).toEqual(expect.arrayContaining([
    expect.objectContaining({ fsPath: hits.fsPath, matchIndex: 0, matchOrdinal: 0 }),
    expect.objectContaining({ fsPath: hits.fsPath, matchIndex: 13, matchOrdinal: 1 }),
    expect.objectContaining({ fsPath: metadata.fsPath, excerpt: '', title: 'needle' }),
  ]));
  const onBatch = vi.fn();
  await expect(searchMarkdownItemsIncremental('needle', items, [], { limit: 2, batchSize: 1, matchCase: true, onBatch }))
    .resolves.toEqual({ total: 2, truncated: true, cancelled: false });
  expect(onBatch.mock.calls.map(([batch]) => batch[0].matchOrdinal)).toEqual([0, 1]);
  await expect(searchMarkdownItemsIncremental('n', undefined, items)).resolves.toEqual({ total: 0, truncated: false, cancelled: false });
  await expect(searchMarkdownItemsIncremental('needle', undefined, [metadata])).resolves.toEqual({ total: 1, truncated: false, cancelled: false });
});

test('yields to cancellation after processing the first document and publishes the buffered replies', async () => {
  const first = fixture('first.md', 'found');
  const second = fixture('second.md', 'found');
  const shouldCancel = vi.fn(() => false).mockReturnValueOnce(false).mockReturnValueOnce(true);
  const onBatch = vi.fn();
  await expect(searchMarkdownItemsIncremental('found', undefined, [first, second], { shouldCancel, onBatch, yieldEvery: 1 }))
    .resolves.toEqual({ total: 1, truncated: false, cancelled: true });
  expect(onBatch).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ fsPath: first.fsPath })]);
  onBatch.mockClear();
  await expect(searchMarkdownItemsIncremental('found', undefined, [first], { shouldCancel: () => true, onBatch }))
    .resolves.toEqual({ total: 0, truncated: false, cancelled: true });
  expect(onBatch).not.toHaveBeenCalled();
});

test('drops superseded search batches and preserves the current request ID', async () => {
  const flatList = Array.from({ length: 30 }, (_, index) => fixture(`${index}.md`, 'needle'));
  const postMessage = vi.fn(async () => {});
  const context = { flatList, panel: { webview: { postMessage } }, generation: { value: 0 } };
  const stale = handlePanelWorkspaceSearch({ query: 'needle', requestId: 'old' }, context);
  await handlePanelWorkspaceSearch({ query: 'different', requestId: 'new' }, context);
  await stale;
  const replies = postMessage.mock.calls.flat();
  expect(replies.filter(message => message.requestId === 'old').every(message => !message.done)).toBe(true);
  expect(replies).toContainEqual(expect.objectContaining({ command: 'workspaceSearchResults', requestId: 'new', done: true, total: 0 }));
});

test.each([new Error('webview disconnected'), 'webview disconnected'])('replies with a normalized error when the first post fails: %s', async error => {
  const postMessage = vi.fn(async () => {}).mockRejectedValueOnce(error);
  const context = { flatList: [], panel: { webview: { postMessage } }, generation: { value: 0 } };
  await handlePanelWorkspaceSearch({ query: 'needle', requestId: 'failed' }, context);
  expect(postMessage).toHaveBeenLastCalledWith({
    command: 'workspaceSearchResults', requestId: 'failed', done: true, results: [],
    total: 0, truncated: false, cancelled: false, error: 'webview disconnected',
  });
});

test('limits excerpts to ten context words on each side', () => {
  const before = 'zero one two three four five six seven eight nine ten ';
  const after = ' A B C D E F G H I J K';
  expect(makeSearchExcerpt(`${before}target${after}`, before.length, 6))
    .toBe('... one two three four five six seven eight nine ten target A B C D E F G H I J ...');
  expect(makeSearchExcerpt('before after', 6, 1)).toBe('before after');
});
