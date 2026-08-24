import { describe, expect, it, vi } from 'vitest';
import type { DocumentSnapshot } from '../../../../ui/src/export/documentSnapshot';
import {
  collectReferencedExportAssets,
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

function expectWindowsPortablePath(path: string) {
  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
  for (const segment of path.split('/')) {
    expect(segment).not.toMatch(/[<>:"\\|?*\x00-\x1f]/);
    expect(segment).not.toMatch(/[ .]$/);
    expect(segment).not.toMatch(reserved);
  }
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

describe('portable packaged asset paths', () => {
  it('encodes packaged resource paths so every segment is valid on Windows', async () => {
    const unsafeNames = ['con.txt', 'report.', 'a:b?.json'];
    const snapshot: DocumentSnapshot = {
      file: file(), markdownSource: '',
      html: unsafeNames.map((name) => `<img src="./${name}">`).join(''),
    };

    const result = await collectReferencedExportAssets({
      snapshot,
      readResource: async (path) => ok(path.replace(/^\.\//, ''), 'application/octet-stream'),
      mode: 'package',
      pageOutputPath: 'docs/guide.md.html',
    });

    expect(result.assets).toHaveLength(3);
    result.assets.forEach((asset) => expectWindowsPortablePath(asset.outputPath));
    expect(new Set(result.assets.map((asset) => asset.outputPath)).size).toBe(result.assets.length);
    expect(result.assets.every((asset) => asset.outputPath.startsWith('_assets/'))).toBe(true);
  });
});
