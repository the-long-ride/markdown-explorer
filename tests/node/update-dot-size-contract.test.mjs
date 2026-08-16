import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('every update attention indicator uses the shared 11px More Actions dot token', async () => {
  const [tokens, navigation, search, topbar] = await Promise.all([
    read('ui/src/styles/tokens/tokens-base-themes.css'),
    read('ui/src/styles/global/global-settings-navigation.css'),
    read('ui/src/styles/global/global-search-buttons.css'),
    read('ui/src/styles/global/global-topbar-actions.css'),
  ]);
  assert.match(tokens, /--update-attention-dot-size:\s*11px/);
  assert.match(navigation, /settings-nav-badge-dot[\s\S]*?width:\s*var\(--update-attention-dot-size\)[\s\S]*?height:\s*var\(--update-attention-dot-size\)/);
  assert.match(search, /btn\.has-update::after[\s\S]*?width:\s*var\(--update-attention-dot-size\)[\s\S]*?height:\s*var\(--update-attention-dot-size\)/);
  assert.match(topbar, /toolbar-action-menu__item\.has-update::after[\s\S]*?width:\s*var\(--update-attention-dot-size\)[\s\S]*?height:\s*var\(--update-attention-dot-size\)/);
});
