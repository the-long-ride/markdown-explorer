import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('inline and modal legends expose pointer cursor only over interactive legend items', async () => {
  const [viewer, css] = await Promise.all([
    read('ui/src/dom/tableChartViewer.ts'),
    read('ui/src/styles/global/global-table-chart-viewer.css'),
  ]);
  assert.match(viewer, /export function isPointInsideChartLegend\(/);
  assert.match(viewer, /legendHitBoxes/);
  assert.match(viewer, /isPointInsideChartLegend\(chart,\s*event,\s*canvas\)[\s\S]*?['"]pointer['"]/);
  assert.match(viewer, /target\.closest<HTMLElement>\(['"]\[data-chart-legend-index\]['"]\)/);
  assert.match(css, /\.mdn-chart-viewer__legend-item\s*\{[\s\S]*?cursor:\s*pointer/);
  assert.match(viewer, /isPointInsideChartArea\(chart,\s*event,\s*canvas\)[\s\S]*?['"]zoom-in['"]/);
});

test('modal legend wraps with breathing room and pan surface centers only on axes that still fit', async () => {
  const [viewer, css] = await Promise.all([
    read('ui/src/dom/tableChartViewer.ts'),
    read('ui/src/styles/global/global-table-chart-viewer.css'),
  ]);
  assert.match(viewer, /mdn-chart-viewer__legend-items/);
  assert.match(css, /\.mdn-chart-viewer__legend-items\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(150px,\s*1fr\)\)/);
  assert.match(css, /\.mdn-chart-viewer__legend\s*\{[\s\S]*?padding:\s*6px\s+10px/);
  assert.match(viewer, /panSurface\.classList\.toggle\(['"]is-centered-x['"],\s*width\s*\+\s*panGutter\s*\*\s*2\s*<=\s*availableWidth\)/);
  assert.match(viewer, /panSurface\.classList\.toggle\(['"]is-centered-y['"],\s*height\s*\+\s*panGutter\s*\*\s*2\s*<=\s*availableHeight\)/);
  assert.match(css, /\.mdn-chart-viewer__plot\s*\{[\s\S]*?margin:\s*0/);
  assert.match(css, /\.mdn-chart-viewer__pan-surface\s*\{[\s\S]*?padding:\s*var\(--mdn-chart-pan-gutter\)/);
  assert.match(css, /\.mdn-chart-viewer__pan-surface\.is-centered-x\s*\{[\s\S]*?justify-content:\s*center/);
  assert.match(css, /\.mdn-chart-viewer__pan-surface\.is-centered-y\s*\{[\s\S]*?align-items:\s*center/);
});

test('shell action sizing is fixed across themes while native window glyphs stay smaller', async () => {
  const [globalCss, shellCss] = await Promise.all([
    read('ui/src/styles/global.css'),
    read('ui/src/styles/global/global-shell-control-sizing.css'),
  ]);
  assert.match(globalCss, /@import ['"]\.\/global\/global-shell-control-sizing\.css['"];?/);
  assert.match(shellCss, /--shell-action-size:\s*28px/);
  assert.match(shellCss, /--shell-action-icon-size:\s*14px/);
  assert.match(shellCss, /--shell-window-glyph-size:\s*10px/);
  assert.match(shellCss, /\.topbar__action-btn/);
  assert.match(shellCss, /\.sidebar__files-action/);
  assert.match(shellCss, /\.bookmarks-panel__actions\s+\.btn--icon/);
  assert.match(shellCss, /width:\s*var\(--shell-action-size\)/);
  assert.match(shellCss, /height:\s*var\(--shell-action-size\)/);
  assert.match(shellCss, /\.sidebar__tab-btn\s*\{[\s\S]*?gap:\s*6px[\s\S]*?padding:\s*2px\s+7px\s+6px/);
  assert.match(shellCss, /\.sidebar__tab-btn\s+svg[\s\S]*?width:\s*var\(--shell-action-icon-size\)/);
  assert.match(shellCss, /\.window-control-btn\s+svg[\s\S]*?width:\s*var\(--shell-window-glyph-size\)/);
  assert.match(shellCss, /transform:\s*none\s*!important/);
});
