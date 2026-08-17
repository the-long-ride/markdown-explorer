import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProjectSource } from './read-refactored-source.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = readProjectSource;

const locales = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'];

test('document tab menu has semantic icons, HTML actions, and containing-folder shortcut', async () => {
  const [menu, tabs, workspaceTabs, icons, styles] = await Promise.all([
    read('ui/src/components/shared/TabContextMenu.tsx'),
    read('ui/src/components/Content/ContentTabs.tsx'),
    read('ui/src/components/Desktop/DesktopTabBar.tsx'),
    read('ui/src/components/shared/icons.tsx'),
    read('ui/src/styles/global/global-tab-actions-menus.css'),
  ]);
  assert.match(menu, /TabContextMenuItem/);
  assert.match(menu, /tab-context-menu__item-icon/);
  assert.match(menu, /tab-context-menu__item-shortcut/);
  assert.match(tabs, /openInBrowser/);
  assert.match(tabs, /toggleHtmlDocumentView/);
  assert.match(tabs, /openCurrentDocumentLocation/);
  assert.match(tabs, /open-parent-directory/);
  assert.match(tabs, /previewActions(?:\?\.)?openError/);
  for (const prop of ['closeThisTabIcon', 'closeTabsToRightIcon', 'closeOtherTabsIcon', 'closeAllTabsIcon']) {
    assert.match(workspaceTabs, new RegExp(`${prop}=`), `${prop} missing from workspace menu`);
  }
  for (const icon of ['InternetIcon', 'CloseTabIcon', 'CloseRightIcon', 'CloseOthersIcon', 'CloseAllIcon', 'HtmlPreviewIcon', 'MarkdownViewIcon']) {
    assert.match(icons, new RegExp(`export const ${icon}`));
  }
  assert.doesNotMatch(styles, /\.tab-context-menu__item\s*\{[^}]*margin:/s);
  assert.match(styles, /\.tab-context-menu\s*\{[^}]*gap:/s);
});

test('sidebar file tree uses hover three-dot actions and anchored right-aligned menus', async () => {
  const [tree, menu, position, styles] = await Promise.all([
    read('ui/src/components/Sidebar/TreeNode.tsx'),
    read('ui/src/components/Sidebar/SidebarItemMenu.tsx'),
    read('ui/src/components/Sidebar/sidebarItemMenuPosition.ts'),
    read('ui/src/styles/global/global-sidebar-search-menus.css'),
  ]);
  assert.match(tree, /MoreVerticalIcon/);
  assert.match(tree, /sidebar-tree-item__menu-button/);
  assert.match(tree, /onContextMenu=/);
  assert.match(menu, /anchor\.getBoundingClientRect/);
  assert.match(menu, /sidebar\.getBoundingClientRect/);
  assert.match(position, /placement:\s*'below'\s*\|\s*'above'/);
  assert.match(position, /anchorRect\.right\s*-\s*menuWidth/);
  assert.match(styles, /sidebar-tree-item__menu-button/);
  assert.match(menu, /autoFocus/);
});

test('HTML documents support isolated preview, shared markdown conversion, per-tab overrides, and active-tab shortcut', async () => {
  const [types, state, reducer, view, content, keyboard, constants, tabs] = await Promise.all([
    read('ui/src/types.ts'),
    read('ui/src/contexts/contentTabState.ts'),
    read('ui/src/contexts/appStateReducer.ts'),
    read('ui/src/components/Content/HtmlDocumentView.tsx'),
    read('ui/src/components/Content/Content.tsx'),
    read('ui/src/hooks/keyboardUtils.ts'),
    read('ui/src/contexts/appStateConstants.ts'),
    read('ui/src/components/Content/ContentTabs.tsx'),
  ]);
  assert.match(types, /sourceDocumentText/);
  assert.match(types, /htmlPreviewOverride/);
  assert.match(state, /htmlPreviewOverride/);
  assert.match(state, /sourceDocumentText:\s*tab\.sourceDocumentText\s*\?\?\s*null/);
  assert.match(reducer, /SET_CONTENT_TAB_HTML_PREVIEW/);
  assert.match(view, /sandbox="allow-scripts allow-forms"/);
  assert.doesNotMatch(view, /allow-same-origin/);
  assert.match(view, /srcDoc/);
  assert.match(view, /markdownHtml/);
  assert.match(content, /hasRenderableDocumentContent/);
  assert.match(keyboard, /toggle-active-html-document-preview/);
  assert.match(constants, /toggleHtmlPreview:\s*'Ctrl\+Alt\+H'/);
  assert.match(tabs, /htmlPreviewOverride/);
});

test('raw HTML p div and span image groups become same-row image layouts', async () => {
  const [helper, effects, css] = await Promise.all([
    read('ui/src/markdown/rawHtmlImageRows.ts'),
    read('ui/src/components/Content/scheduleContentEnhancements.ts'),
    read('ui/src/styles/global/global-markdown-foundation.css'),
  ]);
  assert.match(helper, /p, div, span/);
  assert.match(helper, /mdn-image-row--html/);
  assert.match(helper, /HTMLImageElement/);
  assert.match(effects, /enhanceRawHtmlImageRows/);
  assert.match(css, /\.mdn-image-row--html/);
  assert.match(css, /flex-wrap:\s*wrap/);
});

test('Settings use compact grouping, Language icon, dynamic shortcut descriptions, and measured tooltip centering', async () => {
  const [panel, modal, tooltip, icons, styles] = await Promise.all([
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/components/Settings/SettingsModal.tsx'),
    read('ui/src/components/Settings/PreferenceDescriptionTooltip.tsx'),
    read('ui/src/components/shared/icons.tsx'),
    read('ui/src/styles/global/global-settings-layout.css'),
  ]);
  assert.match(panel, /settings-appearance-controls/);
  assert.match(panel, /toggleDesktopViewMode/);
  assert.match(panel, /toggleHtmlPreview/);
  assert.match(modal, /LanguageIcon/);
  assert.match(icons, /export const LanguageIcon/);
  assert.match(tooltip, /ResizeObserver/);
  assert.match(tooltip, /tooltipRef/);
  assert.match(tooltip, /rect\.top - tooltipHeight/);
  assert.match(styles, /\.settings-appearance-controls/);
});

test('header controls use More-actions styling and crumb separators', async () => {
  const [tabbar, topbar] = await Promise.all([
    read('ui/src/components/Desktop/DesktopTabBar.tsx'),
    read('ui/src/components/Topbar/Topbar.tsx'),
  ]);
  assert.match(tabbar, /className="[^"]*topbar__new-workspace-btn[^"]*topbar__action-btn[^"]*"/);
  assert.doesNotMatch(tabbar, /data-shared-style=/);
  assert.doesNotMatch(tabbar, /<div className="topbar__divider"/);
  assert.doesNotMatch(topbar, /<div className="topbar__divider"/);
  assert.match(tabbar, /topbar__crumb-separator/);
  assert.match(topbar, /topbar__crumb-separator/);
});

test('all supported locales expose HTML menus, sidebar actions, renamed preview setting, and new tips', async () => {
  const [translations, welcome] = await Promise.all([
    read('ui/src/contexts/translationsData.ts'),
    read('ui/src/contexts/welcomeTranslations.ts'),
  ]);
  for (const locale of locales) {
    assert.match(translations, new RegExp(`\\b${locale}:\\s*\\{`));
    assert.match(welcome, new RegExp(`\\b${locale}:\\s*\\{`));
  }
  for (const key of [
    'openInBrowser', 'showHtmlPreview', 'showMarkdownView', 'openContainingFolder',
    'sidebarItemActions', 'htmlPreviewEnabled', 'htmlPreviewDisabled', 'htmlDocumentPreviewError',
  ]) {
    assert.match(translations, new RegExp(`${key}:`), `${key} missing`);
  }
  for (const key of [
    'tipToggleDesktopView', 'tipToggleHtmlPreview', 'tipOpenContainingFolder',
    'tipSidebarActions', 'tipCsvPreview', 'tipHtmlDocuments', 'tipOpenHtmlBrowser',
    'tipImageRows', 'tipWorkspaceRecovery',
  ]) {
    assert.match(welcome, new RegExp(`${key}:`), `${key} missing`);
  }
});

test('Snake sandbox and Unreleased changelog cover the patch series', async () => {
  const [fixture, changelog] = await Promise.all([
    read('manual-tests/test-code.md'),
    read('CHANGELOG.md'),
  ]);
  assert.match(fixture, /<canvas[^>]+id="snake/);
  assert.match(fixture, />Start</);
  assert.match(fixture, />Pause</);
  assert.match(fixture, />Restart</);
  assert.match(fixture, /ArrowUp|KeyW/);
  assert.match(fixture, /requestAnimationFrame|setInterval/);
  const unreleased = changelog.split(/^## /m)[1] ?? '';
  assert.match(unreleased, /### Added/);
  assert.match(unreleased, /### Changed/);
  assert.match(unreleased, /### Fixed/);
  assert.match(unreleased, /Reading Progress/i);
  assert.match(unreleased, /onboarding/i);
  assert.match(unreleased, /chart/i);
  assert.match(unreleased, /pin/i);
});

test('raw HTML source survives every host and desktop workspace-tab cache path', async () => {
  const [chromeHost, webFileMode, desktopTypes, snapshot, desktopTabs] = await Promise.all([
    read('chromium-xtension/src/chrome-host.ts'),
    read('website-app/src/web-file-mode.ts'),
    read('ui/src/desktop/types.ts'),
    read('ui/src/desktop/desktopTabSnapshot.ts'),
    read('ui/src/hooks/useDesktopTabs.ts'),
  ]);
  assert.match(chromeHost, /sourceDocumentText/);
  assert.match(webFileMode, /sourceDocumentText/g);
  assert.match(desktopTypes, /sourceDocumentText\?:\s*string\s*\|\s*null/);
  assert.match(snapshot, /sourceDocumentText:\s*state\.sourceDocumentText/);
  assert.match(desktopTabs, /sourceDocumentText:\s*tab\.sourceDocumentText/);
});

test('new production helpers are registered in the coverage manifest', async () => {
  const manifest = await read('tests/manifest/coverage-manifest.ts');
  for (const sourcePath of [
    'electron/core/html-preview-server.js',
    'ui/src/components/Content/HtmlDocumentView.tsx',
    'ui/src/components/Content/contentTabCloseEvents.ts',
    'ui/src/components/Modal/HtmlPreviewModal.tsx',
    'ui/src/components/Settings/PreferenceDescriptionTooltip.tsx',
    'ui/src/components/Sidebar/SidebarItemMenu.tsx',
    'ui/src/components/Sidebar/sidebarItemMenuPosition.ts',
    'ui/src/components/shared/HeaderActionGroups.tsx',
    'ui/src/components/shared/LinkContextMenu.tsx',
    'ui/src/desktop/shellLocation.ts',
    'ui/src/desktop/workspaceOperations.ts',
    'ui/src/dom/htmlPreviewActions.ts',
    'ui/src/dom/linkContextMenu.ts',
    'ui/src/dom/localFileBrowserSupport.ts',
    'ui/src/dom/localFileUrl.ts',
    'ui/src/markdown/delimitedText.ts',
    'ui/src/markdown/htmlPreviewDocument.ts',
    'ui/src/markdown/rawHtmlImageRows.ts',
    'ui/src/markdown/tableRenderer.ts',
    'vscode/src/core/htmlPreviewServer.ts',
    'vscode/src/markdown/delimitedText.ts',
    'vscode/src/markdown/htmlPreviewDocument.ts',
    'vscode/src/markdown/tableRenderer.ts',
  ]) {
    assert.match(manifest, new RegExp(sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
