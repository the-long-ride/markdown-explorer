import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const exists = async (path) => access(new URL(path, root)).then(() => true, () => false);

test('shared desktop font model defines role bindings and explicit variants', async () => {
  assert.equal(await exists('ui/src/desktop/fonts/fontModel.ts'), true);
  const source = await read('ui/src/desktop/fonts/fontModel.ts');
  assert.match(source, /export interface DesktopFontBinding/);
  assert.match(source, /export interface DesktopFontBindings/);
  for (const role of ['appUi', 'body', 'heading', 'quote', 'code', 'mermaid']) assert.match(source, new RegExp(`${role}:`));
  assert.match(source, /normalizeDesktopFontBinding/);
  assert.match(source, /migrateDesktopFontBindings/);
  assert.match(source, /getDesktopFontVariantOptions/);
});

test('AppSettings persists role bindings while PersistedState accepts legacy app/code fields', async () => {
  const [types, importExport, model, effects] = await Promise.all([
    read('ui/src/themeTypes.ts'),
    read('ui/src/settings/settingsImportExport.ts'),
    read('ui/src/contexts/appStateModel.ts'),
    read('ui/src/contexts/useAppStateEffects.ts'),
  ]);
  assert.match(types, /fontBindings\?: DesktopFontBindings/);
  assert.match(types, /appFont\?: DesktopFontSelection/);
  assert.match(types, /codeFont\?: DesktopFontSelection/);
  assert.match(importExport, /migrateDesktopFontBindings/);
  assert.match(model, /fontBindings:/);
  assert.match(effects, /fontBindings:/);
});

test('renderer/host protocol uses correlated desktopFontsResult messages', async () => {
  const [webview, host] = await Promise.all([
    read('ui/src/types/webviewMessages.ts'),
    read('ui/src/types/hostMessages.ts'),
  ]);
  assert.match(webview, /command: 'listDesktopFonts'/);
  assert.match(webview, /command: 'importDesktopFonts'/);
  assert.match(webview, /command: 'removeImportedDesktopFont'/);
  assert.match(webview, /requestId: string/);
  assert.match(host, /command: 'desktopFontsResult'/);
  assert.match(host, /readonly fonts: readonly DesktopFontFamily\[\]/);
  assert.match(host, /readonly requestId: string/);
});
