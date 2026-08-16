import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('interactive table renders Columns as the right-most toolbar action', async () => {
  const source = await read('ui/src/markdown/tableRenderer.ts');
  const toolbar = source.match(/<div class="mdn-table-toolbar-actions">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="mdn-table-scroll"/)?.[1] ?? '';
  assert.match(toolbar, /mdn-table-columns/);
  assert.ok(toolbar.lastIndexOf('mdn-table-columns') > toolbar.lastIndexOf('mdn-table-view-switcher'));
  assert.match(toolbar, /Table\.toggleColumnMenu/);
});

test('table state and handlers support per-table hidden columns with a last-column guard', async () => {
  const [tableHandlers, columnHandlers] = await Promise.all([
    read('ui/src/dom/tableHandlers.ts'),
    read('ui/src/dom/tableColumnHandlers.ts'),
  ]);
  assert.match(tableHandlers, /hiddenColumnIdxs:\s*number\[\]/);
  assert.match(tableHandlers, /hiddenColumnIdxs:\s*\[\]/);
  assert.match(tableHandlers, /registerTableColumnHandlers/);
  assert.match(columnHandlers, /setColumnVisibility/);
  assert.match(columnHandlers, /showAllColumns/);
  assert.match(columnHandlers, /visibleColumnCount[^\n]*<=\s*1|visibleColumnCount\s*<=\s*1/s);
  assert.match(columnHandlers, /is-hidden-column/);
});

test('column controls have dedicated labels and styling', async () => {
  const [types, css] = await Promise.all([
    read('ui/src/contexts/auditedUiTranslationTypes.ts'),
    read('ui/src/styles/global/global-table-view-controls.css'),
  ]);
  assert.match(types, /columns:\s*string/);
  assert.match(types, /showAllColumns:\s*string/);
  assert.match(css, /mdn-table-columns/);
});


test('Chromium delegated click handling opens the Columns menu when MV3 blocks inline handlers', async () => {
  const [contentEffects, searchPreview] = await Promise.all([
    read('ui/src/components/Content/useContentEffects.ts'),
    read('ui/src/components/Search/SearchDocumentPreview.tsx'),
  ]);
  assert.match(contentEffects, /mdn-table-columns-toggle[\s\S]*?toggleColumnMenu/);
  assert.match(searchPreview, /mdn-table-columns-toggle[\s\S]*?toggleColumnMenu/);
});
