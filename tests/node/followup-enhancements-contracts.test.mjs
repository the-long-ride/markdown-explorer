import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProjectSource } from './read-refactored-source.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = readProjectSource;

test('test-code fixture covers XML declaration, XML fragment, and headerless CSV', async () => {
  const source = await read('manual-tests/test-code.md');
  assert.match(source, /```xml\s*\n<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(source, /```xml\s*\n<catalog[\s>]/);
  assert.match(source, /```csv noheader\s*\nDesktop,1250,true/);
});

test('frontmatter extraction accepts only leading HTML-comment preambles', async () => {
  const parser = await read('ui/src/markdown/parser.ts');
  assert.match(parser, /scanFrontmatterPreamble|findFrontmatterStartAfterComments/);
  assert.match(parser, /<!--/);
  assert.match(parser, /-->/);
});

test('CSV source mode decorates field text with four repeating column classes', async () => {
  const [delimited, renderer, css] = await Promise.all([
    read('ui/src/markdown/delimitedText.ts'),
    read('ui/src/markdown/codeRenderer.ts'),
    read('ui/src/styles/global/global-code-blocks.css'),
  ]);
  assert.match(delimited, /tokenizeDelimitedSource/);
  assert.match(renderer, /code-delimited-column--\$\{segment\.columnIndex % 4\}/);
  for (let index = 0; index < 4; index += 1) {
    assert.match(css, new RegExp(`--csv-column-${index + 1}:`));
    assert.match(css, new RegExp(`\\.code-delimited-column--${index}`));
  }
  assert.match(css, /\[data-theme="dark"\]/);
});

test('Markdown image-only paragraphs render as equal-width rows and heading badges sit to the right', async () => {
  const [renderer, css] = await Promise.all([
    read('ui/src/markdown/renderer.ts'),
    read('ui/src/styles/global/global-markdown-foundation.css'),
  ]);
  assert.match(renderer, /renderImageRowParagraph/);
  assert.match(renderer, /mdn-image-row/);
  assert.match(renderer, /mdn-heading-level/);
  assert.match(css, /\.mdn-image-row/);
  assert.match(css, /--mdn-image-count/);
  const headingBlock = css.match(/\.mdn-heading-level\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.match(headingBlock, /left:\s*calc\(100% \+ 8px\)/);
  assert.match(headingBlock, /aspect-ratio:\s*1/);
});

test('Settings Appearance uses one scroll owner and preference tooltips render through a portal', async () => {
  const [panel, tooltip, modal, navigationCss, layoutCss] = await Promise.all([
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/components/Settings/PreferenceDescriptionTooltip.tsx'),
    read('ui/src/components/Settings/SettingsModal.tsx'),
    read('ui/src/styles/global/global-settings-navigation.css'),
    read('ui/src/styles/global/global-settings-layout.css'),
  ]);
  const css = `${navigationCss}
${layoutCss}`;
  assert.match(panel, /PreferenceDescriptionTooltip/);
  assert.match(tooltip, /createPortal/);
  assert.match(modal, /settings-navigation__content/);
  assert.match(css, /\.settings-navigation__content/);
  assert.match(css, /overflow:\s*auto/);
  assert.match(css, /\.settings-preference-row[\s\S]*align-items:\s*center/);
  assert.match(css, /--settings-tooltip-opacity:\s*0\.(?:9[2-9]|[1-9]\d)/);
});

test('Tabs view places navigation before workspace tabs and document actions before More actions', async () => {
  const [tabbar, appView] = await Promise.all([
    read('ui/src/components/Desktop/DesktopTabBar.tsx'),
    read('ui/src/AppView.tsx'),
  ]);
  const navigationIndex = tabbar.indexOf('<NavigationHeaderActions');
  const tablistIndex = tabbar.indexOf('role="tablist"');
  const documentActionsIndex = tabbar.indexOf('<DocumentHeaderActions');
  const moreActionsIndex = tabbar.indexOf('<ToolbarActionMenu');
  assert.ok(navigationIndex >= 0 && navigationIndex < tablistIndex);
  assert.ok(documentActionsIndex >= 0 && documentActionsIndex < moreActionsIndex);
});

test('desktop shell-location command supports directory, reveal-file, and parent-directory modes', async () => {
  const [types, electron, tauri] = await Promise.all([
    read('ui/src/types.ts'),
    read('electron/core/ipc-handlers.js'),
    read('tauri/src/dispatcher/commands.rs'),
  ]);
  for (const mode of ['open-directory', 'reveal-file', 'open-parent-directory']) {
    assert.ok(types.includes(`'${mode}'`), `${mode} missing from UI command types`);
    assert.ok(electron.includes(mode), `${mode} missing from Electron`);
    assert.ok(tauri.includes(mode), `${mode} missing from Tauri`);
  }
  assert.match(electron, /showItemInFolder/);
  assert.match(electron, /shell\.openPath/);
});

test('desktop context menus and shortcut expose localized file-manager actions', async () => {
  const [menu, shortcuts, translations, data] = await Promise.all([
    read('ui/src/components/shared/TabContextMenu.tsx'),
    read('ui/src/contexts/appStateConstants.ts'),
    read('ui/src/contexts/translations.ts'),
    read('ui/src/contexts/translationsData.ts'),
  ]);
  assert.match(menu, /openLocation/);
  assert.match(shortcuts, /openCurrentDocumentLocation/);
  assert.match(shortcuts, /Shift\+Alt\+R/);
  for (const key of ['showInFileExplorer', 'openInFinder', 'revealInFinder', 'showInFileManager', 'openCurrentDocumentLocation']) {
    assert.ok(translations.includes(key), `${key} missing from translation interface`);
    assert.ok(data.includes(key), `${key} missing from translation data`);
  }
});

test('pet theme rail-markers directory assets and shortcut label font-weight styles are present', async () => {
  const [petTokens, catPaw, kInkPaw, settingsCss] = await Promise.all([
    read('ui/src/styles/tokens/tokens-pet-themes.css'),
    read('ui/src/assets/themes/pets/rail-markers/cat-paw.svg'),
    read('ui/src/assets/themes/pets/rail-markers/k-ink-paw.svg'),
    read('ui/src/styles/global/global-settings-layout.css'),
  ]);
  assert.match(petTokens, /rail-markers\/cat-paw\.svg/);
  assert.match(petTokens, /rail-markers\/corgi-paw\.svg/);
  assert.match(catPaw, /aria-label="Cat paw"/);
  assert.match(catPaw, /fill="#e2e8f0"/); // Retractable claws
  assert.match(kInkPaw, /aria-label="K-Ink wolf paw"/);
  assert.match(kInkPaw, /L 4\.5 7\.2/); // Shorter claw tips
  assert.match(settingsCss, /\.settings-shortcut-label[\s\S]*?font-weight:\s*600;/);
});
