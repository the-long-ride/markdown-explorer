import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Mermaid appearance scheduler defers, coalesces, and cancels rerenders', async () => {
  const schedulerModule = await import('../../ui/src/components/Content/enhancements/deferredMermaidRerender.ts');
  assert.equal(typeof schedulerModule.createDeferredMermaidRerender, 'function');
  let nextId = 1;
  const delays = new Map();
  const idles = new Map();
  const scheduler = {
    setDelay(callback, _delayMs) {
      const id = nextId++;
      delays.set(id, callback);
      return id;
    },
    clearDelay(id) { delays.delete(id); },
    requestIdle(callback, _options) {
      const id = nextId++;
      idles.set(id, callback);
      return id;
    },
    cancelIdle(id) { idles.delete(id); },
  };
  let rerenders = 0;
  const deferred = schedulerModule.createDeferredMermaidRerender(() => { rerenders += 1; }, scheduler);

  deferred.schedule();
  deferred.schedule();
  assert.equal(rerenders, 0, 'appearance switching must not rerender Mermaid synchronously');
  assert.equal(delays.size, 1, 'rapid switches coalesce into one debounce');

  const delayCallback = [...delays.values()][0];
  delays.clear();
  delayCallback();
  assert.equal(rerenders, 0, 'rerender waits for browser idle time after the debounce');
  assert.equal(idles.size, 1);

  const idleCallback = [...idles.values()][0];
  idles.clear();
  idleCallback();
  assert.equal(rerenders, 1);

  deferred.schedule();
  assert.equal(delays.size, 1);
  deferred.cancel();
  assert.equal(delays.size, 0);
  assert.equal(idles.size, 0);
  assert.equal(rerenders, 1, 'cancel prevents a pending rerender');
});

test('content effects defer rendered Mermaid invalidation through the shared lifecycle', async () => {
  const effects = await read('ui/src/components/Content/useContentEffects.ts');
  const contentLifecycle = await read('ui/src/components/Content/mermaidContentLifecycle.ts');
  const appearance = await read('ui/src/components/Content/enhancements/mermaidAppearance.ts');
  const lifecycle = await read('ui/src/components/Content/enhancements/mermaidRerenderLifecycle.ts');
  const source = `${effects}\n${contentLifecycle}\n${appearance}\n${lifecycle}`;
  assert.match(source, /createDeferredMermaidRerender/);
  assert.match(effects, /installMermaidContentLifecycle/);
  assert.match(contentLifecycle, /createMermaidRerenderLifecycle/);
  assert.match(source, /lastMermaidAppearanceKeyRef/);
  assert.match(source, /state\.theme/);
  assert.match(source, /state\.themeStyle/);
  assert.match(source, /activeCustomThemeId/);
  assert.match(source, /customThemes/);
  assert.match(source, /fontBindings\?\.mermaid|fontBindings\.mermaid/);
  assert.match(contentLifecycle, /appearance\.changed[\s\S]*rerender\.schedule\(\)/);
  assert.match(source, /createMermaidRerenderQueue/);
  assert.match(source, /getMermaidRenderNodes\(root\)/);
  assert.match(source, /invalidateMermaidRendering\(node\)/);
  assert.doesNotMatch(source, /invalidateMermaidRenderings\(root\)/);
  assert.doesNotMatch(appearance, /syncMermaidAppearance[\s\S]*invalidateMermaidRenderings\(root\)/);
});

test('auto theme media changes use the same shared deferred Mermaid rerender scheduler', async () => {
  const effects = await read('ui/src/components/Content/useContentEffects.ts');
  const contentLifecycle = await read('ui/src/components/Content/mermaidContentLifecycle.ts');
  const appearance = await read('ui/src/components/Content/enhancements/mermaidAppearance.ts');
  const lifecycle = await read('ui/src/components/Content/enhancements/mermaidRerenderLifecycle.ts');
  const source = `${effects}\n${contentLifecycle}\n${appearance}\n${lifecycle}`;
  assert.match(source, /theme\s*!==\s*["']auto["']/);
  assert.match(source, /matchMedia\(["']\(prefers-color-scheme: dark\)["']\)/);
  assert.match(source, /addEventListener\(["']change["']/);
  assert.match(contentLifecycle, /subscribeToAutoMermaidTheme[\s\S]*rerender\.schedule/);
  assert.match(source, /removeEventListener\(["']change["']/);
  assert.match(source, /\.cancel\(\)/);
  assert.match(contentLifecycle, /rerender\.dispose\(\)/);
});

test('Mermaid rerender queue orders visible, near-viewport, then off-screen diagrams', async () => {
  const queueModule = await import('../../ui/src/components/Content/enhancements/mermaidRerenderQueue.ts').catch(() => ({}));
  assert.equal(typeof queueModule.orderMermaidNodesForRerender, 'function');
  const node = (id, top, bottom) => ({ id, getBoundingClientRect: () => ({ top, bottom }) });
  const nodes = [
    node('far-above', -2200, -2100),
    node('near-below', 900, 980),
    node('visible-2', 300, 450),
    node('far-below', 3000, 3100),
    node('visible-1', -20, 120),
    node('near-above', -500, -420),
  ];

  const ordered = queueModule.orderMermaidNodesForRerender(nodes, { top: 0, bottom: 800, nearDistance: 800 });
  assert.deepEqual(ordered.map((item) => item.id), [
    'visible-2', 'visible-1', 'near-below', 'near-above', 'far-above', 'far-below',
  ]);
});

test('Mermaid rerender queue runs strictly one diagram at a time and yields between diagrams', async () => {
  const queueModule = await import('../../ui/src/components/Content/enhancements/mermaidRerenderQueue.ts').catch(() => ({}));
  assert.equal(typeof queueModule.createMermaidRerenderQueue, 'function');
  let nextHandle = 1;
  const idles = new Map();
  const frames = new Map();
  const scheduler = {
    requestIdle(callback) { const id = nextHandle++; idles.set(id, callback); return id; },
    cancelIdle(id) { idles.delete(id); },
    requestFrame(callback) { const id = nextHandle++; frames.set(id, callback); return id; },
    cancelFrame(id) { frames.delete(id); },
  };
  const nodes = [1, 2, 3].map((id) => ({ id, getBoundingClientRect: () => ({ top: 10, bottom: 20 }) }));
  const starts = [];
  let active = 0;
  let peakActive = 0;
  const resolvers = [];
  const queue = queueModule.createMermaidRerenderQueue(async (node) => {
    starts.push(node.id);
    active += 1;
    peakActive = Math.max(peakActive, active);
    await new Promise((resolve) => resolvers.push(resolve));
    active -= 1;
  }, scheduler, { viewport: () => ({ top: 0, bottom: 800, nearDistance: 800 }) });

  queue.start(nodes);
  assert.equal(idles.size, 1);
  [...idles.values()][0](); idles.clear();
  assert.equal(frames.size, 1);
  [...frames.values()][0](); frames.clear();
  await Promise.resolve();
  assert.deepEqual(starts, [1]);
  assert.equal(idles.size, 0, 'next item is not scheduled before current render resolves');

  resolvers.shift()();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(idles.size, 1, 'queue yields to idle time between diagrams');
  [...idles.values()][0](); idles.clear();
  [...frames.values()][0](); frames.clear();
  await Promise.resolve();
  assert.deepEqual(starts, [1, 2]);
  assert.equal(peakActive, 1);
});

test('Mermaid rerender queue cancels stale generations after current item', async () => {
  const queueModule = await import('../../ui/src/components/Content/enhancements/mermaidRerenderQueue.ts').catch(() => ({}));
  assert.equal(typeof queueModule.createMermaidRerenderQueue, 'function');
  let nextHandle = 1;
  const idles = new Map();
  const frames = new Map();
  const scheduler = {
    requestIdle(callback) { const id = nextHandle++; idles.set(id, callback); return id; },
    cancelIdle(id) { idles.delete(id); },
    requestFrame(callback) { const id = nextHandle++; frames.set(id, callback); return id; },
    cancelFrame(id) { frames.delete(id); },
  };
  const nodes = [1, 2].map((id) => ({ id, getBoundingClientRect: () => ({ top: 10, bottom: 20 }) }));
  const starts = [];
  let release;
  const queue = queueModule.createMermaidRerenderQueue(async (node, isCancelled) => {
    starts.push(node.id);
    await new Promise((resolve) => { release = resolve; });
    assert.equal(isCancelled(), true, 'active render can observe stale generation');
  }, scheduler, { viewport: () => ({ top: 0, bottom: 800, nearDistance: 800 }) });

  queue.start(nodes);
  [...idles.values()][0](); idles.clear();
  [...frames.values()][0](); frames.clear();
  await Promise.resolve();
  assert.deepEqual(starts, [1]);
  queue.cancel();
  release();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(idles.size, 0);
  assert.equal(frames.size, 0);
  assert.deepEqual(starts, [1]);
});
