import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sourceFont = path.resolve('ui/assets/fonts/JetBrainsMono/JetBrainsMono-VariableFont_wght.ttf');

test('VS Code font service imports, lists, resolves a webview URL, and removes managed fonts', async () => {
  const { createVsCodeFontService } = await import('../../vscode/src/fonts/fontService.ts');
  const root = await mkdtemp(path.join(os.tmpdir(), 'markdown-explorer-vscode-fonts-'));
  try {
    const service = createVsCodeFontService({
      managedRoot: path.join(root, 'fonts'),
      systemFontRoots: [],
      resolveCssUrl: (filePath) => `https://file+.vscode-resource.vscode-cdn.net/${encodeURIComponent(filePath)}`,
    });
    const imported = await service.importFontFiles([sourceFont]);
    assert.equal(imported.source, 'imported');
    assert.equal(imported.family, 'JetBrains Mono');
    assert.match(imported.faces[0]?.cssUrl ?? '', /vscode-resource\.vscode-cdn\.net/);

    const listed = await service.listFonts();
    assert.equal(listed.some((family) => family.id === imported.id), true);

    await service.removeImportedFont(imported.id);
    const afterRemove = await service.listFonts();
    assert.equal(afterRemove.some((family) => family.id === imported.id), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
