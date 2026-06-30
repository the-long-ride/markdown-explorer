import { describe, expect, test, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
});
