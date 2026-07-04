import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createSearchWorkerHandler, handleWorkerMessage, resolveMessageItems, resolveRequestId, resolveQuery } = require('../../../electron/search/search-worker.js');
const { createSearchIndex } = require('../../../electron/search/search-index.js');

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

async function settleTimers(ms = 50) {
  await vi.advanceTimersByTimeAsync(ms);
  await vi.advanceTimersByTimeAsync(0);
}

describe('createSearchWorkerHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('set-items replaces items and primes index', async () => {
    const dir = makeTempDir('sw-setitems-');
    const filePath = path.join(dir, 'test.md');
    writeFile(filePath, 'searchable term here');

    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    const items = [{
      fsPath: filePath,
      fileName: 'test.md',
      relativePath: 'test.md',
      title: 'Test',
    }];

    handler.handleMessage({ type: 'set-items', items });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      requestId: 'r1',
      query: 'searchable',
      batchSize: 100,
      maxResults: 2000,
      maxMatchesPerFile: 200,
      yieldEvery: 25,
    });

    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'r1');
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.total).toBeGreaterThan(0);
    expect(doneMsg.cancelled).toBe(false);
  });

  test('ignores unknown message types', () => {
    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'unknown-type' });
    expect(messages.length).toBe(0);
  });

  test('handles search with empty requestId', async () => {
    const dir = makeTempDir('sw-emptyreqid-');
    const filePath = path.join(dir, 'doc.md');
    writeFile(filePath, 'content with term');

    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    const items = [{
      fsPath: filePath,
      fileName: 'doc.md',
      relativePath: 'doc.md',
      title: 'Doc',
    }];

    handler.handleMessage({ type: 'set-items', items });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      requestId: '',
      query: 'term',
      batchSize: 100,
      maxResults: 2000,
      maxMatchesPerFile: 200,
      yieldEvery: 25,
    });

    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && !m.requestId);
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.total).toBeGreaterThan(0);
  });

  test('handles non-array items gracefully', async () => {
    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'set-items', items: null });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      requestId: 'r2',
      query: 'test',
      batchSize: 100,
      maxResults: 2000,
      maxMatchesPerFile: 200,
      yieldEvery: 25,
    });

    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'r2');
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.total).toBe(0);
  });

  test('cancels stale search when new search starts', async () => {
    const dir = makeTempDir('sw-cancel-');
    const items = Array.from({ length: 40 }, (_, i) => {
      const filePath = path.join(dir, `${i}.md`);
      writeFile(filePath, `common term ${i}`);
      return {
        fsPath: filePath,
        fileName: `${i}.md`,
        relativePath: `${i}.md`,
        title: `${i}`,
      };
    });

    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'set-items', items });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      requestId: 'stale',
      query: 'common',
      yieldEvery: 1,
    });

    handler.handleMessage({
      type: 'search',
      requestId: 'latest',
      query: 'nothing',
      yieldEvery: 1,
    });

    await settleTimers(200);

    const staleMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'stale');
    expect(staleMsg?.cancelled).toBe(true);

    const latestMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'latest');
    expect(latestMsg?.cancelled).toBe(false);
  });

  test('search returns empty for short queries', async () => {
    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'set-items', items: [] });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      requestId: 'short',
      query: 'a',
    });

    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'short');
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.total).toBe(0);
  });

  test('emits batch messages during search', async () => {
    const dir = makeTempDir('sw-batch-');
    const items = Array.from({ length: 5 }, (_, i) => {
      const filePath = path.join(dir, `${i}.md`);
      writeFile(filePath, Array.from({ length: 80 }, (_, j) => `needle ${i}-${j}`).join('\n'));
      return {
        fsPath: filePath,
        fileName: `${i}.md`,
        relativePath: `${i}.md`,
        title: `${i}`,
      };
    });

    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'set-items', items });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      requestId: 'batch-test',
      query: 'needle',
      batchSize: 50,
    });

    await settleTimers(100);

    const batchMsgs = messages.filter((m: any) => m.type === 'batch' && m.requestId === 'batch-test');
    expect(batchMsgs.length).toBeGreaterThan(0);
    batchMsgs.forEach((m: any) => {
      expect(m.results.length).toBeLessThanOrEqual(50);
    });
  });

  test('emits error message when search fails', async () => {
    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({
      type: 'search',
      requestId: 'err-test',
      query: 'test',
    });

    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'err-test');
    expect(doneMsg).toBeTruthy();
  });

  test('search with missing query string', async () => {
    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({
      type: 'search',
      requestId: 'no-query',
    });

    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'no-query');
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.total).toBe(0);
  });

  test('set-items resets activeRequestId causing in-flight search to cancel', async () => {
    const dir = makeTempDir('sw-reset-');
    const items = Array.from({ length: 30 }, (_, i) => {
      const filePath = path.join(dir, `${i}.md`);
      writeFile(filePath, `searchable content ${i}`);
      return {
        fsPath: filePath,
        fileName: `${i}.md`,
        relativePath: `${i}.md`,
        title: `${i}`,
      };
    });

    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'set-items', items });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      requestId: 'active',
      query: 'searchable',
      yieldEvery: 1,
    });

    await vi.advanceTimersByTimeAsync(1);

    handler.handleMessage({ type: 'set-items', items: [] });

    await settleTimers(100);

    const activeDone = messages.find((m: any) => m.type === 'done' && m.requestId === 'active');
    expect(activeDone).toBeTruthy();
  });

  test('ignores null message type', () => {
    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));
    handler.handleMessage({ type: null });
    expect(messages.length).toBe(0);
  });

  test('handles search with undefined requestId (defaults to "")', async () => {
    const dir = makeTempDir('sw-undefreqid-');
    const filePath = path.join(dir, 'doc.md');
    writeFile(filePath, 'content');

    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'set-items', items: [{ fsPath: filePath, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }] });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      query: 'content',
    });

    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done');
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.requestId).toBe('');
  });

  test('handles search with undefined query (defaults to "")', async () => {
    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'set-items', items: [] });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      requestId: 'no-query-undef',
      query: undefined,
    });

    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'no-query-undef');
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.total).toBe(0);
  });

  test('handles search with missing optional fields (batchSize, maxResults, etc.)', async () => {
    const dir = makeTempDir('sw-optfields-');
    const filePath = path.join(dir, 'doc.md');
    writeFile(filePath, 'findable content here');

    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'set-items', items: [{ fsPath: filePath, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }] });
    await settleTimers();

    handler.handleMessage({
      type: 'search',
      requestId: 'opt-test',
      query: 'findable',
    });

    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'opt-test');
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.total).toBeGreaterThan(0);
  });

  test('emits error message with string error (not Error instance)', async () => {
    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    handler.handleMessage({ type: 'set-items', items: [] });
    await settleTimers();

    vi.spyOn(handler.searchIndex, 'searchIncremental').mockRejectedValueOnce('string error');
    handler.handleMessage({ type: 'search', requestId: 'str-err', query: 'test' });

    await settleTimers();

    const errMsg = messages.find((m: any) => m.type === 'error' && m.requestId === 'str-err');
    expect(errMsg).toBeTruthy();
    expect(errMsg.message).toBe('string error');
  });
});

describe('search-worker additional branch coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('search handles missing type (goes to else of set-items, then !== search returns)', () => {
    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));
    handler.handleMessage({ type: 'other' });
    expect(messages.length).toBe(0);
  });

  test('set-items with valid items array, then search', async () => {
    const dir = makeTempDir('sw-setitems-valid-');
    const filePath = path.join(dir, 'test.md');
    writeFile(filePath, 'searchable term');

    const messages: any[] = [];
    const handler = createSearchWorkerHandler((msg: any) => messages.push(msg));

    const items = [{ fsPath: filePath, fileName: 'test.md', relativePath: 'test.md', title: 'Test' }];
    handler.handleMessage({ type: 'set-items', items });
    await settleTimers();

    handler.handleMessage({ type: 'search', requestId: 'r1', query: 'searchable' });
    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'r1');
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.total).toBeGreaterThan(0);
  });
});

describe('handleWorkerMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('set-items updates items and resets activeRequestId', async () => {
    const dir = makeTempDir('hwm-setitems-');
    const filePath = path.join(dir, 'test.md');
    writeFile(filePath, 'content');

    const messages: any[] = [];
    const state = { searchIndex: createSearchIndex(), items: { value: [] }, activeRequestId: { value: '' }, postMessage: (msg: any) => messages.push(msg) };

    const result = handleWorkerMessage({ type: 'set-items', items: [{ fsPath: filePath }] }, state);
    expect(result.activeRequestId).toBe('');
    expect(state.items.value.length).toBe(1);
  });

  test('set-items with non-array items sets items to empty array', () => {
    const state = { searchIndex: createSearchIndex(), items: { value: [] }, activeRequestId: { value: '' }, postMessage: () => {} };
    handleWorkerMessage({ type: 'set-items', items: null }, state);
    expect(state.items.value).toEqual([]);
  });

  test('returns null for non-search message type', () => {
    const state = { searchIndex: createSearchIndex(), items: { value: [] }, activeRequestId: { value: '' }, postMessage: () => {} };
    const result = handleWorkerMessage({ type: 'unknown' }, state);
    expect(result).toBeNull();
  });

  test('returns null for undefined message type', () => {
    const state = { searchIndex: createSearchIndex(), items: { value: [] }, activeRequestId: { value: '' }, postMessage: () => {} };
    const result = handleWorkerMessage({ type: undefined }, state);
    expect(result).toBeNull();
  });

  test('returns null for null message', () => {
    const state = { searchIndex: createSearchIndex(), items: { value: [] }, activeRequestId: { value: '' }, postMessage: () => {} };
    const result = handleWorkerMessage(null as any, state);
    expect(result).toBeNull();
  });

  test('search message with undefined requestId defaults to empty string', async () => {
    const dir = makeTempDir('hwm-noreqid-');
    const filePath = path.join(dir, 'doc.md');
    writeFile(filePath, 'findable content');

    const messages: any[] = [];
    const state = { searchIndex: createSearchIndex(), items: { value: [] }, activeRequestId: { value: '' }, postMessage: (msg: any) => messages.push(msg) };

    handleWorkerMessage({ type: 'set-items', items: [{ fsPath: filePath }] }, state);
    await settleTimers();

    const result = handleWorkerMessage({ type: 'search', query: 'findable' }, state);
    expect(result).not.toBeNull();
    expect(result!.activeRequestId).toBe('');

    await settleTimers();
    const doneMsg = messages.find((m: any) => m.type === 'done');
    expect(doneMsg).toBeTruthy();
  });

  test('search message with undefined query defaults to empty string', async () => {
    const messages: any[] = [];
    const state = { searchIndex: createSearchIndex(), items: { value: [] }, activeRequestId: { value: '' }, postMessage: (msg: any) => messages.push(msg) };

    handleWorkerMessage({ type: 'set-items', items: [] }, state);
    await settleTimers();

    handleWorkerMessage({ type: 'search', requestId: 'r1' }, state);
    await settleTimers();

    const doneMsg = messages.find((m: any) => m.type === 'done' && m.requestId === 'r1');
    expect(doneMsg).toBeTruthy();
    expect(doneMsg.total).toBe(0);
  });

  test('search emits error message for non-Error thrown from search', async () => {
    const messages: any[] = [];
    const state = { searchIndex: createSearchIndex(), items: { value: [] }, activeRequestId: { value: '' }, postMessage: (msg: any) => messages.push(msg) };

    vi.spyOn(state.searchIndex, 'searchIncremental').mockRejectedValueOnce('string error');
    handleWorkerMessage({ type: 'search', requestId: 'err', query: 'test' }, state);

    await settleTimers();

    const errMsg = messages.find((m: any) => m.type === 'error' && m.requestId === 'err');
    expect(errMsg).toBeTruthy();
    expect(errMsg!.message).toBe('string error');
  });
});

describe('resolveMessageItems', () => {
  test('returns items array when valid', () => {
    expect(resolveMessageItems({ type: 'set-items', items: [1, 2, 3] })).toEqual([1, 2, 3]);
  });

  test('returns empty array for null items', () => {
    expect(resolveMessageItems({ type: 'set-items', items: null })).toEqual([]);
  });

  test('returns empty array for undefined items', () => {
    expect(resolveMessageItems({ type: 'set-items' })).toEqual([]);
  });

  test('returns empty array for undefined message', () => {
    expect(resolveMessageItems(undefined as any)).toEqual([]);
  });

  test('returns empty array for null message', () => {
    expect(resolveMessageItems(null as any)).toEqual([]);
  });
});

describe('resolveRequestId', () => {
  test('returns requestId as string', () => {
    expect(resolveRequestId({ requestId: 'r1' })).toBe('r1');
  });

  test('defaults to empty string when undefined', () => {
    expect(resolveRequestId({})).toBe('');
  });

  test('defaults to empty string for null message', () => {
    expect(resolveRequestId(null as any)).toBe('');
  });

  test('converts number requestId to string', () => {
    expect(resolveRequestId({ requestId: 123 })).toBe('123');
  });
});

describe('resolveQuery', () => {
  test('returns query as string', () => {
    expect(resolveQuery({ query: 'test' })).toBe('test');
  });

  test('defaults to empty string when undefined', () => {
    expect(resolveQuery({})).toBe('');
  });

  test('defaults to empty string for null message', () => {
    expect(resolveQuery(null as any)).toBe('');
  });
});
