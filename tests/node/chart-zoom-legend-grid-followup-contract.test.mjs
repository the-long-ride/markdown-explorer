import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('chart view zoom allows 50 through 1000 percent without changing the step', async () => {
  const viewer = await read('ui/src/dom/tableChartViewer.ts');

  assert.match(viewer, /MIN_CHART_SCALE\s*=\s*50/);
  assert.match(viewer, /MAX_CHART_SCALE\s*=\s*1000/);
  assert.match(viewer, /CHART_SCALE_STEP\s*=\s*10/);
  assert.match(viewer, /Math\.min\(MAX_CHART_SCALE,\s*Math\.max\(MIN_CHART_SCALE,\s*value\)\)/);
});

test('modal legend flows through straight responsive grid columns', async () => {
  const css = await read('ui/src/styles/global/global-table-chart-viewer.css');
  const match = css.match(/\.mdn-chart-viewer__legend-items\s*\{([\s\S]*?)\}/);

  assert.ok(match, 'legend-items rule must exist');
  const rule = match[1];
  assert.match(rule, /display:\s*grid/);
  assert.match(rule, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(150px,\s*1fr\)\)/);
  assert.match(rule, /gap:/);
  assert.doesNotMatch(rule, /display:\s*flex/);
  assert.doesNotMatch(rule, /flex-wrap:/);
});
