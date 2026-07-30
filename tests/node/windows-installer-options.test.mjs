import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

describe('Windows installer options', () => {
  test('Electron defaults desktop off and Start Menu on', async () => {
    const config = JSON.parse(await read('electron/package.json'));
    const hook = await read('electron/build/installer.nsh');
    assert.equal(config.build.nsis.createDesktopShortcut, false);
    assert.equal(config.build.nsis.createStartMenuShortcut, false);
    assert.match(hook, /Create desktop shortcut/);
    assert.match(hook, /Add Markdown Explorer to Start menu/);
    assert.doesNotMatch(hook, /\$ME_DesktopShortcutCheckbox\s*\n\s*\$\{NSD_Check\}/);
    assert.match(hook, /\$\{NSD_Check\} \$ME_StartMenuShortcutCheckbox/);
  });

  test('Tauri defaults desktop off and Start Menu on', async () => {
    const hook = await read('tauri/windows/explorer-hooks.nsh');
    assert.match(hook, /Add Markdown Explorer to Start menu/);
    assert.doesNotMatch(hook, /\$\{NSD_Check\} \$ME_DesktopShortcutCheckbox/);
    assert.match(hook, /\$\{NSD_Check\} \$ME_StartMenuShortcutCheckbox/);
    assert.match(hook, /\$\{NSD_GetState\} \$ME_StartMenuShortcutCheckbox \$ME_CreateStartMenuShortcut/);
  });
});
