import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runEnhancementTasks } from '../../ui/src/components/Content/enhancementTasks.ts';
import { enhanceTables } from '../../ui/src/components/Content/enhancements/tableEnhancement.ts';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('independent content enhancements start concurrently and isolate failures', async () => {
  const slow = deferred();
  const started = [];
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  try {
    const pending = runEnhancementTasks([
      { label: 'slow', run: async () => { started.push('slow'); await slow.promise; } },
      { label: 'math', run: async () => { started.push('math'); } },
      { label: 'broken', run: async () => { started.push('broken'); throw new Error('failed'); } },
      { label: 'mermaid', run: async () => { started.push('mermaid'); } },
    ], () => false);

    await Promise.resolve();
    assert.deepEqual(started, ['slow', 'math', 'broken', 'mermaid']);
    slow.resolve();
    await pending;
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], 'broken error:');
  } finally {
    console.error = originalError;
  }
});

test('table enhancement does not wait for or start Chart.js', async () => {
  const table = {
    id: 'table-1',
    dataset: {},
    querySelectorAll(selector) {
      if (selector === 'tbody tr') return [];
      return [];
    },
  };
  const root = {
    querySelectorAll(selector) {
      return selector === '.mdn-table:not([data-mdn-enhanced]):not([data-mdn-render-error])' ? [table] : [];
    },
  };
  const documentRoot = { getElementById() { return null; } };
  let chartLoads = 0;
  let detected = 0;
  const tableGlobals = {
    states: {},
    detectChartable(id) { if (id === 'table-1') detected += 1; },
  };
  const getChart = async () => { chartLoads += 1; };

  await enhanceTables(root, { getChart, tableGlobals, documentRoot });

  assert.equal(chartLoads, 0);
  assert.equal(detected, 1);
  assert.equal(table.dataset.mdnEnhanced, 'true');
  assert.equal(tableGlobals.ensureChartLibrary, getChart);
});
