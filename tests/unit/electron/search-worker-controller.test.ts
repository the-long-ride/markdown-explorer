import { describe, expect, test, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'worker_threads';

import { createSearchWorkerController } from '../../../desktop/search-worker-controller.js';

function createFixture(prefix: string, fileCount: number, content: (index: number) => string) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return Array.from({ length: fileCount }, (_, index) => {
    const fsPath = path.join(rootDir, `${index}.md`);
    fs.writeFileSync(fsPath, content(index), 'utf8');
    return {
      tabId: 'tab-1',
      tabLabel: 'Docs',
      fsPath,
      fileName: `${index}.md`,
      relativePath: `${index}.md`,
      title: `File ${index}`,
    };
  });
}

describe('createSearchWorkerController', () => {
  let controller: ReturnType<typeof createSearchWorkerController>;

  afterEach(() => {
    controller?.dispose();
  });

  test('search worker streams bounded result batches', async () => {
    const items = createFixture(
      'search-worker-batches-',
      3,
      () => Array.from({ length: 80 }, (_, index) => `needle ${index}`).join('\n'),
    );
    const messages: any[] = [];
    let resolveDone: (value: any) => void;
    const done = new Promise((resolve) => { resolveDone = resolve; });
    controller = createSearchWorkerController({
      onMessage(message: any) {
        messages.push(message);
        if (message.type === 'done' && message.requestId === 'request-1') resolveDone(message);
      },
    });

    controller.setItems(items);
    controller.search({ requestId: 'request-1', query: 'needle', batchSize: 50 });
    const completion = await done;

    const batches = messages.filter((message: any) => message.type === 'batch');
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((message: any) => message.results.length <= 50)).toBe(true);
    expect(completion.cancelled).toBe(false);
    expect(completion.total).toBe(240);
  });

  test('search worker cancels stale search when a newer query starts', async () => {
    const items = createFixture(
      'search-worker-cancel-',
      80,
      (index) => `common term ${index}\n${index === 79 ? 'latest-only' : 'other'}`,
    );
    const messages: any[] = [];
    let resolveLatest: (value: any) => void;
    const latestDone = new Promise((resolve) => { resolveLatest = resolve; });
    controller = createSearchWorkerController({
      onMessage(message: any) {
        messages.push(message);
        if (message.type === 'done' && message.requestId === 'latest') resolveLatest(message);
      },
    });

    controller.setItems(items);
    controller.search({ requestId: 'stale', query: 'common', yieldEvery: 1 });
    controller.search({ requestId: 'latest', query: 'latest-only', yieldEvery: 1 });
    const completion = await latestDone;

    expect(completion.cancelled).toBe(false);
    expect(completion.total).toBe(1);
    expect(messages.some(
      (message: any) => message.type === 'done' && message.requestId === 'stale' && message.cancelled,
    )).toBe(true);
  });

  test('onError callback is invoked when worker emits an error', async () => {
    const errors: any[] = [];
    controller = createSearchWorkerController({
      onMessage() {},
      onError(error) { errors.push(error); },
      workerPath: path.join(os.tmpdir(), 'nonexistent-worker-' + Date.now() + '.js'),
    });
    const error = await new Promise<any>((resolve) => {
      const check = setInterval(() => {
        if (errors.length > 0) { clearInterval(check); resolve(errors[0]); }
      }, 50);
      setTimeout(() => { clearInterval(check); resolve(null); }, 5000);
    });
    expect(error).toBeDefined();
    controller.dispose();
    await new Promise((r) => setTimeout(r, 500));
  });

  test('setItems with non-array items falls back to empty array', async () => {
    const items = createFixture(
      'search-worker-nonarray-',
      1,
      () => 'findme content',
    );
    const messages: any[] = [];
    let resolveDone: (value: any) => void;
    const done = new Promise((resolve) => { resolveDone = resolve; });
    controller = createSearchWorkerController({
      onMessage(message: any) {
        messages.push(message);
        if (message.type === 'done' && message.requestId === 'r1') resolveDone(message);
      },
    });

    (controller as any).setItems('not-an-array');

    controller.setItems(items);
    controller.search({ requestId: 'r1', query: 'findme' });
    const completion = await done;
    expect(completion.total).toBe(1);
  });

  test('search after dispose returns early without posting', async () => {
    const items = createFixture(
      'search-worker-disposed-search-',
      1,
      () => 'findme',
    );
    const messages: any[] = [];
    controller = createSearchWorkerController({
      onMessage(message: any) { messages.push(message); },
    });

    controller.setItems(items);
    controller.dispose();
    controller.search({ requestId: 'after-dispose', query: 'findme' });

    await new Promise((r) => setTimeout(r, 200));
    expect(messages.every((m: any) => m.requestId !== 'after-dispose')).toBe(true);
  });

  test('setItems after dispose returns early', async () => {
    const items = createFixture(
      'search-worker-disposed-set-',
      2,
      () => 'findme',
    );
    const messages: any[] = [];
    let resolveDone: (value: any) => void;
    const done = new Promise((resolve) => { resolveDone = resolve; });
    controller = createSearchWorkerController({
      onMessage(message: any) {
        messages.push(message);
        if (message.type === 'done' && message.requestId === 'r1') resolveDone(message);
      },
    });

    controller.setItems(items);
    controller.search({ requestId: 'r1', query: 'findme' });
    await done;

    controller.dispose();
    const newItems = createFixture(
      'search-worker-disposed-set2-',
      5,
      () => 'new content',
    );
    controller.setItems(newItems);

    const searchMessages: any[] = [];
    let resolveSearch: (value: any) => void;
    const searchDone = new Promise((resolve) => { resolveSearch = resolve; });
    const ctrl2 = createSearchWorkerController({
      onMessage(message: any) {
        searchMessages.push(message);
        if (message.type === 'done' && message.requestId === 'r2') resolveSearch(message);
      },
    });
    ctrl2.setItems(newItems);
    ctrl2.search({ requestId: 'r2', query: 'new' });
    const result = await searchDone;
    expect(result.total).toBe(5);
    expect(result.cancelled).toBe(false);
    ctrl2.dispose();
  });

  test('dispose called twice is a no-op', async () => {
    const items = createFixture(
      'search-worker-double-dispose-',
      1,
      () => 'findme',
    );
    let resolveDone: (value: any) => void;
    const done = new Promise((resolve) => { resolveDone = resolve; });
    controller = createSearchWorkerController({
      onMessage(message: any) {
        if (message.type === 'done') resolveDone(message);
      },
    });

    controller.setItems(items);
    controller.search({ requestId: 'r1', query: 'findme' });
    await done;

    controller.dispose();
    expect(() => controller.dispose()).not.toThrow();
  });

  test('onMessage filtered when disposed is true (delayed terminate)', async () => {
    const origTerminate = Worker.prototype.terminate;
    Worker.prototype.terminate = function (this: any) {
      return new Promise<number>((resolve) => {
        setTimeout(() => { origTerminate.call(this).then(resolve); }, 100);
      });
    };

    const items = createFixture(
      'search-worker-delayed-term-',
      200,
      () => Array.from({ length: 200 }, (_, i) => `needle ${i}`).join('\n'),
    );
    const messages: any[] = [];
    controller = createSearchWorkerController({
      onMessage(message: any) { messages.push(message); },
    });

    controller.setItems(items);
    controller.search({ requestId: 'r-delay', query: 'needle', batchSize: 1, yieldEvery: 1 });

    for (let attempt = 0; attempt < 80; attempt++) {
      if (messages.some((m: any) => m.type === 'done')) break;
      if (messages.length > 3) { controller.dispose(); break; }
      await new Promise((r) => setTimeout(r, 2));
    }
    controller.dispose();

    const countBefore = messages.length;
    await new Promise((r) => setTimeout(r, 500));
    expect(messages.length).toBe(countBefore);

    Worker.prototype.terminate = origTerminate;
  });

  test('onError filtered when disposed is true (delayed terminate)', async () => {
    const origTerminate = Worker.prototype.terminate;
    Worker.prototype.terminate = function (this: any) {
      return new Promise<number>((resolve) => {
        setTimeout(() => { origTerminate.call(this).then(resolve); }, 100);
      });
    };

    const errors: any[] = [];
    controller = createSearchWorkerController({
      onError(error) { errors.push(error); },
      workerPath: path.join(os.tmpdir(), `nonexistent-delayed-term-${Date.now()}.js`),
    });

    controller.dispose();

    await new Promise((r) => setTimeout(r, 500));
    expect(errors.length).toBe(0);

    Worker.prototype.terminate = origTerminate;
  });

  test('default onError logs to console when worker errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    controller = createSearchWorkerController({
      workerPath: path.join(os.tmpdir(), 'nonexistent-default-err-' + Date.now() + '.js'),
    });
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (consoleSpy.mock.calls.length > 0) { clearInterval(check); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
    });
    expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);
    expect(consoleSpy.mock.calls[0][0]).toContain('Cross-tab search worker failed');
    consoleSpy.mockRestore();
  });

  test('creates controller without onMessage (optional chaining path)', async () => {
    const items = createFixture(
      'search-worker-no-onmsg-',
      1,
      () => 'findme',
    );
    controller = createSearchWorkerController();

    controller.setItems(items);
    controller.search({ requestId: 'r-no-cb', query: 'findme' });
    await new Promise((r) => setTimeout(r, 300));
  });
});
