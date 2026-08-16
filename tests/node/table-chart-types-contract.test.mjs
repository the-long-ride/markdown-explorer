import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('table chart menu exposes the approved expanded chart set', async () => {
  const source = await read('ui/src/dom/tableChartViews.ts');
  for (const view of ['horizontalBar', 'area', 'scatter', 'radar', 'polarArea', 'doughnut']) {
    assert.match(source, new RegExp(`['"]${view}['"]`));
  }
  assert.match(source, /\{\s*id:\s*['\"]scatter['\"],\s*label:\s*['\"]scatterChart['\"],\s*minNumeric:\s*2\s*\}/);
  assert.match(source, /visibleNumericColumns\.length\s*>=\s*definition\.minNumeric/);
  assert.match(source, /hiddenColumnIdxs/);
});

test('non-scatter charts keep label-column semantics while scatter can use two numeric axes', async () => {
  const views = await read('ui/src/dom/tableChartViews.ts');
  const handlers = await read('ui/src/dom/tableChartHandlers.ts');
  assert.match(views, /function\s+visibleSeriesColIdxs\s*\(/);
  assert.match(handlers, /viewType\s*===\s*['"]scatter['"][\s\S]*visibleScatterColIdxs\(state\)/);
  assert.match(handlers, /visibleSeriesColIdxs\(state\)/);
});

test('Pie and Doughnut are distinct and Scatter builds x/y points', async () => {
  const source = await read('ui/src/dom/tableChartConfig.ts');
  assert.match(source, /viewType\s*===\s*['"]pie['"][\s\S]*['"]pie['"]/);
  assert.match(source, /viewType\s*===\s*['"]doughnut['"][\s\S]*['"]doughnut['"]/);
  assert.match(source, /x:\s*parseNumericCell/);
  assert.match(source, /y:\s*parseNumericCell/);
});

test('Chart.js loader registers controllers and scales for new chart types', async () => {
  const source = await read('ui/src/lib/renderLibs.ts');
  for (const token of ['PieController', 'PolarAreaController', 'RadarController', 'RadialLinearScale', 'ScatterController', 'Filler']) {
    assert.match(source, new RegExp(`mod\\.${token}`));
  }
});


test('chart detection preserves legacy series state while retaining all numeric columns for scatter', async () => {
  const source = await read('ui/src/dom/tableChartHandlers.ts');
  assert.match(source, /dataColIdxs\s*=\s*numericCols\.filter/);
  assert.match(source, /scatterColIdxs\s*=\s*numericCols/);
});


test('invalidated active charts switch back to Table before the switcher is rebuilt', async () => {
  const source = await read('ui/src/dom/tableChartHandlers.ts');
  const start = source.indexOf('win.Table.refreshChartAvailability');
  const end = source.indexOf('win.Table.switchView =', start);
  const refresh = source.slice(start, end);
  assert.ok(refresh.includes('!isViewEligible'));
  assert.ok(refresh.indexOf('!isViewEligible') < refresh.indexOf('renderViewSwitcher'));
  assert.match(refresh, /switchView\(tableId, ['"]table['"]\)/);
});
