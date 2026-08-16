import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('inline and modal chart selectors share one chart-view registry and modal excludes Table', async () => {
  const [views, handlers, viewer] = await Promise.all([
    read('ui/src/dom/tableChartViews.ts'),
    read('ui/src/dom/tableChartHandlers.ts'),
    read('ui/src/dom/tableChartViewer.ts'),
  ]);
  assert.match(views, /export const CHART_VIEWS/);
  assert.match(views, /export const MODAL_CHART_VIEWS\s*=\s*CHART_VIEWS\.filter/);
  assert.match(views, /item\.id\s*!==\s*['"]table['"]/);
  assert.match(views, /export function isViewEligible/);
  assert.match(views, /export function viewLabel/);
  assert.match(views, /export function usesItemLegend/);
  assert.match(handlers, /from ['"]\.\/tableChartViews['"]/);
  assert.match(viewer, /from ['"]\.\/tableChartViews['"]/);
  assert.match(viewer, /mdn-chart-viewer__type-dropdown/);
  assert.match(viewer, /data-chart-view-option/);
  assert.doesNotMatch(viewer, /data-chart-view-option="table"/);
});

test('modal chart type is local and legend visibility resets only across legend semantic groups', async () => {
  const viewer = await read('ui/src/dom/tableChartViewer.ts');
  assert.match(viewer, /let activeViewType\s*=\s*viewType/);
  assert.match(viewer, /createPayload\(tableId,\s*activeViewType\)/);
  assert.match(viewer, /usesItemLegend\(previousViewType\)\s*!==\s*usesItemLegend\(nextViewType\)/);
  assert.match(viewer, /hiddenDatasets\.clear\(\)/);
  assert.match(viewer, /hiddenItems\.clear\(\)/);
  assert.doesNotMatch(viewer, /switchView\(tableId,\s*nextViewType/);
  assert.match(viewer, /mdn-table-view-menu[\s\S]*?mdn-chart-viewer__type-menu/);
});

test('chart plot wheel zoom prevents page scroll and inline canvas exposes zoom-in cursor only over chart area', async () => {
  const viewer = await read('ui/src/dom/tableChartViewer.ts');
  assert.match(viewer, /viewport\.addEventListener\(['"]wheel['"]/);
  assert.match(viewer, /event\.preventDefault\(\)/);
  assert.match(viewer, /event\.deltaY\s*<\s*0[\s\S]*?CHART_SCALE_STEP/);
  assert.match(viewer, /\{\s*passive:\s*false\s*\}/);
  assert.match(viewer, /canvas\.addEventListener\(['"]pointermove['"]/);
  assert.match(viewer, /isPointInsideChartArea\(chart,\s*event,\s*canvas\)[\s\S]*?['"]zoom-in['"]/);
  assert.match(viewer, /canvas\.addEventListener\(['"]pointerleave['"]/);
});

test('chart viewer uses compact scrolling legend, larger plot area, upward selector, small shared close control and themed toolbar radius', async () => {
  const [viewerCss, mediaCss] = await Promise.all([
    read('ui/src/styles/global/global-table-chart-viewer.css'),
    read('ui/src/styles/global/global-media-viewer-settings-shell.css'),
  ]);
  assert.match(viewerCss, /\.mdn-chart-viewer__legend\s*\{[\s\S]*?flex:\s*0\s+0\s+auto/);
  assert.match(viewerCss, /\.mdn-chart-viewer__legend\s*\{[\s\S]*?max-height:/);
  assert.match(viewerCss, /\.mdn-chart-viewer__legend\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(viewerCss, /\.mdn-chart-viewer__viewport\s*\{[\s\S]*?flex:\s*1\s+1\s+0/);
  assert.match(viewerCss, /\.mdn-chart-viewer__type-dropdown[\s\S]*?\.mdn-table-view-menu[\s\S]*?bottom:\s*calc\(100%/);
  assert.match(mediaCss, /\.mdn-modal-close\s*\{[\s\S]*?width:\s*36px[\s\S]*?height:\s*36px/);
  assert.match(mediaCss, /\.mdn-modal-toolbar\s*\{[\s\S]*?border-radius:\s*var\(--r/);
  assert.match(viewerCss, /\.mdn-chart-viewer\s+\.mdn-modal-close\s+svg[\s\S]*?width:\s*16px[\s\S]*?height:\s*16px/);
});
