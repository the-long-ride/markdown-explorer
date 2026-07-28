import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(path.join(repoRoot, relativePath), 'utf8');
const locales = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'];

test('HTML documents use host Markdown when available and retain the shared source fallback', async () => {
  const [content, view, converter, tauri, electron, vscode] = await Promise.all([
    read('ui/src/components/Content/Content.tsx'),
    read('ui/src/components/Content/HtmlDocumentView.tsx'),
    read('ui/src/markdown/htmlToMarkdown.ts').catch(() => ''),
    read('tauri/src/dispatcher/handlers.rs'),
    read('electron/core/runtime-workspace-handlers.js'),
    read('vscode/src/core/panel.ts'),
  ]);
  assert.match(converter, /convertHtmlSourceToMarkdown/);
  assert.match(converter, /DOMParser/);
  assert.match(content, /convertHtmlSourceToMarkdown\(sourceDocumentText\)/);
  assert.match(content, /if \(hostHtmlMarkdownSource\)/);
  assert.match(view, /markdownHtml/);
  assert.match(tauri, /is_html_document/);
  assert.match(tauri, /source_document_text = if is_html_document/);
  assert.match(tauri, /native_html_conversion/);
  assert.match(tauri, /Some\(converter\.read_markdown/);
  assert.match(electron, /isHtmlDocument.*sourceDocumentText/s);
  assert.match(vscode, /isHtmlDocument.*sourceDocumentText/s);
});

test('HTML document and HTML code block defaults are independent and migrate from the legacy value', async () => {
  const [types, model, state, reducer, importExport, prefs] = await Promise.all([
    read('ui/src/themeTypes.ts'),
    read('ui/src/contexts/appStateModel.ts'),
    read('ui/src/contexts/contentTabState.ts'),
    read('ui/src/contexts/appStateReducer.ts'),
    read('ui/src/settings/settingsImportExport.ts'),
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/styles/global/global-content-layout.css'),
  ]);
  for (const source of [types, model, state, reducer, importExport, prefs]) {
    assert.match(source, /defaultHtmlCodeBlockPreview/);
  }
  assert.match(model, /defaultHtmlCodeBlockPreview:\s*saved\.defaultHtmlCodeBlockPreview\s*\?\?\s*saved\.defaultHtmlPreview\s*!==\s*false/);
  assert.match(importExport, /typeof raw\.defaultHtmlCodeBlockPreview === 'boolean'[\s\S]*raw\.defaultHtmlPreview\s*!==\s*false/);
  assert.match(state, /defaultHtmlPreview:\s*previewSettings\?\.defaultHtmlCodeBlockPreview/);
  assert.match(prefs, /htmlCodeBlockPreview/);
});

test('Ctrl Alt H toggles only the active HTML tab and is displayed in the tab menu', async () => {
  const [app, keyboard, constants, tabs] = await Promise.all([
    read('ui/src/App.tsx'),
    read('ui/src/hooks/keyboardUtils.ts'),
    read('ui/src/contexts/appStateConstants.ts'),
    read('ui/src/components/Content/ContentTabs.tsx'),
  ]);
  assert.match(constants, /settings:\s*'Ctrl\+,'/);
  assert.match(constants, /toggleHtmlPreview:\s*'Ctrl\+Alt\+H'/);
  assert.match(keyboard, /activeHtmlDocument/);
  assert.match(keyboard, /onToggleActiveHtmlDocumentPreview/);
  assert.doesNotMatch(app, /toggleDefaultHtmlPreview/);
  assert.match(tabs, /toggleHtmlPreviewShortcut/);
  assert.match(tabs, /shortcut:\s*toggleHtmlPreviewShortcut/);
});

test('local-first HTML preparation embeds workspace local CSS and JS while reporting network policy once', async () => {
  const [pipeline, view, bridge, content] = await Promise.all([
    read('ui/src/markdown/htmlLocalFirstPreview.ts').catch(() => ''),
    read('ui/src/components/Content/HtmlDocumentView.tsx'),
    read('ui/src/platform/bridge.ts'),
    read('ui/src/components/Content/Content.tsx'),
  ]);
  assert.match(pipeline, /prepareLocalFirstHtmlPreview/);
  assert.match(pipeline, /blockedRemoteStyles/);
  assert.match(pipeline, /blockedRemoteScripts/);
  assert.match(pipeline, /allowedRemoteImages/);
  assert.match(pipeline, /allowedRemoteFonts/);
  assert.match(pipeline, /allowedRemoteMedia/);
  assert.match(pipeline, /blockedNetworkApis/);
  assert.match(pipeline, /XMLHttpRequest/);
  assert.match(pipeline, /WebSocket/);
  assert.match(pipeline, /sendBeacon/);
  assert.match(pipeline, /Content-Security-Policy/);
  assert.match(pipeline, /connect-src 'none'/);
  assert.match(pipeline, /\(\?:https\?:\)\?\\\/\\\//);
  assert.match(bridge, /readWorkspaceTextResource/);
  assert.match(view, /onPolicyReport/);
  assert.match(content, /htmlLocalFirstWarning/);
  assert.match(content, /htmlPreviewWarningSeenRef/);
  assert.match(content, /htmlPreviewExperienceNoticeSeenRef/);
  assert.match(content, /warningSessionKey/);
  assert.match(content, /state\.renderVersion/);
});

test('HTML previews do not inherit Markdown Explorer typography or theme styles', async () => {
  const [documentBuilder, view, globalHandlers] = await Promise.all([
    read('ui/src/markdown/htmlPreviewDocument.ts'),
    read('ui/src/components/Content/HtmlDocumentView.tsx'),
    read('ui/src/dom/globalHandlers.ts'),
  ]);
  assert.doesNotMatch(documentBuilder, /--font-ui/);
  assert.doesNotMatch(documentBuilder, /--bg:/);
  assert.doesNotMatch(documentBuilder, /font-family:\s*var\(--font-ui\)/);
  assert.match(documentBuilder, /data-mdn-network-guard/);
  assert.match(view, /sandbox="allow-scripts allow-forms"/);
  assert.match(globalHandlers, /Math\.max\(640,\s*window\.innerHeight\s*\*\s*0\.9\)/);
});

test('settings confirm shortcut reset, use requested icons, and remove requested borders', async () => {
  const [shortcuts, dialogs, icons, modal, cssA, cssLayout, prefs, contentCss, rawGridCss] = await Promise.all([
    read('ui/src/components/Settings/SettingsShortcutsPanel.tsx'),
    read('ui/src/components/Settings/SettingsModalDialogs.tsx'),
    read('ui/src/components/shared/icons.tsx'),
    read('ui/src/components/Settings/SettingsModal.tsx'),
    read('ui/src/styles/global/global-modals-settings-a.part2.css'),
    read('ui/src/styles/global/global-settings-layout.css'),
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/styles/global/global-content-layout.css'),
    read('ui/src/styles/global/global-theme-raw-grid.css'),
  ]);
  assert.match(shortcuts, /onRequestReset/);
  assert.match(dialogs, /resetShortcutsConfirmTitle/);
  assert.match(dialogs, /resetShortcutsConfirmBody/);
  assert.match(icons, /export const ImportSettingsIcon/);
  assert.match(icons, /export const ExportSettingsIcon/);
  assert.match(modal, /ImportSettingsIcon/);
  assert.match(modal, /ExportSettingsIcon/);
  assert.doesNotMatch(cssLayout, /\.settings-appearance-controls\s*>\s*:first-child/);
  assert.match(cssLayout, /\.settings-appearance-controls\s*>\s*\.settings-preference-row:first-child[^}]*border-top:\s*0/s);
  assert.match(cssLayout, /\[data-row-id="desktop-view"\]\s*\+\s*\.settings-preference-row[^}]*border-top:\s*0/s);
  assert.match(prefs, /data-row-id=\{id\}/);
  assert.match(cssA, /settings-panel-heading--secondary[^}]*border-top:\s*0/s);
  assert.match(prefs, /settings-theme-style-section/);
  assert.match(cssA, /settings-theme-style-section[^}]*border-top:\s*0/s);
  assert.match(contentCss, /html-local-first-warning-backdrop/);
  assert.match(rawGridCss, /\[data-theme-style="raw-grid"\]\s*\[role="switch"\]/);
  assert.match(rawGridCss, /\[data-theme-style="raw-grid"\]\s*\.settings-shortcut-toggle/);
  assert.match(rawGridCss, /\[data-theme-style="raw-grid"\]\s*\.toolbar-action-menu__switch/);
  assert.match(rawGridCss, /\[data-theme-style="raw-grid"\]\s*\.welcome-container[^}]*background:/s);
});

test('sidebar menu aligns to the three-dot button and shortcut labels use parentheses and uppercase keys', async () => {
  const [position, shortcuts, tips, welcome, welcomeHelpers] = await Promise.all([
    read('ui/src/components/Sidebar/sidebarItemMenuPosition.ts'),
    read('ui/src/utils/shortcuts.ts'),
    read('ui/src/components/Content/welcomeTipsContent.ts'),
    read('ui/src/components/Content/WelcomePage.tsx'),
    read('ui/src/components/Content/welcomePageHelpers.tsx'),
  ]);
  assert.match(position, /anchorRect\.right\s*-\s*menuWidth/);
  assert.doesNotMatch(position, /sidebarRect\.right\s*-\s*menuWidth/);
  assert.match(shortcuts, /NON_MODIFIER/);
  assert.match(shortcuts, /toUpperCase\(\)/);
  assert.doesNotMatch(tips, /\[[A-Za-z]*(?:\+[^\]]+)?\]/);
  assert.doesNotMatch(welcome, /<kbd>(?:Up|Down|Enter|Esc)<\/kbd>/);
  assert.match(welcomeHelpers, /formatShortcutLabel\(shortcutStr\)/);
});

test('examples, grouped tips, translations, and changelog cover the follow-up', async () => {
  const [fixture, tips, welcome, translations, changelog] = await Promise.all([
    read('test/test-code.md'),
    read('ui/src/components/Content/welcomeTipsContent.ts'),
    read('ui/src/components/Content/WelcomePage.tsx'),
    read('ui/src/contexts/translationsData.ts'),
    read('CHANGELOG.md'),
  ]);
  const htmlIndex = fixture.indexOf('## HTML (Isolated Sandbox Preview)');
  const csvIndex = fixture.indexOf('## CSV');
  const jsIndex = fixture.indexOf('## JavaScript');
  assert.ok(htmlIndex >= 0 && csvIndex > htmlIndex && jsIndex > csvIndex);
  for (const group of ['navigateAndOrganize', 'previewStructuredContent', 'workWithRichDocuments', 'personalizeMarkdownExplorer']) {
    assert.match(tips, new RegExp(group));
    assert.match(welcome, new RegExp(group));
  }
  for (const locale of locales) assert.match(translations, new RegExp(`\\b${locale}:\\s*\\{`));
  const welcomeTranslations = await read('ui/src/contexts/welcomeTranslations.ts');
  assert.doesNotMatch(welcomeTranslations, /global Default HTML Preview|both HTML code blocks/i);
  assert.doesNotMatch(welcomeTranslations, /Ctrl\+I/i);
  for (const key of [
    'htmlCodeBlockPreview', 'htmlCodeBlockPreviewDesc', 'htmlLocalFirstWarningTitle',
    'htmlLocalFirstWarningBody', 'htmlLocalFirstWarningOk', 'htmlLocalFirstBlockedRemoteStyles',
    'htmlLocalFirstBlockedRemoteScripts', 'htmlLocalFirstAllowedRemoteImages',
    'htmlLocalFirstAllowedRemoteFonts', 'htmlLocalFirstAllowedRemoteMedia',
    'htmlLocalFirstBlockedNetworkApis', 'htmlLocalFirstBlockedLocalReferences',
    'htmlLocalFirstMissingLocalReferences', 'resetShortcutsConfirmTitle', 'resetShortcutsConfirmBody',
    'cancelResetShortcuts', 'confirmResetShortcuts',
  ]) {
    assert.equal((translations.match(new RegExp(`${key}:`, 'g')) || []).length, locales.length, `${key} missing from a supported locale`);
  }
  assert.match(changelog, /HTML code block preview/i);
  assert.match(changelog, /local-first/i);
  assert.match(changelog, /Reset.*shortcut/i);
  assert.doesNotMatch(changelog, /Ctrl\s*\+\s*Alt\s*\+\s*H.*globally/i);
  assert.doesNotMatch(changelog, /describes both HTML code blocks and full HTML documents/i);
});

test('workspace-local resource readers resolve root-relative paths and keep file URLs inside the workspace', async () => {
  const [electron, vscode, tauri, web, chrome] = await Promise.all([
    read('electron/core/runtime-workspace-handlers.js'),
    read('vscode/src/core/panel.ts'),
    read('tauri/src/dispatcher/commands.rs'),
    read('website-app/src/web-host.ts'),
    read('chromium-xtension/src/chrome-host.ts'),
  ]);
  assert.match(electron, /reference\.startsWith\("\/"\)[\s\S]*pathApi\.resolve\(baseDir/);
  assert.doesNotMatch(electron, /reference\.startsWith\("\/"\)\s*&&\s*!pathApi\.isAbsolute/);
  assert.match(vscode, /reference\.startsWith\('\/'\)[\s\S]*path\.resolve\(workspaceRoot/);
  assert.doesNotMatch(vscode, /reference\.startsWith\('\/'\)\s*&&\s*!path\.isAbsolute/);
  assert.match(tauri, /Url::parse\(reference\)/);
  assert.match(tauri, /to_file_path\(\)/);
  assert.match(web, /reference\.startsWith\('\/'\)/);
  assert.match(chrome, /reference\.startsWith\('\/'\)/);
});

test('local-first HTML dialog is shown 1 time per file and experience banner is shown 1 time total per app opening session', async () => {
  const content = await read('ui/src/components/Content/Content.tsx');
  assert.match(content, /htmlPreviewWarningSeenRef\.current\.has\(state\.currentFile\)/);
  assert.match(content, /htmlPreviewWarningSeenRef\.current\.add\(state\.currentFile\)/);
  assert.doesNotMatch(content, /htmlPreviewWarningSeenRef\.current\.delete/);
  assert.match(content, /htmlPreviewExperienceNoticeSeenRef\.current/);
  assert.match(content, /if\s*\(htmlPreviewExperienceNoticeSeenRef\.current\)\s*return;/);
});
