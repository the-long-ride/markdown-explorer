import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sources = [
  ['Electron', fs.readFileSync(path.join(repoRoot, 'electron/build/installer.nsh'), 'utf8')],
  ['Tauri', fs.readFileSync(path.join(repoRoot, 'tauri/windows/explorer-hooks.nsh'), 'utf8')],
];

for (const [runtime, source] of sources) {
  test(`${runtime} installer registers both Markdown file verbs`, () => {
    assert.match(source, /Add Markdown Explorer to \.md and \.mdx context menus/);
    assert.doesNotMatch(source, /Open with Markdown Explorer/);
    assert.match(source, /Open in Markdown Explorer/);
    assert.match(source, /Open in Markdown Explorer with this folder/);
    assert.match(source, /SystemFileAssociations\\\.md\\shell\\MarkdownExplorerWithFolder/);
    assert.match(source, /SystemFileAssociations\\\.mdx\\shell\\MarkdownExplorerWithFolder/);
    assert.match(source, /--open-with-folder \"%1\"/);
  });

  test(`${runtime} installer preserves folder verbs and removes owned Markdown verbs`, () => {
    assert.match(source, /Directory\\shell\\MarkdownExplorer/);
    assert.match(source, /Directory\\Background\\shell\\MarkdownExplorer/);
    assert.match(source, /Open Folder in Markdown Explorer/);
    for (const extension of ['.md', '.mdx']) {
      assert.match(source, new RegExp(`DeleteRegKey HKCU \"Software\\\\Classes\\\\SystemFileAssociations\\\\\\${extension}\\\\shell\\\\MarkdownExplorer\"`));
      assert.match(source, new RegExp(`DeleteRegKey HKCU \"Software\\\\Classes\\\\SystemFileAssociations\\\\\\${extension}\\\\shell\\\\MarkdownExplorerWithFolder\"`));
    }
  });
}
