import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createRuntimeCommandSearchHandlers } = require('../../electron/core/runtime-command-search-handlers.js');

function createHandlers({ state, sent }) {
  return createRuntimeCommandSearchHandlers({
    state,
    fs: require('node:fs'),
    ensureHeavyModules() {},
    ensureSearchIndex() {
      return {
        search: () => [],
        prime() {},
        read(filePath) { return require('node:fs').readFileSync(filePath, 'utf8'); },
      };
    },
    ensureCrossTabSearchWorker() { return { search() {}, setItems() {} }; },
    scanWorkspaceData: async () => ({ tree: null, flat: [] }),
    sendHostMessage(message) { sent.push(message); },
  });
}

test('electron search preview reads only indexed Markdown files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mdn-search-preview-'));
  try {
    const filePath = path.join(dir, 'Guide.md');
    await writeFile(filePath, '# Guide\n\nTarget text', 'utf8');
    const sent = [];
    const handlers = createHandlers({ state: { flatList: [] }, sent });
    handlers.handleIndexWorkspaceSearchItems({ items: [{ tabId: 'docs', fsPath: filePath }] });
    handlers.handleLoadSearchPreview({ requestId: 'preview-1', filePath, tabId: 'docs' });
    assert.deepEqual(sent.at(-1), {
      command: 'searchPreviewResult',
      requestId: 'preview-1',
      ok: true,
      filePath,
      markdownSource: '# Guide\n\nTarget text',
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('electron search preview rejects paths outside the indexed search set', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mdn-search-preview-'));
  try {
    const filePath = path.join(dir, 'Private.md');
    await writeFile(filePath, '# Private', 'utf8');
    const sent = [];
    const handlers = createHandlers({ state: { flatList: [] }, sent });
    handlers.handleLoadSearchPreview({ requestId: 'preview-2', filePath });
    assert.deepEqual(sent.at(-1), {
      command: 'searchPreviewResult',
      requestId: 'preview-2',
      ok: false,
      filePath,
      reason: 'outside-workspace',
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
