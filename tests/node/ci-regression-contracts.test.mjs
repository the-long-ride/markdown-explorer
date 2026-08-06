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

test('Tauri updater runtime integration is excluded from unit-test compilation', () => {
  const source = read('tauri/src/update/manager.rs');
  assert.match(source, /#\[cfg\(not\(test\)\)\]\s*use \{[^}]*crate::app_state::AppState/);
  assert.match(source, /#\[cfg\(not\(test\)\)\]\s*pub fn start_download/);
  assert.match(source, /#\[cfg\(not\(test\)\)\]\s*pub async fn apply_scheduled_update/);
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
