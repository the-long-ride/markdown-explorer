import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const exists = (path) => access(new URL(path, root)).then(() => true, () => false);

test('app state owns desktop font catalog and applies host results', async () => {
  const [model, reducer, effects] = await Promise.all([
    read('ui/src/contexts/appStateModel.ts'),
    read('ui/src/contexts/appStateReducer.ts'),
    read('ui/src/contexts/useAppStateEffects.ts'),
  ]);
  assert.match(model, /desktopFonts:\s*(?:readonly\s+)?DesktopFontFamily\[\]/);
  assert.match(model, /desktopFontError:/);
  assert.match(model, /desktopFontsResult:/);
  assert.match(reducer, /case 'SET_DESKTOP_FONTS'/);
  assert.match(effects, /case 'desktopFontsResult'/);
  assert.match(effects, /requestId:\s*msg\.requestId/);
  assert.match(effects, /importedId:\s*msg\.importedId/);
  assert.match(effects, /command: 'listDesktopFonts'/);
  assert.match(effects, /applyDesktopTypography/);
});

test('desktop typography renders five independent role bindings with searchable font and variant controls', async () => {
  assert.equal(await exists('ui/src/components/Settings/FontSearchDropdown.tsx'), true);
  assert.equal(await exists('ui/src/components/Settings/FontVariantDropdown.tsx'), true);
  const [panel, component, search, variant] = await Promise.all([
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/components/Settings/DesktopTypographySettings.tsx'),
    read('ui/src/components/Settings/FontSearchDropdown.tsx'),
    read('ui/src/components/Settings/FontVariantDropdown.tsx'),
  ]);
  assert.match(panel, /isDesktop\s*&&[\s\S]*<DesktopTypographySettings/);
  for (const role of ['appUi', 'body', 'heading', 'quote', 'code']) assert.match(component, new RegExp(`role=["']${role}["']`));
  assert.match(component, /importDesktopFonts/);
  assert.match(component, /removeImportedDesktopFont/);
  assert.match(component, /RefreshIcon/);
  assert.match(component, /tooltip=\{t\.fontResetRole\}/);
  assert.match(component, /pendingImport/);
  assert.match(component, /desktopFontsResult/);
  assert.match(component, /importedId/);
  assert.match(component, /onImport=\{\(\) => importFont\('appUi'\)\}/);
  assert.match(search, /type=["']search["']/);
  assert.match(search, /fontSystem/);
  assert.match(search, /fontImported/);
  assert.match(search, /createPortal/);
  assert.match(variant, /getDesktopFontVariantOptions/);
  assert.doesNotMatch(variant, /<select/);
  assert.match(variant, /createPortal/);
  assert.match(variant, /role="listbox"/);
  assert.match(variant, /ArrowDown/);
  assert.match(variant, /ArrowUp/);
  assert.match(variant, /Escape/);
  assert.match(variant, /ChevronDownIcon/);
});

test('desktop typography applier uses only host-approved local URLs', async () => {
  const source = await read('ui/src/desktop/fonts/applyDesktopTypography.ts');
  assert.match(source, /--font-ui/);
  assert.match(source, /--font-body/);
  assert.match(source, /--font-heading/);
  assert.match(source, /--font-quote/);
  assert.match(source, /--font-mono/);
  assert.match(source, /local-file:/);
  assert.match(source, /file:/);
  assert.match(source, /@font-face/);
  assert.match(source, /doc\.body/);
  assert.doesNotMatch(source, /sourcePath/);
});

test('font search dropdown supports keyboard navigation through filtered options', async () => {
  const source = await read('ui/src/components/Settings/FontSearchDropdown.tsx');
  assert.match(source, /activeIndex/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /Enter/);
  assert.match(source, /aria-activedescendant/);
});

test('desktop font import pickers accept one file per import action', async () => {
  const [electron, tauri] = await Promise.all([
    read('electron/core/runtime-command-handlers.js'),
    read('tauri/src/dispatcher/handlers.rs'),
  ]);
  assert.doesNotMatch(electron, /properties:\s*\[['"]openFile['"],\s*['"]multiSelections['"]\][\s\S]*?import_font/i);
  assert.match(tauri, /blocking_pick_file\(\)/);
  assert.doesNotMatch(tauri, /blocking_pick_files\(\)/);
});


test('font family and variant dropdowns use the supplied chevron icon and custom themed menus', async () => {
  const [icons, search, variant, css] = await Promise.all([
    read('ui/src/components/shared/icons.tsx'),
    read('ui/src/components/Settings/FontSearchDropdown.tsx'),
    read('ui/src/components/Settings/FontVariantDropdown.tsx'),
    read('ui/src/styles/global/global-settings-typography.css'),
  ]);
  assert.match(icons, /export const ChevronDownIcon/);
  assert.match(icons, /viewBox="0 0 122\.88 66\.91"/);
  assert.match(search, /<ChevronDownIcon/);
  assert.match(variant, /<ChevronDownIcon/);
  assert.match(css, /font-variant-menu/);
  assert.match(css, /font-search-menu__search:focus-within[\s\S]*?border-color:\s*var\(--bd-s\)/);
  assert.match(css, /font-search-menu__search:focus-within[\s\S]*?box-shadow:\s*none/);
  assert.match(search, /font-search-dropdown\$\{open \? ' is-open' : ''\}/);
  assert.match(css, /font-search-dropdown\.is-open[\s\S]*?font-search-dropdown__trigger:focus-visible[\s\S]*?outline:\s*none\s*!important/);
});

test('font imports are single-role draft updates and import action is placed before reset', async () => {
  const [component, translations] = await Promise.all([
    read('ui/src/components/Settings/DesktopTypographySettings.tsx'),
    read('ui/src/contexts/desktopTypographyTranslations.ts'),
  ]);
  assert.match(component, /pendingImport/);
  assert.match(component, /result\.requestId\s*!==\s*pendingImport\.requestId/);
  assert.match(component, /\[pendingImport\.role\]:\s*chooseFamily\(pendingImport\.role/);
  assert.match(component, /importDesktopFonts/);
  assert.match(component, /desktop-font-binding-row__header-actions[\s\S]*?onImport[\s\S]*?desktop-font-binding-row__reset/);
  assert.match(translations, /fontImport:\s*'Import font file'/);
});
