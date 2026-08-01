import assert from 'node:assert/strict';
import test from 'node:test';

import { createContentEnhancementScheduler } from '../../ui/src/components/Content/contentEnhancementScheduler.ts';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function makeHarness() {
  const frames = new Map();
  let nextFrame = 1;
  let observerCallback = null;
  let pending = true;
  const body = {
    isConnected: true,
    querySelector: () => pending ? {} : null,
  };
  const observer = {
    observe() {},
    disconnect() {},
  };

  return {
    body,
    setPending(value) { pending = value; },
    triggerMutation() { observerCallback?.([]); },
    requestFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelFrame(id) { frames.delete(id); },
    flushFrame() {
      const entry = frames.entries().next().value;
      if (!entry) return false;
      const [id, callback] = entry;
      frames.delete(id);
      callback();
      return true;
    },
    createObserver(callback) {
      observerCallback = callback;
      return observer;
    },
  };
}

test('scheduler reruns enhancements when raw render targets reappear', async () => {
  const harness = makeHarness();
  let runs = 0;
  const scheduler = createContentEnhancementScheduler({
    body: harness.body,
    hasPending: () => harness.body.querySelector() !== null,
    run: async () => {
      runs += 1;
      harness.setPending(false);
    },
    onSettled: () => {},
    requestFrame: harness.requestFrame,
    cancelFrame: harness.cancelFrame,
    createObserver: harness.createObserver,
    setDelay: () => 0,
    clearDelay: () => {},
  });

  assert.equal(harness.flushFrame(), true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(runs, 1);

  harness.setPending(true);
  harness.triggerMutation();
  assert.equal(harness.flushFrame(), true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(runs, 2);

  scheduler.dispose();
});

test('scheduler coalesces mutations while an enhancement pass is running', async () => {
  const harness = makeHarness();
  const firstRun = deferred();
  let runs = 0;
  const scheduler = createContentEnhancementScheduler({
    body: harness.body,
    hasPending: () => harness.body.querySelector() !== null,
    run: async () => {
      runs += 1;
      if (runs === 1) await firstRun.promise;
      harness.setPending(false);
    },
    onSettled: () => {},
    requestFrame: harness.requestFrame,
    cancelFrame: harness.cancelFrame,
    createObserver: harness.createObserver,
    setDelay: () => 0,
    clearDelay: () => {},
  });

  harness.flushFrame();
  await Promise.resolve();
  assert.equal(runs, 1);

  harness.triggerMutation();
  harness.triggerMutation();
  assert.equal(harness.flushFrame(), false);

  harness.setPending(true);
  firstRun.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(harness.flushFrame(), true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(runs, 2);

  scheduler.dispose();
});


test('scheduler keeps retrying with bounded backoff for slow render dependencies', async () => {
  const harness = makeHarness();
  const delayed = [];
  const delays = [];
  let runs = 0;
  const scheduler = createContentEnhancementScheduler({
    body: harness.body,
    hasPending: () => harness.body.querySelector() !== null,
    run: async () => {
      runs += 1;
      if (runs === 6) harness.setPending(false);
    },
    onSettled: () => {},
    requestFrame: harness.requestFrame,
    cancelFrame: harness.cancelFrame,
    createObserver: harness.createObserver,
    setDelay(callback, delayMs) {
      delays.push(delayMs);
      delayed.push(callback);
      return delayed.length;
    },
    clearDelay: () => {},
  });

  for (let expectedRun = 1; expectedRun <= 6; expectedRun += 1) {
    assert.equal(harness.flushFrame(), true);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(runs, expectedRun);
    if (expectedRun < 6) {
      const retry = delayed.shift();
      assert.equal(typeof retry, 'function');
      retry();
    }
  }

  assert.deepEqual(delays, [60, 180, 500, 1000, 2000]);
  scheduler.dispose();
});
