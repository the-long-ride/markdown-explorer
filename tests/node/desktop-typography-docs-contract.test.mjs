import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('README documents VS Code Edit, theme-aware Mermaid, and role-based host typography', async () => {
  const readme = await read('README.md');
  assert.match(readme, /VS Code exposes a dedicated Edit icon beside More actions/);
  assert.match(readme, /Mermaid diagrams render offline/);
  assert.match(readme, /current Markdown Explorer theme/);
  assert.match(readme, /(?:re-render[^.]*light\/dark|light\/dark[^.]*re-render)/i);
  assert.match(readme, /family-aware/i);
  assert.match(readme, /wide Gantt diagrams scroll/i);
  assert.match(readme, /\*\*Typography\*\*/);
  assert.match(readme, /JetBrains Mono/);
  assert.match(readme, /App UI, Body, Heading, Quote, Code, and Mermaid/);
});

test('desktop runtime docs define managed imports and cross-platform font discovery', async () => {
  const [electron, tauri, settings] = await Promise.all([
    read('docs/instructions/04-runtimes/01-electron-desktop.md'),
    read('docs/instructions/04-runtimes/02-tauri-desktop.md'),
    read('docs/instructions/03-features/12-settings-preferences-import-export.md'),
  ]);
  for (const runtime of [electron, tauri]) {
    assert.match(runtime, /Windows\/macOS\/Linux/);
    assert.match(runtime, /app-managed|app.data|app_data/i);
    assert.match(runtime, /ttc/);
    assert.match(runtime, /otc/);
  }
  assert.match(settings, /AppSettings\.fontBindings/);
  assert.match(settings, /App UI/);
  assert.match(settings, /Body/);
  assert.match(settings, /Heading/);
  assert.match(settings, /Quote/);
  assert.match(settings, /Code/);
  assert.match(settings, /Mermaid/);
  assert.match(settings, /re-render[^.]*current document/i);
  assert.match(settings, /single[\s\S]*?\.ttf[\s\S]*?\.otf/i);
});
