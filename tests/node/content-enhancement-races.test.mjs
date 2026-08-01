import assert from 'node:assert/strict';
import { test } from 'node:test';

import { enhanceMath } from '../../ui/src/components/Content/enhancements/mathRendering.ts';
import { enhanceMermaid } from '../../ui/src/components/Content/enhancements/mermaidRendering.ts';
import { enhanceSyntax } from '../../ui/src/components/Content/enhancements/syntaxHighlighting.ts';
import { enhanceTables } from '../../ui/src/components/Content/enhancements/tableEnhancement.ts';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

class ClassList {
  constructor(values = []) { this.values = new Set(values); }
  add(value) { this.values.add(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    if (force) this.values.add(value);
    else this.values.delete(value);
  }
}

function makeElement({ classes = [], dataset = {}, textContent = '' } = {}) {
  return {
    className: classes.join(' '),
    classList: new ClassList(classes),
    dataset: { ...dataset },
    textContent,
    attributes: new Map(),
    querySelector(selector) {
      if (selector === 'svg') return this.svg ?? null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'svg') return this.svg ? [this.svg] : [];
      if (selector === 'tbody tr') return this.rows ?? [];
      return [];
    },
    removeAttribute(name) { this.attributes.delete(name); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
  };
}

test('lazy syntax enhancement re-queries the live DOM after the library resolves', async () => {
  const oldBlock = makeElement({ classes: ['language-js'] });
  const liveBlock = makeElement({ classes: ['language-js'] });
  let current = oldBlock;
  const root = {
    querySelectorAll() { return [current]; },
  };
  const library = deferred();
  const calls = [];
  const pending = enhanceSyntax(root, () => library.promise);

  current = liveBlock;
  library.resolve({ highlightElement(element) { calls.push(element); } });
  await pending;

  assert.deepEqual(calls, [liveBlock]);
  assert.equal(liveBlock.dataset.mdnHighlighted, 'true');
  assert.equal(oldBlock.dataset.mdnHighlighted, undefined);
});

test('lazy math enhancement re-queries the live DOM after KaTeX resolves', async () => {
  const oldMath = makeElement({ classes: ['mdn-math'], dataset: { math: encodeURIComponent('old') } });
  const liveMath = makeElement({ classes: ['mdn-math', 'mdn-math-block'], dataset: { math: encodeURIComponent('x^2') } });
  let current = oldMath;
  const root = {
    querySelectorAll() { return [current]; },
  };
  const library = deferred();
  const calls = [];
  const pending = enhanceMath(root, () => library.promise);

  current = liveMath;
  library.resolve({ render(tex, element) { calls.push([tex, element]); } });
  await pending;

  assert.deepEqual(calls, [['x^2', liveMath]]);
  assert.equal(liveMath.classList.contains('is-rendered'), true);
  assert.equal(oldMath.classList.contains('is-rendered'), false);
});

test('Mermaid renders diagrams one-by-one so one invalid variant cannot block the rest', async () => {
  const bad = makeElement({ classes: ['mermaid'], textContent: 'badDiagram' });
  const good = makeElement({ classes: ['mermaid'], textContent: 'graph TD\nA-->B' });
  const root = { querySelectorAll() { return [bad, good]; } };
  const calls = [];
  const mermaid = {
    initialize() {},
    async run({ nodes }) {
      calls.push(nodes.slice());
      const node = nodes[0];
      if (node === bad) throw new Error('bad diagram');
      node.svg = { setAttribute() {} };
    },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await enhanceMermaid(root, {
      getLibrary: async () => mermaid,
      isDark: false,
      isCancelled: () => false,
      runIdRef: { current: 0 },
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], [bad]);
  assert.deepEqual(calls[1], [good]);
  assert.equal(good.dataset.mdnRendered, 'true');
  assert.equal(bad.dataset.mdnRendered, undefined);
  assert.equal(bad.dataset.mdnRenderAttempts, '1');
  assert.equal(bad.dataset.mdnRenderError, undefined);
});

test('one malformed table cannot prevent later tables from being enhanced', async () => {
  const bad = makeElement();
  bad.id = 'bad-table';
  bad.rows = [];
  const good = makeElement();
  good.id = 'good-table';
  good.rows = [];
  const root = { querySelectorAll() { return [bad, good]; } };
  const tableGlobals = {
    states: {},
    detectChartable(id) {
      if (id === 'bad-table') throw new Error('bad table');
    },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await enhanceTables(root, {
      getChart: async () => ({}),
      tableGlobals,
      documentRoot: { getElementById() { return null; } },
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(good.dataset.mdnEnhanced, 'true');
});


test('Mermaid retries one transient node failure before making the error permanent', async () => {
  const node = makeElement({ classes: ['mermaid'], textContent: 'graph TD\nA-->B' });
  const root = { querySelectorAll() { return [node]; } };
  let calls = 0;
  const mermaid = {
    initialize() {},
    async run() {
      calls += 1;
      if (calls === 1) throw new Error('temporary render race');
      node.svg = { setAttribute() {} };
    },
  };
  const options = {
    getLibrary: async () => mermaid,
    isDark: false,
    isCancelled: () => false,
    runIdRef: { current: 0 },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await enhanceMermaid(root, options);
    assert.equal(node.dataset.mdnRendered, undefined);
    assert.equal(node.dataset.mdnRenderAttempts, '1');
    assert.equal(node.dataset.mdnRenderError, undefined);

    await enhanceMermaid(root, options);
  } finally {
    console.error = originalError;
  }

  assert.equal(calls, 2);
  assert.equal(node.dataset.mdnRendered, 'true');
  assert.equal(node.dataset.mdnRenderAttempts, undefined);
  assert.equal(node.dataset.mdnRenderError, undefined);
});

test('table enhancement retries a transient initializer failure', async () => {
  const table = makeElement();
  table.id = 'retry-table';
  table.rows = [];
  const root = { querySelectorAll() { return [table]; } };
  let calls = 0;
  const tableGlobals = {
    states: {},
    detectChartable() {
      calls += 1;
      if (calls === 1) throw new Error('globals are not ready');
    },
  };
  const options = {
    getChart: async () => ({}),
    tableGlobals,
    documentRoot: { getElementById() { return null; } },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await enhanceTables(root, options);
    assert.equal(table.dataset.mdnEnhanced, undefined);
    assert.equal(table.dataset.mdnRenderAttempts, '1');
    assert.equal(table.dataset.mdnRenderError, undefined);

    await enhanceTables(root, options);
  } finally {
    console.error = originalError;
  }

  assert.equal(calls, 2);
  assert.equal(table.dataset.mdnEnhanced, 'true');
  assert.equal(table.dataset.mdnRenderAttempts, undefined);
  assert.equal(table.dataset.mdnRenderError, undefined);
});
