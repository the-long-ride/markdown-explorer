import { describe, expect, it, vi } from 'vitest';
import type { DocumentSnapshot } from '../../../../ui/src/export/documentSnapshot';
import {
  collectExplicitExportAssets,
  collectReferencedExportAssets,
  expandExplicitResourcePaths,
  mergeExportAssets,
  type ExportResourceReader,
} from '../../../../ui/src/export/exportAssets';
import type { MdFile } from '../../../../ui/src/types/files';

function file(): MdFile {
  return {
    fsPath: '/workspace/docs/guide.md', relativePath: 'docs/guide.md', parts: ['docs', 'guide.md'],
    fileName: 'guide.md', title: 'Guide', extension: '.md', documentKind: 'markdown',
  };
}

function ok(relativePath: string, mimeType = 'image/png', text = 'asset') {
  return { ok: true as const, relativePath, mimeType, bytes: new TextEncoder().encode(text) };
}

describe('referenced export assets', () => {
  it('reads supported local references through the workspace resource reader and inlines them', async () => {
    const snapshot: DocumentSnapshot = {
      file: file(), markdownSource: '# Guide',
      html: '<img src="./hero.png"><video poster="./poster.jpg"><source src="./clip.mp4"></video>',
    };
    const reader: ExportResourceReader = vi.fn(async (path) => {
      if (path.includes('hero')) return ok('docs/hero.png');
      if (path.includes('poster')) return ok('docs/poster.jpg', 'image/jpeg');
      return ok('docs/clip.mp4', 'video/mp4');
    });

    const result = await collectReferencedExportAssets({ snapshot, readResource: reader, mode: 'inline' });

    expect(reader).toHaveBeenCalledTimes(3);
    expect(result.html).toContain('data:image/png;base64,');
    expect(result.html).toContain('data:image/jpeg;base64,');
    expect(result.html).toContain('data:video/mp4;base64,');
    expect(result.assets).toHaveLength(3);
    expect(result.warnings).toEqual([]);
  });

  it('warns and leaves automatic missing references exportable', async () => {
    const snapshot: DocumentSnapshot = { file: file(), markdownSource: '', html: '<img src="./missing.png">' };
    const result = await collectReferencedExportAssets({
      snapshot,
      readResource: async () => ({ ok: false, reason: 'missing' }),
      mode: 'inline',
    });

    expect(result.html).toContain('src="./missing.png"');
    expect(result.warnings[0]).toContain('missing.png');
    expect(result.warnings[0]).toContain('missing');
  });

  it('rewrites packaged references to the reserved asset graph path', async () => {
    const snapshot: DocumentSnapshot = { file: file(), markdownSource: '', html: '<img src="./hero.png">' };
    const result = await collectReferencedExportAssets({
      snapshot,
      readResource: async () => ok('docs/hero.png'),
      mode: 'package',
      pageOutputPath: 'docs/guide.md.html',
    });

    expect(result.html).toContain('src="../_assets/docs/hero.png"');
    expect(result.assets[0].outputPath).toBe('_assets/docs/hero.png');
  });
});

describe('explicit export assets', () => {
  const resources = [
    { relativePath: 'data/a.json', size: 1 },
    { relativePath: 'data/nested/b.json', size: 2 },
    { relativePath: 'notes.txt', size: 3 },
  ];

  it('expands folder selections and preserves the workspace hierarchy under _extras', async () => {
    expect(expandExplicitResourcePaths(['data'], resources)).toEqual(['data/a.json', 'data/nested/b.json']);
    const assets = await collectExplicitExportAssets({
      selectedPaths: ['data'], resources,
      readResource: async (path) => ok(path, 'application/json'),
    });
    expect(assets.map((asset) => asset.outputPath)).toEqual(['_extras/data/a.json', '_extras/data/nested/b.json']);
  });

  it('fails the package for an explicitly selected unreadable file', async () => {
    await expect(collectExplicitExportAssets({
      selectedPaths: ['notes.txt'], resources,
      readResource: async () => ({ ok: false, reason: 'unreadable' }),
    })).rejects.toThrow('notes.txt');
  });

  it('emits a referenced + explicitly selected resource once', () => {
    const referenced = { ...ok('data/a.json'), sourcePath: 'data/a.json', outputPath: '_assets/data/a.json', kind: 'referenced' as const };
    const extra = { ...ok('data/a.json'), sourcePath: 'data/a.json', outputPath: '_extras/data/a.json', kind: 'extra' as const };
    const merged = mergeExportAssets([referenced], [extra]);
    expect(merged).toHaveLength(1);
    expect(merged[0].outputPath).toBe('_assets/data/a.json');
  });
});
