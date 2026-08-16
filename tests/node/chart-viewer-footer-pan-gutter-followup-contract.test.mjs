import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('media and chart viewers share one footer surface while chart legend stays left of controls', async () => {
  const [media, viewer, mediaCss, viewerCss] = await Promise.all([
    read('ui/src/components/Modal/MediaModal.tsx'),
    read('ui/src/dom/tableChartViewer.ts'),
    read('ui/src/styles/global/global-media-viewer-settings-shell.css'),
    read('ui/src/styles/global/global-table-chart-viewer.css'),
  ]);

  assert.match(media, /mdn-modal-footer[^"']*media-modal__footer/);
  assert.match(media, /mdn-modal-footer[\s\S]*?mdn-modal-toolbar/);
  assert.match(viewer, /mdn-modal-footer\s+mdn-chart-viewer__footer[\s\S]*?mdn-chart-viewer__legend[\s\S]*?mdn-modal-toolbar/);
  assert.match(mediaCss, /\.mdn-modal-footer\s*\{[\s\S]*?box-shadow:\s*var\(--sh-lg\)/);
  assert.match(mediaCss, /\.mdn-modal-footer\s+\.mdn-modal-toolbar\s*\{[\s\S]*?position:\s*static[\s\S]*?box-shadow:\s*none/);
  assert.match(viewerCss, /\.mdn-chart-viewer__footer\s*\{[\s\S]*?display:\s*flex[\s\S]*?width:\s*100%/);
  assert.match(viewerCss, /\.mdn-chart-viewer__footer\s+\.mdn-modal-toolbar\s*\{[\s\S]*?margin-left:\s*auto/);
});

test('chart viewer pan surface provides reachable gutters and owns per-axis centering', async () => {
  const [viewer, css] = await Promise.all([
    read('ui/src/dom/tableChartViewer.ts'),
    read('ui/src/styles/global/global-table-chart-viewer.css'),
  ]);

  assert.match(viewer, /mdn-chart-viewer__viewport[\s\S]*?mdn-chart-viewer__pan-surface[\s\S]*?mdn-chart-viewer__plot/);
  assert.match(viewer, /const panSurface\s*=\s*backdrop\.querySelector\(['"]\.mdn-chart-viewer__pan-surface['"]\)/);
  assert.match(viewer, /panSurface\.classList\.toggle\(['"]is-centered-x['"],\s*width\s*\+\s*panGutter\s*\*\s*2\s*<=\s*availableWidth\)/);
  assert.match(viewer, /panSurface\.classList\.toggle\(['"]is-centered-y['"],\s*height\s*\+\s*panGutter\s*\*\s*2\s*<=\s*availableHeight\)/);
  assert.doesNotMatch(viewer, /plotShell\.classList\.toggle\(['"]is-centered-[xy]/);
  assert.match(viewer, /viewport\.clientWidth\s*-\s*panGutter\s*\*\s*2/);
  assert.match(viewer, /viewport\.clientHeight\s*-\s*panGutter\s*\*\s*2/);

  assert.match(css, /--mdn-chart-pan-gutter:\s*64px/);
  assert.match(css, /\.mdn-chart-viewer__pan-surface\s*\{[\s\S]*?padding:\s*var\(--mdn-chart-pan-gutter\)/);
  assert.match(css, /\.mdn-chart-viewer__pan-surface\.is-centered-x\s*\{[\s\S]*?justify-content:\s*center/);
  assert.match(css, /\.mdn-chart-viewer__pan-surface\.is-centered-y\s*\{[\s\S]*?align-items:\s*center/);
});

test('wheel zoom anchors to plot-local position so fixed gutters do not block edge panning', async () => {
  const viewer = await read('ui/src/dom/tableChartViewer.ts');
  assert.match(viewer, /const plotRect\s*=\s*plotShell\.getBoundingClientRect\(\)/);
  assert.match(viewer, /plotPointX\s*=\s*[^;]*plotRect\.left[^;]*\/\s*Math\.max\(1,\s*plotRect\.width\)/);
  assert.match(viewer, /plotPointY\s*=\s*[^;]*plotRect\.top[^;]*\/\s*Math\.max\(1,\s*plotRect\.height\)/);
  assert.match(viewer, /plotShell\.offsetLeft\s*\+\s*plotPointX\s*\*\s*plotShell\.offsetWidth/);
  assert.match(viewer, /plotShell\.offsetTop\s*\+\s*plotPointY\s*\*\s*plotShell\.offsetHeight/);
});

test('chart viewport and shared footer retain visible shadow in Raw Grid', async () => {
  const css = await read('ui/src/styles/global/global-table-chart-viewer.css');
  assert.match(css, /\[data-theme-style=['"]raw-grid['"]\]\s+\.mdn-chart-viewer__viewport[\s\S]*?\.mdn-chart-viewer__footer[\s\S]*?box-shadow:\s*4px\s+4px\s+0\s+var\(--bd-s\)/);
});
