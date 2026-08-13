import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function walk(dir) {
  const rootPath = fileURLToPath(new URL(`../../${dir}/`, import.meta.url));
  const result = [];
  const visit = (path) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      if (statSync(full).isDirectory()) visit(full);
      else if (/\.(?:ts|tsx)$/.test(name)) result.push(full);
    }
  };
  visit(rootPath);
  return result;
}

test('Appearance no longer renders a View Preferences secondary heading', () => {
  const source = read('ui/src/components/Settings/SettingsPreferencesPanel.tsx');
  assert.doesNotMatch(source, /settings-panel-heading[^\n]*viewPrefs/);
  assert.doesNotMatch(source, /t\.viewPrefs/);
  assert.doesNotMatch(read('ui/src/contexts/translationTypes.ts'), /\bviewPrefs\s*:/);
});

test('Typography Apply action icons have a fixed theme-independent 14px box', () => {
  const component = read('ui/src/components/Settings/DesktopTypographySettings.tsx');
  const css = read('ui/src/styles/global/global-settings-typography.css');
  assert.match(component, /TypographyApplyIcon[^>]*className="desktop-typography-action-icon"[^>]*size=\{14\}/);
  assert.match(css, /\.desktop-typography-action-icon\s*\{[\s\S]*?width:\s*14px\s*!important;[\s\S]*?height:\s*14px\s*!important;[\s\S]*?flex:\s*0 0 14px\s*!important;/);
});

test('recent Settings and shell accessibility strings use translations', () => {
  const settings = read('ui/src/components/Settings/SettingsModal.tsx');
  const shortcuts = read('ui/src/components/Settings/SettingsShortcutsPanel.tsx');
  const appView = read('ui/src/AppView.tsx');
  const updates = read('ui/src/components/Settings/SettingsUpdateBackupPanel.tsx');
  assert.doesNotMatch(settings, /aria-label="(?:Languages|Settings sections|Update available)"/);
  assert.match(settings, /t\.ui\.(?:languages|settingsSections|updateAvailable)/);
  assert.doesNotMatch(shortcuts, /(?:placeholder|aria-label)="(?:Search keyboard shortcuts\.\.\.|Search keyboard shortcuts|Clear keyboard shortcut search|Click to record\.\.\.)"/);
  assert.match(shortcuts, /t\.ui\.shortcutSearch/);
  assert.doesNotMatch(appView, /aria-label="Resize (?:sidebar|table of contents)"/);
  assert.match(appView, /t\.ui\.resizeSidebar/);
  assert.match(appView, /t\.ui\.resizeToc/);
  assert.doesNotMatch(updates, /aria-label="Update available"/);
});

test('audited renderer user-facing literals are removed from UI source', () => {
  const files = walk('ui/src/components');
  const rendererFiles = [
    'ui/src/markdown/tableRenderer.ts',
    'ui/src/markdown/codeRenderer.ts',
    'ui/src/markdown/renderer.ts',
    'ui/src/markdown/inline.ts',
    'ui/src/dom/tableHandlers.ts',
    'ui/src/dom/tableChartHandlers.ts',
    'ui/src/dom/copyHandlers.ts',
    'ui/src/dom/globalHandlers.ts',
    'ui/src/components/Content/enhancements/tableEnhancement.ts',
  ];
  const source = [
    read('ui/src/AppView.tsx'),
    ...files.map((path) => readFileSync(path, 'utf8')),
    ...rendererFiles.map(read),
  ].join('\n');
  const forbidden = [
    'Another Tip',
    'Close Theme Remix',
    'Search keyboard shortcuts...',
    'Clear keyboard shortcut search',
    'Click to record...',
    'Press keys...',
    'Return to workspace selection?',
    'Close the current workspace and choose another one?',
    'Choose Your Theme',
    'You can change this later from Settings.',
    'Welcome to Markdown Explorer',
    'I have read and agreed to the Privacy Policy and Terms of Service.',
    'Drop folder or file to open',
    'Documentation viewer & navigator',
    'Tip: Double-click a workspace tab in Tab view to rename it.',
    'Browser Configuration Guide',
    'Preparing local HTML preview…',
    'Create a custom theme to unlock remix controls.',
    'Custom theme limit reached.',
    'Background image added.',
    'Choose an image file.',
    'Filter by values',
    'Search table',
    'Filter rows…',
    'Wrap table text',
    'Unwrap table text',
    'Filter Values',
    'No values',
    'Bar Chart',
    'Line Chart',
    'Pie Chart',
    'Table view type',
    'Copied!',
    'Copy section content',
    'Open video',
    'Watch on YouTube',
  ];
  for (const literal of forbidden) {
    assert.equal(source.includes(literal), false, `hard-coded user-facing literal remains: ${literal}`);
  }
});



test('whole-app audit removes remaining visible English fallbacks from loading, sidebar, tabs, and recents', () => {
  const app = read('ui/src/App.tsx');
  const sidebar = read('ui/src/components/Sidebar/Sidebar.tsx');
  const itemMenu = read('ui/src/components/Sidebar/sidebarItemMenuItems.tsx');
  const tabs = read('ui/src/components/Content/ContentTabs.tsx');
  const recent = read('ui/src/components/Workspace/RecentWorkspaceItem.tsx');
  const time = read('ui/src/components/Workspace/workspaceSelectionUtils.ts');
  assert.doesNotMatch(app, /'Loading docs\.\.\.'|>\s*Scanning\s*\{/);
  assert.match(app, /t\.ui\.loadingDocs/);
  assert.match(app, /t\.ui\.scanningFiles/);
  assert.doesNotMatch(sidebar, /"File navigation|\|\| "(?:Check all|Uncheck all|Clear all pinned items|Sort files and folders|Pinned)/);
  assert.doesNotMatch(itemMenu, /\|\| '(?:Unpin|Pin this file|Pin this folder)'/);
  assert.doesNotMatch(tabs, /Unable to open file in browser/);
  assert.doesNotMatch(read('ui/src/components/Search/FindInFilePanel.tsx'), /statusOn \|\| 'On'|statusOff \|\| 'Off'/);
  assert.doesNotMatch(read('ui/src/components/Sidebar/SidebarSearch.tsx'), /statusOn \|\| 'On'|statusOff \|\| 'Off'/);
  assert.match(recent, /formatLastOpened\(item\.lastOpened,\s*currentLang\)/);
  assert.match(time, /Intl\.RelativeTimeFormat/);
});

test('translation catalogs expose audited UI groups for all nine locales', () => {
  const types = [
    read('ui/src/contexts/translationTypes.ts'),
    read('ui/src/contexts/auditedUiTranslationTypes.ts'),
  ].join('\n');
  const data = read('ui/src/contexts/translationsData.ts');
  const inline = read('ui/src/contexts/translations.ts');
  for (const group of ['ui', 'themeRemix', 'terms', 'onboarding', 'workspaceSelection', 'rendererUi']) {
    assert.match(types, new RegExp(`\\b${group}:\\s*\\{`));
    assert.match(inline, new RegExp(`\\b${group}:\\s*(?:\\{|AUDITED_UI_TRANSLATIONS\\.en\\.${group})`));
  }
  const audited = read('ui/src/contexts/auditedUiTranslations.ts');
  assert.match(audited, /satisfies\s+Record<AppLanguage,\s*AuditedUiTranslationDomains>/);
  for (const locale of ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru']) {
    assert.match(data, new RegExp(`ui:\\s*AUDITED_UI_TRANSLATIONS\\.${locale}\\.ui`));
    assert.match(audited, new RegExp(`\\n  ${locale}:\\s*\\{[\\s\\S]*?\\n    ui:`));
  }
});

test('active locale is carried into generated Markdown controls and dynamic table handlers', () => {
  const contentState = read('ui/src/contexts/contentTabState.ts');
  const renderer = read('ui/src/markdown/renderer.ts');
  const tableRenderer = read('ui/src/markdown/tableRenderer.ts');
  const tableHandlers = read('ui/src/dom/tableHandlers.ts');
  const reducer = read('ui/src/contexts/reducers/settingsUiReducer.ts');
  assert.match(contentState, /defaultCsvPreview' \| 'language'/);
  assert.match(contentState, /language:\s*previewSettings\?\.language/);
  assert.match(renderer, /getTranslations\(options\?\.language\)/);
  assert.match(tableRenderer, /data-ui-labels="\$\{encodedLabels\}"/);
  assert.match(tableHandlers, /getTableUiLabels\(tableId\)/);
  assert.match(reducer, /'language' in action\.settings/);
});

test('Unreleased changelog and current-state specs describe this synchronized state', () => {
  const changelog = read('CHANGELOG.md');
  const currentState = read('docs/instructions/05-reference/07-current-app-state.md');
  const settingsSpec = read('docs/instructions/03-features/12-settings-preferences-import-export.md');
  assert.match(changelog, /## \[Unreleased\][\s\S]*Appearance[^\n]*View Preferences/i);
  assert.match(changelog, /## \[Unreleased\][\s\S]*localization/i);
  assert.match(changelog, /## \[Unreleased\][\s\S]*Typography[^\n]*icon/i);
  assert.match(currentState, /Electron[\s\S]*Tauri[\s\S]*VS Code[\s\S]*Chromium/i);
  assert.match(currentState, /800 px/);
  assert.match(currentState, /Ctrl\+Alt\+Z/);
  assert.match(currentState, /nine supported locales|9 supported locales/i);
  assert.match(currentState, /system fonts[^\n]*imported/i);
  assert.match(settingsSpec, /Appearance[^\n]*without[^\n]*secondary[^\n]*heading/i);
});
