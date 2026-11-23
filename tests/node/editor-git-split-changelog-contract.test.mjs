import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const changelog = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');

function v170Section(source) {
  const match = source.match(/## \[v1\.7\.0\]([\s\S]*?)(?=\n---\n|\n## \[)/);
  return match?.[1] ?? '';
}

test('v1.7.0 changelog documents local editing, split view, and Git history', () => {
  const section = v170Section(changelog);

  assert.match(section, /local Markdown editing/i);
  assert.match(section, /split document view/i);
  assert.match(section, /Git history/i);
  assert.match(section, /Electron/i);
  assert.match(section, /Tauri/i);
  assert.match(section, /VS Code/i);
});
