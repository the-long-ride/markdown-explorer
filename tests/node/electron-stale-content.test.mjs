import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { registerRuntimeWorkspaceHandlers } = require('../../electron/core/runtime-workspace-handlers.js');

function createDeferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

test('Electron discards document content that finishes after its workspace operation is cancelled', async () => {
  const deferred = createDeferred();
  const messages = [];
  const state = {
    workspacePath: '/workspace-a',
    currentFile: '/workspace-a/a.md',
    flatList: [{ fsPath: '/workspace-a/a.md', relativePath: 'a.md', title: 'A' }],
    workspaceOperationId: 'operation-a',
    workspaceTabId: 'tab-a',
    documentConversionEnabled: false,
    workspaceWatch: null,
    searchIndex: null,
    crossTabSearchWorker: null,
  };
  const handlers = registerRuntimeWorkspaceHandlers({
    state,
    deps: {
      documentConverter: {
        readMarkdown: () => deferred.promise,
        createFailureMarkdown: () => '# failed',
      },
    },
    pathApi: require('node:path'),
    fs: {
      constants: { R_OK: 4 },
      accessSync() {},
      statSync() { return { isFile: () => false }; },
    },
    getMainWindow: () => null,
    sendHostMessage: (message) => messages.push(message),
    getHostInfo: () => ({}),
    sendLoading() {},
    sendRecentWorkspacesChanged() {},
    recentWorkspacesStore: { load: () => [] },
    scanWorkspaceData: async () => ({ tree: null, flat: [] }),
    createSearchIndex: () => ({ prime() {} }),
    createSearchWorkerController: () => ({}),
    isSupportedFilePathLite: () => true,
    isExtraDocumentFilePathLite: () => false,
    getFileTypeLabelLite: () => 'Markdown',
    stripKnownExtensionLite: (name) => name.replace(/\.md$/, ''),
    isAccessDeniedError: () => false,
    stripNavigationFragment: (value) => value,
    decodeNavigationPath: (value) => value,
    isRootRelativeWorkspaceHref: () => false,
    isSameOrInsidePath: () => true,
  });

  const pending = handlers.sendContent();
  handlers.cancelWorkspaceScan('operation-a');
  state.workspacePath = '/workspace-b';
  state.currentFile = '/workspace-b/b.md';
  state.workspaceOperationId = 'operation-b';
  state.workspaceTabId = 'tab-b';
  deferred.resolve({ markdown: '# A', previewInfo: null });
  await pending;

  assert.deepEqual(messages.filter((message) => message.command === 'renderContent'), []);
});

test('Electron discards a workspace watcher refresh that finishes after another workspace becomes active', async () => {
  const deferred = createDeferred();
  const messages = [];
  const state = {
    workspacePath: '/workspace-a',
    currentFile: '/workspace-a/a.md',
    flatList: [{ fsPath: '/workspace-a/a.md', relativePath: 'a.md', title: 'A' }],
    workspaceOperationId: 'operation-a',
    workspaceTabId: 'tab-a',
    documentConversionEnabled: false,
    workspaceWatch: null,
    searchIndex: null,
    crossTabSearchWorker: null,
  };
  const handlers = registerRuntimeWorkspaceHandlers({
    state,
    deps: { documentConverter: {} },
    pathApi: require('node:path'),
    fs: {
      constants: { R_OK: 4 },
      accessSync() {},
      statSync() { return { isFile: () => false }; },
    },
    getMainWindow: () => null,
    sendHostMessage: (message) => messages.push(message),
    getHostInfo: () => ({}),
    sendLoading() {},
    sendRecentWorkspacesChanged() {},
    recentWorkspacesStore: { load: () => [] },
    scanWorkspaceData: () => deferred.promise,
    createSearchIndex: () => ({ prime() {} }),
    createSearchWorkerController: () => ({}),
    isSupportedFilePathLite: () => true,
    isExtraDocumentFilePathLite: () => false,
    getFileTypeLabelLite: () => 'Markdown',
    stripKnownExtensionLite: (name) => name.replace(/\.md$/, ''),
    isAccessDeniedError: () => false,
    stripNavigationFragment: (value) => value,
    decodeNavigationPath: (value) => value,
    isRootRelativeWorkspaceHref: () => false,
    isSameOrInsidePath: () => true,
  });

  const pending = handlers.sendWorkspaceFilesChanged();
  handlers.cancelWorkspaceScan('operation-a');
  state.workspacePath = '/workspace-b';
  state.currentFile = '/workspace-b/b.md';
  state.flatList = [{ fsPath: '/workspace-b/b.md', relativePath: 'b.md', title: 'B' }];
  state.workspaceOperationId = 'operation-b';
  state.workspaceTabId = 'tab-b';
  deferred.resolve({
    tree: null,
    flat: [{ fsPath: '/workspace-a/late.md', relativePath: 'late.md', title: 'Late A' }],
  });

  const completed = await pending;
  assert.equal(completed, false);
  assert.equal(state.flatList[0].title, 'B');
  assert.deepEqual(messages.filter((message) => message.command === 'workspaceFilesChanged'), []);
});
