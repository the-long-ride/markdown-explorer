import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('chart viewport and legend keep scrolling active while hiding scrollbar chrome', async () => {
  const css = await read('ui/src/styles/global/global-table-chart-viewer.css');

  assert.match(css, /\.mdn-chart-viewer__viewport\s*\{[\s\S]*?overflow:\s*auto[\s\S]*?scrollbar-width:\s*none[\s\S]*?-ms-overflow-style:\s*none/);
  assert.match(css, /\.mdn-chart-viewer__legend\s*\{[\s\S]*?overflow-y:\s*auto[\s\S]*?scrollbar-width:\s*none[\s\S]*?-ms-overflow-style:\s*none/);
  assert.match(css, /\.mdn-chart-viewer__viewport::-webkit-scrollbar\s*,\s*\.mdn-chart-viewer__legend::-webkit-scrollbar\s*\{[\s\S]*?width:\s*0[\s\S]*?height:\s*0[\s\S]*?display:\s*none/);
});

test('modal legend uses real wrapping HTML items instead of a clipped visible canvas', async () => {
  const [viewer, legend, css] = await Promise.all([
    read('ui/src/dom/tableChartViewer.ts'),
    read('ui/src/dom/tableChartViewerLegend.ts'),
    read('ui/src/styles/global/global-table-chart-viewer.css'),
  ]);

  assert.match(viewer, /mdn-chart-viewer__legend-items/);
  assert.match(legend, /data-chart-legend-index=/);
  assert.match(viewer, /renderLegendItems/);
  assert.match(viewer, /target\.closest<HTMLElement>\(['"]\[data-chart-legend-index\]['"]\)/);
  assert.match(viewer, /mdn-chart-viewer__legend-export/);
  assert.match(css, /\.mdn-chart-viewer__legend-items\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(150px,\s*1fr\)\)[\s\S]*?gap:/);
  assert.match(css, /\.mdn-chart-viewer__legend-item\s*\{[\s\S]*?display:\s*inline-flex[\s\S]*?max-width:\s*100%/);
  assert.match(css, /\.mdn-chart-viewer__legend\s*\{[\s\S]*?max-height:\s*min\(180px,\s*26vh\)/);
  assert.match(css, /\.mdn-chart-viewer__legend-export\s*\{[\s\S]*?position:\s*fixed[\s\S]*?pointer-events:\s*none/);
});
