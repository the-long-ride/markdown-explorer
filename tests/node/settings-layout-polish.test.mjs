import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('settings modal moves title/subtitle to header and uses a narrower borderless navigation shell', async () => {
  const [modal, css] = await Promise.all([
    read('ui/src/components/Settings/SettingsModal.tsx'),
    read('ui/src/styles/global/global-settings-navigation.css'),
  ]);
  assert.match(modal, /settings-navigation-header/);
  assert.match(modal, /<h2>\{t\.settings\}<\/h2>/);
  assert.match(modal, /<p>\{t\.subtitle\}<\/p>/);
  assert.doesNotMatch(modal, /settings-navigation__brand/);
  assert.match(css, /settings-card--navigation\s*\{[\s\S]*?width:\s*min\(666px,/);
  assert.match(css, /settings-navigation-header\s*\{[\s\S]*?border-bottom:\s*0;/);
  assert.match(css, /settings-navigation\s*\{[\s\S]*?border-inline-end:\s*0;/);
  assert.doesNotMatch(css, /settings-navigation\s*\{[\s\S]*?border-bottom:/);
  assert.match(css, /border-radius:\s*var\(--r\)/);
});

test('settings secondary actions are outline buttons while primary update remains filled', async () => {
  const [updatePanel, shortcuts, css] = await Promise.all([
    read('ui/src/components/Settings/SettingsUpdateBackupPanel.tsx'),
    read('ui/src/components/Settings/SettingsShortcutsPanel.tsx'),
    read('ui/src/styles/global/global-media-viewer-settings-shell.css'),
  ]);
  assert.equal((updatePanel.match(/<SettingsOutlineButton/g) ?? []).length >= 4, true);
  assert.match(updatePanel, /settings-update-dialog__restart/);
  assert.match(shortcuts, /settings-reset-shortcuts-btn/);
  assert.match(css, /settings-reset-shortcuts-btn[\s\S]*?background:\s*transparent/);
  assert.match(css, /settings-reset-shortcuts-btn[\s\S]*?box-shadow:\s*none/);
});

test('More Actions keeps standard control size while update dots are enlarged', async () => {
  const [topbarCss, searchCss, navigationCss] = await Promise.all([
    read('ui/src/styles/global/global-topbar-actions.css'),
    read('ui/src/styles/global/global-search-buttons.css'),
    read('ui/src/styles/global/global-settings-navigation.css'),
  ]);
  assert.doesNotMatch(topbarCss, /toolbar-action-menu\s*>\s*\.topbar__action-btn\s*\{[\s\S]*?38px/);
  assert.match(searchCss, /\.btn\.has-update::after\s*\{[\s\S]*?width:\s*11px;[\s\S]*?height:\s*11px;/);
  assert.match(topbarCss, /toolbar-action-menu__item\.has-update::after\s*\{[\s\S]*?width:\s*11px;[\s\S]*?height:\s*11px;/);
  assert.match(navigationCss, /settings-nav-badge-dot\s*\{[\s\S]*?width:\s*13px;[\s\S]*?height:\s*13px;/);
});

test('Theme Style menus use a fixed portal with collision-aware vertical placement', async () => {
  const source = await read('ui/src/components/Settings/ThemeStylePicker.tsx');
  assert.match(source, /createPortal/);
  assert.match(source, /useLayoutEffect/);
  assert.match(source, /roomBelow/);
  assert.match(source, /roomAbove/);
  assert.match(source, /openUp/);
  assert.match(source, /position:\s*['"]fixed['"]/);
});


test('settings tabs expose descriptions, theme content is centered, and version opens GitHub changelog with tooltip', async () => {
  const [modal, preferences, shortcuts, navigationCss, layoutCss, typographyCss] = await Promise.all([
    read('ui/src/components/Settings/SettingsModal.tsx'),
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/components/Settings/SettingsShortcutsPanel.tsx'),
    read('ui/src/styles/global/global-settings-navigation.css'),
    read('ui/src/styles/global/global-settings-layout.css'),
    read('ui/src/styles/global/global-settings-typography.css'),
  ]);
  assert.match(preferences, /settings-section-panel__header[\s\S]*?<h3>\{t\.appearance\}<\/h3>[\s\S]*?<p>\{t\.subtitle\}<\/p>/);
  assert.match(preferences, /settings-section-panel__header[\s\S]*?<h3>\{t\.themeStyle\}<\/h3>[\s\S]*?<p>\{t\.themeStyleDesc\}<\/p>/);
  assert.match(shortcuts, /settings-section-panel__header[\s\S]*?<h3>\{t\.shortcuts\}<\/h3>[\s\S]*?<p>\{t\.shortcutsHint\}<\/p>/);
  assert.match(typographyCss, /desktop-typography-settings\s*\{[\s\S]*?border-top:\s*0;/);
  assert.match(layoutCss, /settings-theme-style-section\s*\{[\s\S]*?margin-inline:\s*auto;/);
  assert.match(modal, /<TooltipButton[\s\S]*className="settings-navigation__version"[\s\S]*tooltip=\{t\.tooltips\.openChangelog\}/);
  assert.match(navigationCss, /settings-navigation__version[\s\S]*?text-decoration/);
});

test('update actions use supplied update icon, browser icon, and shared hover/pointer styling', async () => {
  const [panel, icons, layoutCss, translations] = await Promise.all([
    read('ui/src/components/Settings/SettingsUpdateBackupPanel.tsx'),
    read('ui/src/components/shared/icons.tsx'),
    read('ui/src/styles/global/global-settings-layout.css'),
    read('ui/src/contexts/translations.ts'),
  ]);
  assert.match(panel, /SettingsUpdateBackupIcon/);
  assert.match(panel, /OpenInBrowserIcon/);
  assert.match(icons, /export const SettingsUpdateBackupIcon/);
  assert.match(icons, /viewBox="0 0 512 401\.6"/);
  assert.match(layoutCss, /settings-outline-button[\s\S]*?cursor:\s*pointer;/);
  assert.match(layoutCss, /settings-outline-button:hover/);
  assert.match(translations, /viewChangelog:\s*"See changelog on GitHub"/);
});

test('desktop window close radius follows the active theme token', async () => {
  const css = await read('ui/src/styles/global/global-electron-window-controls.css');
  assert.match(css, /window-control-btn[\s\S]*?border-radius:\s*var\(--r\)\s*!important;/);
  assert.doesNotMatch(css, /border-radius:\s*4px\s*!important/);
});

test('Theme Style menus attach portal positioning to every trigger and cap lists at seven visible items', async () => {
  const [source, css] = await Promise.all([
    read('ui/src/components/Settings/ThemeStylePicker.tsx'),
    read('ui/src/styles/global/global-theme-picker-styles.css'),
  ]);
  assert.match(source, /MAX_VISIBLE_THEME_MENU_ITEMS\s*=\s*7/);
  assert.match(source, /ref=\{themeSelectRef\}/);
  assert.match(source, /ref=\{petSelectRef\}/);
  assert.match(source, /getThemeMenuDesiredHeight/);
  assert.match(css, /theme-picker-menu--portal[\s\S]*?overflow-y:\s*auto/);
});

test('settings tooltip layers remain above settings dropdown portals and edge controls align inward', async () => {
  const css = await read('ui/src/styles/global/global-switch-tooltip-diff.css');
  assert.match(css, /settings-card--settings[\s\S]*?tooltip-text[\s\S]*?z-index:\s*10000050/);
  assert.match(css, /settings-navigation__version[\s\S]*?tooltip-text/);
});
