import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const changelog = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');

function unreleasedSection(source) {
  const match = source.match(/## \[Unreleased\]([\s\S]*?)(?=\n---\n|\n## \[)/);
  return match?.[1] ?? '';
}

test('Unreleased changelog documents local editing, split view, and Git history', () => {
  const unreleased = unreleasedSection(changelog);

  assert.match(unreleased, /local Markdown editing/i);
  assert.match(unreleased, /split document view/i);
  assert.match(unreleased, /Git history/i);
  assert.match(unreleased, /Electron/i);
  assert.match(unreleased, /Tauri/i);
  assert.match(unreleased, /VS Code/i);
});
