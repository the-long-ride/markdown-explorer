import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('bookmark source anchors and user manual are documented across release surfaces', async () => {
  const [feature, useCase, llm, changelog, vscodeChangelog] = await Promise.all([
    read('docs/instructions/03-features/21-bookmarks.md'),
    read('docs/instructions/02-use-cases/UC-031-manage-bookmarks.md'),
    read('website/llm.txt'),
    read('CHANGELOG.md'),
    read('vscode/CHANGELOG.md'),
  ]);
  for (const content of [feature, useCase, llm, changelog, vscodeChangelog]) {
    assert.match(content, /source[- ]anchored|source anchor/i);
    assert.match(content, /targetChanged|Target changed/i);
  }
  for (const content of [llm, changelog, vscodeChangelog]) assert.match(content, /User manual/i);
  assert.match(feature, /schema version 2|Version[- ]2/i);
  assert.match(useCase, /multiple lines|multiline|cross lines|multiple rendered nodes|multiple Markdown formats/i);
  assert.match(llm, /LaTeX formulas, Mermaid diagrams, images, or links/i);
  assert.match(changelog, /batch deletion/i);
  assert.match(vscodeChangelog, /Alt\+Shift\+B/);
});

test('settings and shortcut references describe the current bookmark UX', async () => {
  const [settings, shortcuts, localization, models] = await Promise.all([
    read('docs/instructions/05-reference/03-settings-catalog.md'),
    read('docs/instructions/05-reference/04-shortcut-catalog.md'),
    read('docs/instructions/05-reference/10-localization-catalog.md'),
    read('docs/instructions/05-reference/11-core-data-models.md'),
  ]);
  assert.match(settings, /Enable Bookmark feature/);
  assert.match(shortcuts, /openBookmarks/);
  assert.match(shortcuts, /Ctrl\+Shift\+B/);
  assert.match(shortcuts, /Alt\+Shift\+B/);
  assert.match(localization, /nine|9/i);
  assert.match(models, /BookmarkSourceAnchor/);
});

test('verified bookmark saves, focus-aware search, and feedback are specified', async () => {
  const [feature, useCase, sidebarSpec, searchSpec, errors, localization, quality, llm, changelog, vscodeChangelog] = await Promise.all([
    read('docs/instructions/03-features/21-bookmarks.md'),
    read('docs/instructions/02-use-cases/UC-031-manage-bookmarks.md'),
    read('docs/instructions/03-features/03-sidebar-tree-and-scope.md'),
    read('docs/instructions/03-features/11-search-system.md'),
    read('docs/instructions/05-reference/09-error-and-reason-catalog.md'),
    read('docs/instructions/05-reference/10-localization-catalog.md'),
    read('docs/instructions/06-quality/01-test-strategy.md'),
    read('website/llm.txt'),
    read('CHANGELOG.md'),
    read('vscode/CHANGELOG.md'),
  ]);
  for (const content of [feature, useCase, llm, changelog, vscodeChangelog]) {
    assert.match(content, /verified persistence|verify persistence|verified save/i);
    assert.match(content, /Mermaid.*entrypoint|entrypoint.*Mermaid/i);
    assert.match(content, /success.*error.*toast|green.*red.*toast/i);
  }
  for (const content of [sidebarSpec, searchSpec, quality, changelog, vscodeChangelog]) {
    assert.match(content, /focus.*search.*rerun|rerun.*focus.*search|focus-aware.*search/i);
  }
  assert.match(errors, /storage-unavailable|bookmark-persist-failed/);
  assert.match(localization, /savedSuccess/);
  assert.match(localization, /renameFailed/);
  assert.match(quality, /bookmark-save-feedback\.test\.mjs/);
  assert.match(quality, /sidebar-focus-search-layout\.test\.mjs/);
});
