import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const configPath = new URL('../../tauri/tauri.conf.json', import.meta.url);

test('Tauri Windows app and NSIS installer share the Markdown Explorer icon', () => {
  const { bundle } = JSON.parse(readFileSync(configPath, 'utf8'));
  const appIcon = bundle.icon.find((icon) => icon.endsWith('.ico'));

  assert.equal(appIcon, 'icons/icon.ico');
  assert.equal(bundle.windows.nsis.installerIcon, appIcon);
  assert.ok(existsSync(new URL(appIcon, configPath)));
});
