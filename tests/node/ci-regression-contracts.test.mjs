import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('VS Code uses the bookmark-aware shared markdown renderer', () => {
  const source = read('vscode/src/markdown/renderer.ts');
  assert.match(source, /export \* from ['"]\.\.\/\.\.\/\.\.\/ui\/src\/markdown\/renderer['"]/);
});

test('sidebar bookmark and search additions remain backwards-compatible', () => {
  const sidebar = read('ui/src/components/Sidebar/Sidebar.tsx');
  const search = read('ui/src/components/Sidebar/SidebarSearch.tsx');
  const scope = read('ui/src/components/Sidebar/sidebarSearchScope.ts');
  assert.match(sidebar, /state\.settings\.bookmarksEnabled && \(/);
  assert.match(search, /selectedFilePaths = EMPTY_SELECTED_FILE_PATHS/);
  assert.match(search, /hasScopeEntry = false/);
  assert.match(scope, /selectedFilePaths: ReadonlySet<string> = EMPTY_SELECTED_FILE_PATHS/);
});

test('Only native Tauri updater installation and restart are excluded from unit-test compilation', () => {
  const manager = read('tauri/src/update/manager.rs');
  const native = read('tauri/src/update/manager/native.rs');
  assert.match(manager, /pub fn start_download\(/);
  assert.match(manager, /pub async fn apply_scheduled_update\(/);
  assert.doesNotMatch(manager, /#\[cfg\(not\(test\)\)\]/);
  assert.match(native, /#\[cfg\(not\(test\)\)\]\s*pub\(super\) fn install\b[^{]*\{[^}]*update\.install\(/);
  assert.match(native, /#\[cfg\(not\(test\)\)\]\s*pub\(super\) fn restart\b[^{]*\{[^}]*app\.restart\(/);
  assert.match(native, /#\[cfg\(test\)\]\s*pub\(super\) fn install\b/);
  assert.match(native, /#\[cfg\(test\)\]\s*pub\(super\) fn restart\b/);
  assert.equal([...native.matchAll(/#\[cfg\(not\(test\)\)\]/g)].length, 2);
});

test('CI contracts include installer, release bundles, theme spacing, and new source coverage', () => {
  assert.equal(fs.existsSync(new URL('../../electron/build/installer.nsh', import.meta.url)), true);
  assert.match(read('electron/build/installer.nsh'), /!include \"MUI2\.nsh\"/);
  assert.match(read('.github/workflows/release.yml'), /cargo tauri build --bundles app,dmg/);
  assert.match(read('ui/src/styles/global/global-theme-tokyo-night.css'), /\.sidebar,[\s\S]*\.toc-panel\s*\{[^}]*margin-top:\s*var\(--theme-header-gap\)/);
  const manifest = read('tests/manifest/coverage-manifest.ts');
  for (const path of [
    'ui/src/components/Content/RandomTipCard.tsx',
    'ui/src/components/shared/ShortcutKeycaps.tsx',
    'ui/src/components/shared/parseShortcutText.tsx',
  ]) assert.ok(manifest.includes(`'${path}'`), path);
  assert.doesNotMatch(read('ui/src/components/shared/parseShortcutText.tsx'), /\bstyle\s*=/);
  assert.match(read('ui/src/styles/global/global-switch-tooltip-diff.css'), /\.sr-only\s*\{[^}]*position:\s*absolute/);
});

test('workspace insights is gated by runtime and appearance settings and accessible via More actions menu', () => {
  const topbar = read('ui/src/components/Topbar/Topbar.tsx');
  const desktopTabBar = read('ui/src/components/Desktop/DesktopTabBar.tsx');
  const toolbarMenu = read('ui/src/components/shared/ToolbarActionMenu.tsx');
  const tabsHeader = read('ui/src/components/Sidebar/SidebarTabsHeader.tsx');
  const panel = read('ui/src/components/Settings/SettingsFeaturesSection.tsx');
  const types = read('ui/src/themeTypes.ts');
  const model = read('ui/src/contexts/appStateModel.ts');
  const effects = read('ui/src/contexts/useAppStateEffects.ts');
  const importExport = read('ui/src/settings/settingsImportExport.ts');
  const entry = read('ui/src/components/Insights/WorkspaceInsightsEntry.tsx');

  assert.match(types, /insightsEnabled:\s*boolean/);
  assert.match(model, /insightsEnabled:\s*false/);
  assert.match(effects, /insightsEnabled:\s*state\.settings\.insightsEnabled/);
  assert.match(importExport, /insightsEnabled:\s*raw\.insightsEnabled === true/);
  assert.match(panel, /updateSettings\(\{\s*insightsEnabled:\s*event\.target\.checked\s*\}\)/);
  assert.match(topbar, /showInsights=\{supportsWorkspaceInsights\(state\.appRuntime\) && state\.settings\.insightsEnabled\}/);
  assert.match(desktopTabBar, /showInsights=\{supportsWorkspaceInsights\(state\.appRuntime\) && state\.settings\.insightsEnabled\}/);
  assert.match(toolbarMenu, /showInsights && insightsLabel/);
  assert.doesNotMatch(tabsHeader, /WorkspaceInsightsEntry/);
  assert.match(entry, /if \(!state\.settings\.insightsEnabled\) return null/);
});

