import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { runDeferredLoad } = require('../../electron/core/startup-workspace.js');

test('deferred load does not publish initial content after a cancelled scan', async () => {
  let initialContentCalls = 0;
  await runDeferredLoad({
    ensureHeavyModules() {},
    bindWorkspaceWatch() {},
    sendLoading() {},
    async sendWorkspaceData() { return false; },
    async sendInitialContent() { initialContentCalls += 1; },
  });
  assert.equal(initialContentCalls, 0);
});

test('deferred load publishes initial content after a current scan completes', async () => {
  let initialContentCalls = 0;
  await runDeferredLoad({
    ensureHeavyModules() {},
    bindWorkspaceWatch() {},
    sendLoading() {},
    async sendWorkspaceData() { return true; },
    async sendInitialContent(openFirstFile) {
      initialContentCalls += openFirstFile ? 1 : 10;
    },
    openFirstFile: true,
  });
  assert.equal(initialContentCalls, 1);
});
