import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');


test('shared app switch primitive is reused by shortcuts, columns, and More actions sidebar/TOC', async () => {
  const [shared, shortcuts, columns, menu, switchCss, globalCss, settingsCss, topbarCss, tableCss] = await Promise.all([
    read('ui/src/components/shared/SwitchButton.tsx'),
    read('ui/src/components/Settings/SettingsShortcutsPanel.tsx'),
    read('ui/src/dom/tableColumnHandlers.ts'),
    read('ui/src/components/shared/ToolbarActionMenu.tsx'),
    read('ui/src/styles/global/global-switch-button.css'),
    read('ui/src/styles/global.css'),
    read('ui/src/styles/global/global-settings-layout.css'),
    read('ui/src/styles/global/global-topbar-actions.css'),
    read('ui/src/styles/global/global-table-view-controls.css'),
  ]);
  assert.match(shared, /export function SwitchButton/);
  assert.match(shared, /export function createSwitchButtonElement/);
  assert.match(shared, /app-switch/);
  assert.match(shortcuts, /<SwitchButton/);
  assert.match(columns, /createSwitchButtonElement/);
  assert.match(menu, /<SwitchButton/);
  assert.match(menu, /id:\s*['"]sidebar['"][\s\S]*?toggleState:\s*sidebarActive/);
  assert.match(menu, /id:\s*['"]toc['"][\s\S]*?toggleState:\s*tocActive/);
  assert.match(switchCss, /\.app-switch/);
  assert.match(globalCss, /global-switch-button\.css/);
  assert.doesNotMatch(settingsCss, /\.app-switch\s*\{/);
  assert.doesNotMatch(topbarCss, /\.toolbar-action-menu__switch\s*\{/);
  assert.doesNotMatch(tableCss, /\.mdn-table-columns-menu__switch\s*\{/);
});


test('inline chart opens viewer only from Chart.js plot area and leaves legend interaction to Chart.js', async () => {
  const viewer = await read('ui/src/dom/tableChartViewer.ts');
  assert.match(viewer, /chartArea/);
  assert.match(viewer, /isPointInsideChartArea|pointInsideChartArea/);
  assert.match(viewer, /getChartInstance|Chart\.getChart/);
  assert.doesNotMatch(viewer, /canvas\.addEventListener\(['"]click['"],\s*\(\)\s*=>\s*\{/);
});


test('chart viewer reuses media modal controls with icon-only Fit and fixed interactive legend', async () => {
  const [viewerSource, chartHelper, css] = await Promise.all([
    read('ui/src/dom/tableChartViewer.ts'),
    read('ui/src/dom/tableChartViewerChart.ts'),
    read('ui/src/styles/global/global-table-chart-viewer.css'),
  ]);
  const viewer = viewerSource + '\n' + chartHelper;
  assert.match(viewer, /class="mdn-modal[^\"]*mdn-chart-viewer/);
  assert.match(viewer, /mdn-modal-close/);
  assert.match(viewer, /mdn-modal-toolbar/);
  assert.match(viewer, /mdn-modal-tool/);
  assert.match(viewer, /data-chart-action="fit"/);
  assert.match(viewer, /tooltip-text/);
  assert.match(viewer, /M114\.89,89\.82/);
  assert.match(viewer, /mdn-chart-viewer__legend/);
  assert.match(viewer, /mdn-chart-viewer__plot/);
  assert.match(viewer, /mdn-chart-viewer__viewport[\s\S]*?mdn-chart-viewer__legend/);
  assert.match(viewer, /legendChart/);
  assert.match(viewer, /plotChart/);
  assert.match(viewer, /context\.drawImage\(plotCanvas[\s\S]*?context\.drawImage\(legendCanvas/);
  assert.match(viewer, /plugins:\s*\{[\s\S]*?legend:\s*\{[\s\S]*?display:\s*false/);
  assert.doesNotMatch(viewer, /new Set\(\[\.\.\.Object\.keys\(sourceScales\),\s*['"]x['"],\s*['"]y['"],\s*['"]r['"]\]\)/);
  assert.match(css, /\.mdn-chart-viewer__legend/);
  assert.match(css, /\.mdn-chart-viewer__plot/);
});


test('Tauri chart PNG save uses native save dialog through the platform bridge', async () => {
  const [viewer, imageActions, messages, dispatcher, pngExport, runtime] = await Promise.all([
    read('ui/src/dom/tableChartViewer.ts'),
    read('ui/src/dom/tableChartImageActions.ts'),
    read('ui/src/types/webviewMessages.ts'),
    read('tauri/src/dispatcher/commands_external.rs'),
    read('tauri/src/runtime/png_export.rs'),
    read('tauri/src/runtime/mod.rs'),
  ]);
  assert.match(messages, /SaveChartPngMessage/);
  assert.match(messages, /command:\s*['"]saveChartPng['"]/);
  assert.match(viewer, /tableChartImageActions/);
  assert.match(imageActions, /__TAURI__/);
  assert.match(imageActions, /PlatformBridge\.postMessage\(\{\s*command:\s*['"]saveChartPng['"]/s);
  assert.match(imageActions, /canvas\.toDataURL\(['"]image\/png['"]\)/);
  assert.match(dispatcher, /['"]saveChartPng['"]\s*=>/);
  assert.match(dispatcher, /add_filter\(['"]PNG['"],\s*&\[['"]png['"]\]\)/);
  assert.match(dispatcher, /set_file_name/);
  assert.match(dispatcher, /blocking_save_file/);
  assert.match(dispatcher, /std::fs::write/);
  assert.match(pngExport, /decode_png_data_url/);
  assert.match(pngExport, /PNG_DATA_URL_PREFIX/);
  assert.match(runtime, /pub mod png_export;/);
});
