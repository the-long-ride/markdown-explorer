import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('More Actions uses compact sizing and supplied fullscreen/reset zoom icons', async () => {
  const [css, menu, icons] = await Promise.all([
    read('ui/src/styles/global/global-topbar-actions.css'),
    read('ui/src/components/shared/ToolbarActionMenu.tsx'),
    read('ui/src/components/shared/icons.tsx'),
  ]);
  assert.doesNotMatch(css, /Larger More Actions menu targets/);
  assert.match(css, /\.toolbar-action-menu__item\s*\{[\s\S]*?min-height:\s*30px[\s\S]*?font-size:\s*11px/);
  assert.match(menu, /id:\s*["']resetZoom["']/);
  assert.match(menu, /FullscreenMenuIcon/);
  assert.match(menu, /ResetZoomMenuIcon/);
  assert.match(icons, /viewBox="0 0 122\.88 122\.87"/);
  assert.match(icons, /viewBox="0 0 121\.7 122\.88"/);
});

test('Settings close tooltip renders Esc through shared named-key keycaps', async () => {
  const [modal, parser] = await Promise.all([
    read('ui/src/components/Settings/SettingsModal.tsx'),
    read('ui/src/components/shared/parseShortcutText.tsx'),
  ]);
  assert.match(modal, /className="settings-card__close"[\s\S]*?shortcut="Esc"/);
  assert.match(parser, /Esc(?:ape)?/i);
  assert.match(parser, /ShortcutKeycaps/);
});

test('Settings card width is 800px and responsive CSS does not force 520px', async () => {
  const [shell, responsive] = await Promise.all([
    read('ui/src/styles/global/global-media-viewer-settings-shell.css'),
    read('ui/src/styles/global/global-settings-responsive.css'),
  ]);
  assert.match(shell, /\.settings-card--settings\s*\{[\s\S]*?width:\s*min\(800px,\s*100vw\s*-\s*32px\)/);
  assert.doesNotMatch(responsive, /\.settings-card--settings\s*\{[\s\S]{0,180}?width:\s*min\(520px/);
});

test('focus mode hides navigation chrome and exit action does not use minimize icon', async () => {
  const [css, app] = await Promise.all([
    read('ui/src/styles/global/global-content-tabs-focus-search.css'),
    read('ui/src/AppView.tsx'),
  ]);
  for (const selector of ['.topbar', '.desktop-tabbar', '.sidebar', '.sidebar-resize', '.toc-resize', '.content-tabs-wrap']) {
    assert.match(css, new RegExp(`app--focus-mode[\\s\\S]{0,900}${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
  assert.match(app, /state\.focusMode[\s\S]*ExitFocusIcon/);
  assert.doesNotMatch(app, /state\.focusMode[\s\S]{0,500}<MinimizeIcon/);
});

test('Reset zoom is desktop-only and defaults to Ctrl+Alt+Z', async () => {
  const [constants, actions, keyboard, webview, topbar, tabbar] = await Promise.all([
    read('ui/src/contexts/appStateConstants.ts'),
    read('ui/src/components/Settings/settingsActions.ts'),
    read('ui/src/hooks/keyboardUtils.ts'),
    read('ui/src/types/webviewMessages.ts'),
    read('ui/src/components/Topbar/Topbar.tsx'),
    read('ui/src/components/Desktop/DesktopTabBar.tsx'),
  ]);
  assert.match(constants, /resetZoom:\s*['"]Ctrl\+Alt\+Z['"]/);
  assert.match(actions, /id:\s*['"]resetZoom['"][^\n]*scope:\s*['"]electron['"]/);
  assert.match(keyboard, /state\.isDesktop[\s\S]*state\.keybindings\.resetZoom/);
  assert.doesNotMatch(keyboard, /e\.key\s*===\s*['"]0['"]/);
  assert.match(webview, /command:\s*['"]zoom-reset['"]/);
  assert.match(topbar, /showResetZoom=\{isDesktop\}/);
  assert.match(tabbar, /showResetZoom/);
});

test('Electron and Tauri reset zoom and use 800px minimum width', async () => {
  const [electronWindow, electronIpc, electronRuntime, tauriBoot, tauriCommands, tauriSettings] = await Promise.all([
    read('electron/window/window.js'),
    read('electron/core/ipc-handlers.js'),
    read('electron/core/main-runtime.js'),
    read('tauri/src/core/bootstrap.rs'),
    read('tauri/src/dispatcher/commands_window_update.rs'),
    read('tauri/src/dispatcher/settings.rs'),
  ]);
  assert.match(electronWindow, /minWidth:\s*800/);
  assert.match(electronIpc, /case\s+["']zoom-reset["']/);
  assert.match(electronRuntime, /setZoomLevel\(0\)/);
  assert.match(tauriBoot, /min_inner_size\(800\.0,\s*480\.0\)/);
  assert.match(tauriCommands, /["']zoom-reset["']/);
  assert.match(tauriSettings, /zoom_level\s*=\s*0\.0/);
  assert.match(tauriSettings, /set_zoom\(1\.0\)/);
});

test('VS Code exposes system/imported Typography while Chromium/Web stay excluded', async () => {
  const [modal, prefs, effects, panel, fontBridge, types, apply, manifest] = await Promise.all([
    read('ui/src/components/Settings/SettingsModal.tsx'),
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/contexts/useAppStateEffects.ts'),
    read('vscode/src/core/panel.ts'),
    read('vscode/src/fonts/panelFontBridge.ts'),
    read('vscode/src/types.ts'),
    read('ui/src/desktop/fonts/applyDesktopTypography.ts'),
    read('tests/manifest/coverage-manifest.ts'),
  ]);
  assert.match(modal, /supportsTypography\s*=\s*isDesktop\s*\|\|\s*state\.appRuntime\s*===\s*["']vscode["']/);
  assert.match(modal, /supportsTypography\s*\?\s*\[\{\s*id:\s*['"]typography['"]/);
  assert.match(prefs, /supportsTypography/);
  assert.match(effects, /state\.appRuntime\s*===\s*['"]vscode['"]/);
  for (const command of ['listDesktopFonts', 'importDesktopFonts', 'removeImportedDesktopFont']) {
    assert.match(types, new RegExp(`command:\\s*['"]${command}['"]`));
    assert.match(fontBridge, new RegExp(`case\\s*['"]${command}['"]`));
  }
  assert.match(panel, /getGlobalStorageUri/);
  assert.match(fontBridge, /globalStorageUri/);
  assert.match(fontBridge, /asWebviewUri/);
  assert.match(apply, /vscode-resource|vscode-webview|vscode-cdn/i);
  assert.match(manifest, /vscode\/src\/fonts\/fontService\.ts/);
  assert.match(manifest, /vscode\/src\/fonts\/panelFontBridge\.ts/);
});
