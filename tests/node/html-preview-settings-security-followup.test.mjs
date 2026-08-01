import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProjectSource } from './read-refactored-source.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = readProjectSource;
const locales = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'];

test('left and right arrow shortcuts use glyph labels', async () => {
  const source = await read('ui/src/utils/shortcuts.ts');
  assert.match(source, /arrowleft:\s*['"]←['"]/i);
  assert.match(source, /arrowright:\s*['"]→['"]/i);
});

test('HTML preview occupies the remaining content viewport and shows a five-second experience banner', async () => {
  const [content, layout, globalCss] = await Promise.all([
    read('ui/src/components/Content/Content.tsx'),
    read('ui/src/styles/global/global-content-layout.css'),
    read('ui/src/styles/global.css'),
  ]);
  assert.match(content, /content__scroll--html-preview/);
  assert.match(content, /mdn-body--html-preview/);
  assert.match(content, /html-preview-experience-banner/);
  assert.match(content, /5_000|5000/);
  assert.match(content, /htmlPreviewExperienceNotice/);
  assert.match(layout + globalCss, /\.content__scroll--html-preview[\s\S]*overflow:\s*hidden/);
  assert.match(layout + globalCss, /\.mdn-body--html-preview[\s\S]*max-width:\s*none/);
  assert.match(layout + globalCss, /\.html-document-view__iframe[\s\S]*flex:\s*1/);
  assert.match(layout + globalCss, /\.html-document-view__iframe[\s\S]*height:\s*100%/);
});

test('HTML files expose browser and preview actions in the Files sidebar menu', async () => {
  const [sidebar, menu, tree] = await Promise.all([
    read('ui/src/components/Sidebar/Sidebar.tsx'),
    read('ui/src/components/Sidebar/SidebarItemMenu.tsx'),
    read('ui/src/components/Sidebar/TreeNode.tsx'),
  ]);
  assert.match(menu, /SidebarItemMenuItem/);
  assert.match(menu, /items\.map/);
  assert.match(sidebar, /openLocalFileInBrowser/);
  assert.match(sidebar, /supportsLocalFileBrowserOpen/);
  assert.match(sidebar, /isHtmlDocumentPath/);
  assert.match(sidebar, /HtmlPreviewIcon/);
  assert.match(sidebar, /MarkdownViewIcon/);
  assert.match(sidebar, /t\.openInBrowser/);
  assert.match(sidebar, /t\.showHtmlPreview/);
  assert.match(sidebar, /t\.showMarkdownView/);
  assert.match(tree, /canRequestItemMenu/);
});

test('HTML preview navigation intent survives loading an unopened file', async () => {
  const [context, effects, model, reducer, tabs] = await Promise.all([
    read('ui/src/contexts/AppStateContext.tsx'),
    read('ui/src/contexts/useAppStateEffects.ts'),
    read('ui/src/contexts/appStateModel.ts'),
    read('ui/src/contexts/appStateReducer.ts'),
    read('ui/src/contexts/contentTabState.ts'),
  ]);
  assert.match(context, /htmlPreviewOverride/);
  assert.match(context, /pendingHtmlPreview/);
  assert.match(effects, /pendingHtmlPreview/);
  assert.match(model, /currentHtmlPreviewOverride/);
  assert.match(reducer, /currentHtmlPreviewOverride/);
  assert.match(tabs, /currentHtmlPreviewOverride/);
});

test('settings and close-all actions use the supplied theme-aware SVG artwork', async () => {
  const icons = await read('ui/src/components/shared/icons.tsx');
  assert.match(icons, /export const CloseAllIcon[\s\S]*viewBox="0 0 122\.88 120\.79"/);
  assert.match(icons, /export const CloseAllIcon[\s\S]*M31\.4,21\.63H92\.08V7\.68/);
  assert.match(icons, /export const ImportSettingsIcon[\s\S]*viewBox="0 0 512 437\.242"/);
  assert.match(icons, /export const ImportSettingsIcon[\s\S]*M\.723 313\.756/);
  const relevant = icons.match(/export const CloseAllIcon[\s\S]*?export const ImportSettingsIcon[\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(relevant, /currentColor/);
});

test('reset shortcut confirmation uses theme styling instead of a bright hard-coded red', async () => {
  const css = await read('ui/src/styles/global/global-settings-actions-dialogs.css');
  const block = css.match(/\.settings-reset-shortcuts-confirm\s*\{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(block, /var\(--/);
  assert.doesNotMatch(block, /#dc2626/i);
});

test('all locales include the HTML experience notice and dash-formatted close-settings tooltip', async () => {
  const [types, data] = await Promise.all([
    read('ui/src/contexts/translations.ts'),
    read('ui/src/contexts/translationsData.ts'),
  ]);
  assert.match(types, /htmlPreviewExperienceNotice:\s*string/);
  assert.equal(data.match(/htmlPreviewExperienceNotice:/g)?.length ?? 0, locales.length);
  assert.equal(data.match(/closeSettings:\s*["'][^"']+\s-\s\(Esc\)["']/g)?.length ?? 0, locales.length);
  assert.match(data, /closeSettings:\s*"Close Settings - \(Esc\)"/);
});

test('reported vulnerable transitive dependencies are overridden from the pnpm workspace', async () => {
  const [manifest, workspace, lock] = await Promise.all([
    read('package.json'),
    read('pnpm-workspace.yaml'),
    read('pnpm-lock.yaml'),
  ]);

  assert.doesNotMatch(manifest, /"pnpm"\s*:\s*\{[\s\S]*?"overrides"/);
  assert.match(workspace, /overrides:[\s\S]*dompurify:\s*3\.4\.12/);
  assert.match(workspace, /overrides:[\s\S]*fast-uri:\s*3\.1\.4/);
  assert.match(workspace, /overrides:[\s\S]*fast-xml-parser:\s*5\.10\.1/);

  assert.match(lock, /^overrides:\s*$/m);
  assert.match(lock, /dompurify:\s*3\.4\.12/);
  assert.match(lock, /fast-uri:\s*3\.1\.4/);
  assert.match(lock, /fast-xml-parser:\s*5\.10\.1/);
  assert.match(lock, /dompurify@3\.4\.12/);
  assert.match(lock, /fast-uri@3\.1\.4/);
  assert.match(lock, /fast-xml-parser@5\.10\.1/);
  assert.doesNotMatch(lock, /dompurify@3\.4\.11/);
  assert.doesNotMatch(lock, /fast-uri@3\.1\.3/);
  assert.doesNotMatch(lock, /fast-xml-parser@5\.9\.3/);
});
