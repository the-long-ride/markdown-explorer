import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');
const readOptional = async (path) => {
  try { return await read(path); } catch { return ''; }
};

test('table toolbar Wrap, chart type and Columns controls use app tooltips', async () => {
  const [renderer, charts] = await Promise.all([
    read('ui/src/markdown/tableRenderer.ts'),
    read('ui/src/dom/tableChartHandlers.ts'),
  ]);
  assert.match(renderer, /mdn-table-wrap-toggle[^>]*tooltip-container|tooltip-container[^>]*mdn-table-wrap-toggle/);
  assert.match(renderer, /mdn-table-columns-toggle[^>]*tooltip-container|tooltip-container[^>]*mdn-table-columns-toggle/);
  assert.match(renderer, /tooltip-text[\s\S]*?wrapTableText/);
  assert.match(renderer, /tooltip-text[\s\S]*?labels\.columns/);
  assert.match(charts, /mdn-table-view-select[^>]*tooltip-container|tooltip-container[^>]*mdn-table-view-select/);
  assert.match(charts, /tooltip-text[\s\S]*?tableViewType/);
});

test('column visibility menu reuses the shared accessible switch instead of checkboxes', async () => {
  const [source, shared] = await Promise.all([
    read('ui/src/dom/tableColumnHandlers.ts'),
    read('ui/src/components/shared/SwitchButton.tsx'),
  ]);
  assert.match(source, /createSwitchButtonElement/);
  assert.match(source, /mdn-table-columns-menu__toggle/);
  assert.doesNotMatch(source, /type\s*=\s*['"]checkbox['"]/);
  assert.match(source, /visibleColumnCount[\s\S]*?<=\s*1/);
  assert.match(shared, /role=['"]switch['"]|role=\"switch\"/);
  assert.match(shared, /aria-checked/);
});

test('chart selector intrinsically sizes to its widest localized option', async () => {
  const [source, css] = await Promise.all([
    read('ui/src/dom/tableChartHandlers.ts'),
    read('ui/src/styles/global/global-table-view-controls.css'),
  ]);
  assert.match(source, /mdn-table-view-sizer/);
  assert.match(css, /mdn-table-view-dropdown\s*\{[\s\S]*?display:\s*inline-grid/);
  assert.match(css, /mdn-table-view-sizer[\s\S]*?visibility:\s*hidden/);
  assert.match(css, /mdn-table-view-select\s*\{[\s\S]*?width:\s*100%/);
  assert.doesNotMatch(css, /\.mdn-table-view-menu\s*\{[\s\S]*?width:\s*115px/);
});

test('shared chart config and viewer support real 50-1000 percent scaling and full-canvas PNG actions', async () => {
  const [handlers, config, viewer, imageActions, copyImage, translations, globalCss] = await Promise.all([
    read('ui/src/dom/tableChartHandlers.ts'),
    readOptional('ui/src/dom/tableChartConfig.ts'),
    readOptional('ui/src/dom/tableChartViewer.ts').then(async (viewer) => viewer + '\n' + await readOptional('ui/src/dom/tableChartViewerChart.ts')),
    readOptional('ui/src/dom/tableChartImageActions.ts'),
    read('ui/src/dom/copyImage.ts'),
    read('ui/src/contexts/auditedUiTranslationTypes.ts'),
    read('ui/src/styles/global.css'),
  ]);
  assert.match(config, /export function buildTableChartConfig/);
  assert.match(handlers, /buildTableChartConfig/);
  assert.match(handlers, /registerTableChartViewer/);
  assert.match(viewer, /MIN_CHART_SCALE\s*=\s*50/);
  assert.match(viewer, /MAX_CHART_SCALE\s*=\s*1000/);
  assert.match(viewer, /CHART_SCALE_STEP\s*=\s*10/);
  assert.match(viewer, /data-chart-action="fit"/);
  assert.match(viewer, /data-chart-action="100"/);
  assert.match(viewer, /data-chart-action="zoom-in"/);
  assert.match(viewer, /data-chart-action="zoom-out"/);
  assert.doesNotMatch(viewer, /type="range"/);
  assert.match(viewer, /contextmenu/);
  assert.match(imageActions, /writeBlobToClipboard/);
  assert.match(imageActions, /canvasToPngBlob/);
  assert.match(imageActions, /fileName\s*=\s*`[^`]*\.png`/);
  assert.match(imageActions, /anchor\.download\s*=\s*fileName/);
  assert.match(imageActions, /M49\.68 0h337\.29/);
  assert.match(copyImage, /export async function canvasToPngBlob/);
  for (const label of ['chartViewTitle', 'chartFit', 'chartZoom', 'copyChartImage', 'saveChartPng', 'closeChartView']) {
    assert.match(translations, new RegExp(`${label}:\\s*string`));
  }
  assert.match(globalCss, /global-table-chart-viewer\.css/);
});

test('modal chart uses separate fixed legend and plot Chart instances with real plot dimensions', async () => {
  const viewer = await readOptional('ui/src/dom/tableChartViewer.ts') + '\n' + await readOptional('ui/src/dom/tableChartViewerChart.ts');
  assert.match(viewer, /legendChart\s*=\s*new win\.Chart\(/);
  assert.match(viewer, /plotChart\s*=\s*new win\.Chart\(/);
  assert.match(viewer, /plotShell\.style\.width/);
  assert.match(viewer, /plotShell\.style\.height/);
  assert.match(viewer, /buildPlotConfig[\s\S]*?legend:[\s\S]*?display:\s*false/);
  assert.doesNotMatch(viewer, /transform:\s*scale\(/);
  assert.match(viewer, /pointerdown/);
  assert.match(viewer, /scrollLeft/);
  assert.match(viewer, /scrollTop/);
});
