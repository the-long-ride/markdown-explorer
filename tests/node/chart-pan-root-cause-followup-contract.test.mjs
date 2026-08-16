import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('chart viewport owns scrolling and never inherits media modal content-wrap overflow', async () => {
  const [viewer, viewerCss, mediaCss] = await Promise.all([
    read('ui/src/dom/tableChartViewer.ts'),
    read('ui/src/styles/global/global-table-chart-viewer.css'),
    read('ui/src/styles/global/global-media-viewer-settings-shell.css'),
  ]);

  assert.doesNotMatch(
    viewer,
    /class=["'][^"']*mdn-modal-content-wrap[^"']*mdn-chart-viewer__viewport/,
    'Chart View must not inherit Media Modal overflow/centering rules',
  );
  assert.match(viewer, /class=["']mdn-chart-viewer__viewport["']/);
  assert.match(viewerCss, /\.mdn-chart-viewer__viewport\s*\{[\s\S]*?overflow:\s*auto/);
  assert.match(viewerCss, /\.mdn-chart-viewer__viewport\s*\{[\s\S]*?display:\s*block/);
  assert.match(mediaCss, /\.mdn-modal-content-wrap\s*\{[\s\S]*?overflow:\s*hidden/);
});

test('modal chart type menu renders every option without an internal scrollbar', async () => {
  const css = await read('ui/src/styles/global/global-table-chart-viewer.css');
  assert.match(
    css,
    /\.mdn-chart-viewer__type-dropdown\s+\.mdn-table-view-menu\s*\{[\s\S]*?max-height:\s*none[\s\S]*?overflow:\s*visible/,
  );
  assert.match(
    css,
    /\.mdn-chart-viewer__type-dropdown\s+\.mdn-table-view-menu::-webkit-scrollbar\s*\{[\s\S]*?display:\s*none/,
  );
});

test('chart footer keeps legends visible and stacks controls when horizontal space is tight', async () => {
  const css = await read('ui/src/styles/global/global-table-chart-viewer.css');
  assert.match(
    css,
    /\.mdn-chart-viewer__footer\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*minmax\(180px,\s*1fr\)\s+auto/,
  );
  assert.match(css, /\.mdn-chart-viewer__legend\s*\{[\s\S]*?min-width:\s*180px/);
  assert.match(
    css,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mdn-chart-viewer__footer\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(
    css,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mdn-chart-viewer__footer\s+\.mdn-modal-toolbar\s*\{[\s\S]*?justify-self:\s*end/,
  );
});
