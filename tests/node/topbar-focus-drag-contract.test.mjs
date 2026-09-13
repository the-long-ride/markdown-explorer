import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('focus-view breadcrumb only occupies fitted path width', async () => {
  const css = await read('ui/src/styles/global/global-topbar-tabs.css');
  assert.match(css, /\.topbar \.topbar__breadcrumb-container\s*\{[^}]*flex:\s*0 1 auto;[^}]*width:\s*fit-content;[^}]*max-width:\s*100%;/s);
  assert.match(css, /\.topbar \.topbar__breadcrumb\s*\{[^}]*flex:\s*0 1 auto;[^}]*width:\s*auto;[^}]*max-width:\s*100%;/s);
});

test('focus-view header keeps a draggable Tauri surface outside fullscreen', async () => {
  const [css, fullscreenCss] = await Promise.all([
    read('ui/src/styles/global/global-topbar-tabs.css'),
    read('ui/src/styles/global/global-tab-actions-menus.css'),
  ]);
  assert.match(css, /\.app--tauri:not\(\.app--fullscreen\) \.topbar\s*\{[^}]*-webkit-app-region:\s*drag;/s);
  assert.match(css, /\.app--tauri:not\(\.app--fullscreen\) \.topbar__breadcrumb-container[\s\S]*?-webkit-app-region:\s*no-drag;/s);
  assert.match(fullscreenCss, /\.app--tauri\.app--fullscreen \.topbar,[\s\S]*?-webkit-app-region:\s*no-drag !important;/s);
});
