import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSearchIndex } = require('../../electron/search/search-index.js');
const { createRuntimeCommandSearchHandlers } = require('../../electron/core/runtime-command-search-handlers.js');

function makeMarkdownFile(content, name = 'CaseSample.md') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-explorer-case-'));
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, content, 'utf8');
  return {
    directory,
    item: {
      fsPath: filePath,
      fileName: name,
      relativePath: name,
      title: name.replace(/\.md$/i, ''),
    },
  };
}

test('electron search defaults to case-insensitive content matching', () => {
  const { directory, item } = makeMarkdownFile('Alpha alpha ALPHA');
  try {
    const results = createSearchIndex().search('alpha', [item]);
    assert.equal(results.length, 3);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('electron search matches exact content casing when matchCase is enabled', () => {
  const { directory, item } = makeMarkdownFile('Alpha alpha ALPHA');
  try {
    const results = createSearchIndex().search('Alpha', [item], 10000, { matchCase: true });
    assert.equal(results.length, 1);
    assert.equal(results[0].excerpt.includes('Alpha'), true);
    assert.equal(results[0].matchIndex, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('electron search respects exact casing in file metadata', () => {
  const { directory, item } = makeMarkdownFile('nothing here', 'ReleaseNotes.md');
  try {
    const index = createSearchIndex();
    assert.equal(index.search('Release', [item], 10000, { matchCase: true }).length, 1);
    assert.equal(index.search('release', [item], 10000, { matchCase: true }).length, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('workspace handler preserves query casing and forwards matchCase', () => {
  const calls = [];
  const sent = [];
  const handlers = createRuntimeCommandSearchHandlers({
    state: { flatList: [{ fsPath: '/workspace/Doc.md' }] },
    fs: { existsSync: () => false },
    ensureHeavyModules() {},
    ensureSearchIndex: () => ({
      search(...args) {
        calls.push(args);
        return [];
      },
    }),
    ensureCrossTabSearchWorker: () => ({ search() {}, setItems() {} }),
    scanWorkspaceData: async () => ({ tree: null, flat: [] }),
    sendHostMessage: (message) => sent.push(message),
  });

  handlers.handleSearchWorkspace({
    requestId: 'workspace-1',
    query: 'NeedleCase',
    matchCase: true,
    items: [{ fsPath: '/workspace/Doc.md' }],
  });

  assert.deepEqual(calls[0], [
    'NeedleCase',
    [{ fsPath: '/workspace/Doc.md' }],
    10000,
    { matchCase: true },
  ]);
  assert.equal(sent[0].command, 'workspaceSearchResults');
});

test('cross-tab handler preserves query casing and forwards matchCase', () => {
  const calls = [];
  const handlers = createRuntimeCommandSearchHandlers({
    state: { flatList: [] },
    fs: { existsSync: () => false },
    ensureHeavyModules() {},
    ensureSearchIndex: () => ({ search: () => [] }),
    ensureCrossTabSearchWorker: () => ({
      search(payload) {
        calls.push(payload);
      },
      setItems() {},
    }),
    scanWorkspaceData: async () => ({ tree: null, flat: [] }),
    sendHostMessage() {},
  });

  handlers.handleSearchAcrossWorkspaces({
    requestId: 'all-1',
    query: 'NeedleCase',
    matchCase: true,
  });

  assert.deepEqual(calls[0], {
    requestId: 'all-1',
    query: 'NeedleCase',
    matchCase: true,
  });
});
