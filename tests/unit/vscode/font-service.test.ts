import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVsCodeFontService } from '../../../vscode/src/fonts/fontService.ts';

const sourceFont = path.resolve('ui/assets/fonts/JetBrainsMono/JetBrainsMono-VariableFont_wght.ttf');
const italicFont = path.resolve('ui/assets/fonts/JetBrainsMono/JetBrainsMono-Italic-VariableFont_wght.ttf');

describe('VsCode fontService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'md-explorer-font-svc-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('imports valid TTF fonts and formats CSS resource URLs', async () => {
    const service = createVsCodeFontService({
      managedRoot: path.join(tempDir, 'managed'),
      systemFontRoots: [],
      resolveCssUrl: (filePath) => `vscode-webview-resource://${encodeURIComponent(filePath)}`,
    });

    const family = await service.importFontFiles([sourceFont, italicFont]);
    expect(family.source).toBe('imported');
    expect(family.family).toBe('JetBrains Mono');
    expect(family.available).toBe(true);
    expect(family.faces.length).toBeGreaterThanOrEqual(1);

    const face = family.faces[0];
    expect(face.cssUrl).toContain('vscode-webview-resource://');
    expect(face.variable).toBe(true);
    expect(face.minWeight).toBeLessThanOrEqual(400);
    expect(face.maxWeight).toBeGreaterThanOrEqual(700);

    const listed = await service.listFonts();
    expect(listed.some((f) => f.id === family.id)).toBe(true);

    // Remove imported font
    await service.removeImportedFont(family.id);
    const afterRemove = await service.listFonts();
    expect(afterRemove.some((f) => f.id === family.id)).toBe(false);
  });

  it('validates input file paths and extensions', async () => {
    const service = createVsCodeFontService({
      managedRoot: path.join(tempDir, 'managed'),
      resolveCssUrl: (p) => p,
    });

    await expect(service.importFontFiles([])).rejects.toThrow(
      'Choose at least one .ttf or .otf font file.',
    );

    const fakeFile = path.join(tempDir, 'not-a-font.txt');
    await writeFile(fakeFile, 'hello');

    await expect(service.importFontFiles([fakeFile])).rejects.toThrow(
      'Only .ttf and .otf font files can be imported.',
    );
  });

  it('validates font id format on deletion', async () => {
    const service = createVsCodeFontService({
      managedRoot: path.join(tempDir, 'managed'),
      resolveCssUrl: (p) => p,
    });

    await expect(service.removeImportedFont('../dangerous')).rejects.toThrow(
      'Invalid imported font id.',
    );
  });

  it('handles empty or non-existent system font directories gracefully', async () => {
    const nonExistentRoot = path.join(tempDir, 'non-existent-system-fonts');
    const service = createVsCodeFontService({
      managedRoot: path.join(tempDir, 'managed'),
      systemFontRoots: [nonExistentRoot],
      resolveCssUrl: (p) => p,
    });

    const list = await service.listFonts();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(0);
  });
});
