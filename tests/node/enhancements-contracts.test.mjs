import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readProjectSource } from './read-refactored-source.mjs';

const read = readProjectSource;

test('CSV code blocks expose interactive preview and code modes with localized actions', async () => {
  const source = await read('ui/src/markdown/codeRenderer.ts');
  assert.match(source, /parseDelimitedText/);
  assert.match(source, /mdn-csv-preview-wrap/);
  assert.match(source, /UI\.toggleCsvMode\(this\)/);
  assert.match(source, /dataI18nKey:\s*showCodeByDefault \? 'showPreview' : 'showCode'/);
  assert.match(source, /dataI18nKey:\s*'copyCode'/);
  assert.match(source, /const previewLabel = `\$\{language\} Preview`/);
});

test('HTML and CSV default preview preferences are independent and default on', async () => {
  const [types, model, effects, settings, renderer] = await Promise.all([
    read('ui/src/themeTypes.ts'),
    read('ui/src/contexts/appStateModel.ts'),
    read('ui/src/contexts/useAppStateEffects.ts'),
    read('ui/src/settings/settingsImportExport.ts'),
    read('ui/src/markdown/renderer.ts'),
  ]);
  assert.match(types, /defaultCsvPreview:\s*boolean/);
  assert.match(types, /defaultCsvPreview\?:\s*boolean/);
  assert.match(model, /defaultCsvPreview:\s*true/);
  assert.match(effects, /defaultCsvPreview:\s*saved\.defaultCsvPreview\s*!==\s*false/);
  assert.match(settings, /defaultCsvPreview:\s*raw\.defaultCsvPreview\s*!==\s*false/);
  assert.match(renderer, /defaultCsvPreview/);
});

test('all supported languages include every new user-facing enhancement label', async () => {
  const [types, data] = await Promise.all([
    read('ui/src/contexts/translations.ts'),
    read('ui/src/contexts/translationsData.ts'),
  ]);
  for (const key of [
    'csvPreview', 'csvPreviewDesc', 'importJson', 'exportJson',
    'importJsonTooltip', 'exportJsonTooltip', 'plainText', 'csvPreviewTitle',
    'tsvPreviewTitle', 'csvMalformedQuote', 'csvUnevenRows', 'workspaceUnavailable',
    'settingsData',
  ]) {
    assert.ok(types.includes(key), `translation interface missing ${key}`);
  }
  for (const key of [
    'csvPreview:', 'csvPreviewDesc:', 'importJson:', 'exportJson:', 'importJsonTooltip:',
    'exportJsonTooltip:', 'plainText:', 'csvPreviewTitle:', 'tsvPreviewTitle:',
    'csvMalformedQuote:', 'csvUnevenRows:', 'settingsData:', 'groupLabel:', 'invalidJson:',
    'missingData:', 'wrongFile:', 'unknownSchema:',
  ]) {
    assert.equal(data.match(new RegExp(key, 'g'))?.length ?? 0, 9, `${key} must exist in all 9 languages`);
  }
  assert.equal(data.match(/workspaceUnavailable:\s*\{/g)?.length ?? 0, 9);
  assert.equal(data.match(/settingsData:\s*\{/g)?.length ?? 0, 9);
});

test('workspace unavailable screen uses translations and the tab-scoped reopen callback', async () => {
  const content = await read('ui/src/components/Content/Content.tsx');
  assert.doesNotMatch(content, />Workspace not found</);
  assert.match(content, /t\.workspaceUnavailable\.title/);
  assert.match(content, /onOpenWorkspaceAgain\(workspaceUnavailablePath\)/);
});

test('workspace recovery removes the old recent entry only after a replacement opens', async () => {
  const [hook, electron, website, chromium, tauri] = await Promise.all([
    read('ui/src/hooks/useDesktopTabs.ts'),
    read('electron/core/runtime-command-handlers.js'),
    read('website-app/src/web-host.ts'),
    read('chromium-xtension/src/chrome-host.ts'),
    read('tauri/src/dispatcher/commands.rs'),
  ]);
  assert.match(hook, /pendingWorkspaceReplacementRef/);
  assert.match(hook, /workspaceOpenCancelled/);
  assert.match(hook, /pendingWorkspaceReplacementRef\.current = null/);
  for (const [name, source] of Object.entries({ electron, website, chromium, tauri })) {
    assert.ok(source.includes('replaceRecentWorkspacePath'), `${name} replacement path support missing`);
    assert.ok(source.includes('workspaceOpenCancelled'), `${name} picker-cancel message missing`);
    assert.ok(
      source.includes('clearWorkspaceOperation') || source.includes('workspaceOperation.clear()') || source.includes('workspace_operation_id = None') || source.includes('state.workspaceOperationId = null'),
      `${name} picker cancellation must clear stale operation state`,
    );
  }
});

test('HTML comments have no rail, use an inset treatment, and preserve Properties width', async () => {
  const css = await read('ui/src/styles/global/global-markdown-foundation.css');
  const block = css.match(/\.mdn-html-comment\s*\{([^}]*)\}/s)?.[1] ?? '';
  const frontmatter = css.match(/\.mdn-frontmatter\s*\{([^}]*)\}/s)?.[1] ?? '';
  assert.doesNotMatch(block, /border-left\s*:/);
  assert.match(block, /box-shadow:\s*[\s\S]*inset/);
  assert.match(block, /box-sizing:\s*border-box/);
  assert.match(block, /width:\s*100%/);
  assert.match(frontmatter, /box-sizing:\s*border-box/);
  assert.match(frontmatter, /width:\s*100%/);
});

test('headings render hover/focus level labels without visible hash anchors', async () => {
  const [renderer, css] = await Promise.all([
    read('ui/src/markdown/renderer.ts'),
    read('ui/src/styles/global/global-markdown-foundation.css'),
  ]);
  assert.doesNotMatch(renderer, /class="mdn-anchor"[^>]*>#<\/a>/);
  assert.match(renderer, /mdn-heading-level/);
  assert.match(css, /\.mdn-heading-level/);
  assert.match(css, /:focus-within/);
});

test('XML fragments are highlighted structurally without requiring a declaration', async () => {
  const source = await read('ui/src/markdown/highlighter.ts');
  assert.match(source, /xml/);
  assert.match(source, /xhtml/);
  assert.match(source, /svg/);
});

test('View Preferences descriptions are hover or focus panels while Theme Style remains inline', async () => {
  const [component, tooltip, css] = await Promise.all([
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/components/Settings/PreferenceDescriptionTooltip.tsx'),
    read('ui/src/styles/global/global-settings-layout.css'),
  ]);
  assert.match(component, /settings-preference-row/);
  assert.match(component, /PreferenceDescriptionTooltip/);
  assert.match(tooltip, /settings-preference-description-panel/);
  assert.match(tooltip, /createPortal/);
  assert.match(component, /t\.csvPreview/);
  assert.match(css, /\.settings-preference-description-panel/);
  assert.match(component, /onMouseEnter/);
  assert.match(component, /onFocus/);
  assert.match(component, /t\.themeStyleDesc/);
});

test('settings JSON actions use shared tooltips and localized labels', async () => {
  const modal = await read('ui/src/components/Settings/SettingsModal.tsx');
  assert.match(modal, /TooltipButton[\s\S]*t\.importJsonTooltip/);
  assert.match(modal, /TooltipButton[\s\S]*t\.exportJsonTooltip/);
  assert.match(modal, /t\.importJson/);
  assert.match(modal, /t\.exportJson/);
});

test('dragged workspace and content tabs use dashed primary borders', async () => {
  const [desktopCss, contentCss] = await Promise.all([
    read('ui/src/styles/global/global-topbar-tabs.css'),
    read('ui/src/styles/global/global-content-tabs-focus-search.css'),
  ]);
  for (const [name, css] of Object.entries({ desktopCss, contentCss })) {
    assert.match(css, /is-dragging/);
    assert.match(css, /border-style:\s*dashed/);
    assert.match(css, /var\(--accent\)|var\(--primary/);
  }
});

test('navigation and document actions use the shared compact focus-mode button treatment', async () => {
  const [topbar, desktopTabbar, shared] = await Promise.all([
    read('ui/src/components/Topbar/Topbar.tsx'),
    read('ui/src/components/Desktop/DesktopTabBar.tsx'),
    read('ui/src/components/shared/HeaderActionGroups.tsx'),
  ]);
  for (const action of ['onClick={onBack}', 'onClick={onForward}', 'onClick={onRefresh}', 'onClick={onExpandAll}', 'onClick={onCollapseAll}', 'onCopyFile']) {
    assert.ok(shared.includes(action), `${action} action missing from shared header actions`);
  }
  const compactButtons = shared.match(/className="btn btn--icon"/g)?.length ?? 0;
  assert.ok(compactButtons >= 6, 'expected compact buttons for navigation and document actions');
  assert.match(topbar, /NavigationHeaderActions/);
  assert.match(topbar, /DocumentHeaderActions/);
  assert.match(desktopTabbar, /NavigationHeaderActions/);
  assert.match(desktopTabbar, /DocumentHeaderActions/);
});

test('sample documents include external links and a 20-row CSV download fixture', async () => {
  const [navigation, code] = await Promise.all([
    read('manual-tests/test-navigation.md'),
    read('manual-tests/test-code.md'),
  ]);
  assert.match(navigation, /https:\/\/github\.com\/the-long-ride\/markdown-explorer/);
  assert.match(navigation, /https:\/\/the-long-ride\.github\.io\/markdown-explorer\//);
  const csv = code.match(/```csv\s*\n([\s\S]*?)```/)?.[1] ?? '';
  assert.ok(csv.trim().split(/\r?\n/).length >= 21, 'CSV fixture needs a header plus 20 rows');
});

test('resetting to an empty workspace clears scan progress immediately', async () => {
  const hook = await read('ui/src/hooks/useDesktopTabs.ts');
  const resetHelper = hook.match(/const dispatchEmptyWorkspace = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[dispatch/)?.[1] ?? '';
  assert.match(resetHelper, /type:\s*'WORKSPACE_SCAN_PROGRESS'/);
  assert.match(resetHelper, /active:\s*false/);
});

test('browser workspace replacement rechecks operation ownership after removing the old recent entry', async () => {
  const [website, chromium] = await Promise.all([
    read('website-app/src/web-host.ts'),
    read('chromium-xtension/src/chrome-host.ts'),
  ]);
  for (const [name, source] of Object.entries({ website, chromium })) {
    const replacement = source.match(/if \(msg\.replaceRecentWorkspacePath[\s\S]*?BrowserRecentWorkspaces\.remove\(msg\.replaceRecentWorkspacePath\);([\s\S]*?)(?:activeHandle = handle|await loadHandleWorkspace\(handle)/)?.[1] ?? '';
    assert.match(
      replacement,
      /(?:isWorkspaceOperationCurrent\(operation\)|workspaceOperation\.isCurrent\(operation\))/,
      `${name} must reject a stale replacement operation after the async recent-workspace removal`,
    );
  }
});

test('CSV preview does not clip interactive table menus', async () => {
  const css = await read('ui/src/styles/global/global-code-blocks.css');
  const block = css.match(/\.mdn-csv-preview-body\s*\{([^}]*)\}/s)?.[1] ?? '';
  assert.match(block, /overflow:\s*visible/);
});
