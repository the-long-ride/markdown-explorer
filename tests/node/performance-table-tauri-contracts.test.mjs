import test from 'node:test';
import assert from 'node:assert/strict';
import { readProjectSource } from './read-refactored-source.mjs';

const read = readProjectSource;

test('scroll-to-top visibility state is isolated from the root App render', async () => {
  const [app, appView, button, hook] = await Promise.all([
    read('ui/src/App.tsx'),
    read('ui/src/AppView.tsx'),
    read('ui/src/components/shared/ScrollToTopButton.tsx'),
    read('ui/src/hooks/useScrollVisibility.ts'),
  ]);

  assert.doesNotMatch(app, /useScrollVisibility/);
  assert.doesNotMatch(app, /scrollTopVisible/);
  assert.match(appView, /<ScrollToTopButton/);
  assert.match(button, /useScrollVisibility/);
  assert.match(hook, /requestAnimationFrame/);
  assert.match(hook, /visibleRef\.current === nextVisible/);
});

test('Tauri host messages use a native bridge without frontend listen IPC', async () => {
  const [preload, hostMessages] = await Promise.all([
    read('tauri/src/preload/api.rs'),
    read('tauri/src/host_message.rs'),
  ]);
  const shim = preload.match(/r#"([\s\S]*?)"#/ )?.[1] ?? '';
  assert.match(shim, /__markdownExplorerHandleHostMessage/);
  assert.match(shim, /pendingHostMessages/);
  assert.doesNotMatch(shim, /__TAURI__\.event\.listen/);
  assert.match(hostMessages, /dispatch_native_host_message/);
  assert.match(hostMessages, /window\.__markdownExplorerHandleHostMessage/);
});

test('table operations and charts use every matching data row, not only collapsed-page rows', async () => {
  const [handlers, chartHandlers, chartConfig] = await Promise.all([
    read('ui/src/dom/tableHandlers.ts'),
    read('ui/src/dom/tableChartHandlers.ts'),
    read('ui/src/dom/tableChartConfig.ts'),
  ]);

  assert.match(handlers, /row\.dataset\.mdnFilterMatch = isMatched \? 'true' : 'false'/);
  assert.match(chartHandlers, /getMatchedTableRows/);
  assert.doesNotMatch(chartHandlers, /MAX_CHART_ROWS/);
  assert.doesNotMatch(chartHandlers, /rows\.slice\(0,/);
  assert.match(chartConfig, /animation:\s*false/);
});

test('UpdateStatus is imported only in Rust tests', async () => {
  const manager = await read('tauri/src/update/manager.rs');
  assert.match(manager, /^use crate::update::UpdateState;/m);
  assert.doesNotMatch(manager, /^use crate::update::\{UpdateState, UpdateStatus\};/m);
  assert.match(manager, /#\[cfg\(test\)\][\s\S]*use crate::update::UpdateStatus;/);
});

test('Tauri file-drop bridge uses native Rust webview events without frontend event-listen IPC', async () => {
  const [preload, bootstrap] = await Promise.all([
    read('tauri/src/preload/api.rs'),
    read('tauri/src/core/bootstrap.rs'),
  ]);

  const shim = preload.match(/r#"([\s\S]*?)"#/ )?.[1] ?? '';
  assert.doesNotMatch(shim, /onDragDropEvent/);
  assert.doesNotMatch(shim, /__TAURI__\.event\.listen/);
  assert.match(shim, /__markdownExplorerHandleHostMessage/);
  assert.match(await read('tauri/src/host_message.rs'), /dispatch_native_host_message/);
  assert.doesNotMatch(shim, /tauri:\/\/drag-enter/);
  assert.match(preload, /__markdownExplorerHandleNativeDrop/);
  assert.match(bootstrap, /on_webview_event/);
  assert.match(bootstrap, /WebviewEvent::DragDrop/);
  assert.match(bootstrap, /DragDropEvent::Drop/);
});

test('media modal snapshots rendered diagrams before opening and content is memoized', async () => {
  const [app, appView, content, contentView, modal, gallery, snapshot] = await Promise.all([
    read('ui/src/App.tsx'),
    read('ui/src/AppView.tsx'),
    read('ui/src/components/Content/Content.tsx'),
    read('ui/src/components/Content/ContentMainView.tsx'),
    read('ui/src/components/Modal/MediaModal.tsx'),
    read('ui/src/components/Modal/mediaGallery.ts'),
    read('ui/src/components/Content/enhancements/mermaidSvgSnapshot.ts'),
  ]);

  assert.match(app, /createMediaGallery/);
  assert.match(app, /setMediaGallery\(gallery\)/);
  assert.doesNotMatch(app, /setModalTarget/);
  assert.match(appView, /gallery=\{mediaGallery\}/);
  assert.match(content, /export const Content = memo/);
  assert.match(contentView, /memo\(/);
  assert.doesNotMatch(modal, /document\.querySelectorAll/);
  assert.doesNotMatch(modal, /clickedElement/);
  assert.match(gallery, /snapshotSvgHtml/);
  assert.match(snapshot, /export function snapshotSvgHtml/);
  assert.match(snapshot, /outerHTML/);
});

test('keyboard shortcut search uses one focus-within surface with an icon and integrated clear action', async () => {
  const [panel, css] = await Promise.all([
    read('ui/src/components/Settings/SettingsShortcutsPanel.tsx'),
    read('ui/src/styles/global/global-settings-shortcut-search.css'),
  ]);

  assert.match(panel, /settings-shortcuts-search-icon/);
  assert.match(css, /\.settings-shortcuts-search:focus-within/);
  assert.match(css, /\.settings-shortcuts-search-icon/);
  assert.match(css, /\.settings-shortcuts-search-clear\.is-visible/);
});
