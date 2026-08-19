import { describe, expect, it } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import type { ExportAsset } from '../../../../ui/src/export/exportAssets';
import type { ExportRuntimeAsset } from '../../../../ui/src/export/exportRuntimeAssets';
import type { ExportDocumentSnapshot, ExportFeature } from '../../../../ui/src/export/exportSnapshot';
import type { ExportThemeSnapshot } from '../../../../ui/src/export/exportTheme';
import { composeHtmlExport, composeStaticSiteExport } from '../../../../ui/src/export/exportSite';

const theme: ExportThemeSnapshot = {
  rootAttributes: { 'data-theme': 'dark' }, cssVariables: { '--bg': '#111', '--tx': '#eee' },
  cssText: '.mdn-body{color:var(--tx)}', fontFaceCss: '',
};
const runtimeAssets: ExportRuntimeAsset[] = [
  { name: 'core', fileName: 'core.js', code: 'window.__core=1' },
  { name: 'media', fileName: 'media.js', code: 'window.__media=1' },
  { name: 'table', fileName: 'table.js', code: 'window.__table=1' },
  { name: 'charts', fileName: 'charts.js', code: 'window.__charts=1' },
  { name: 'html-preview', fileName: 'html-preview.js', code: 'window.__preview=1' },
];

function file(relativePath: string): MdFile {
  return {
    fsPath: `/workspace/${relativePath}`, relativePath, parts: relativePath.split('/'),
    fileName: relativePath.split('/').at(-1) || relativePath,
    title: relativePath.replace(/\.mdx?$/, ''), extension: '.md', documentKind: 'markdown',
  };
}

function document(relativePath: string, features: ExportFeature[]): ExportDocumentSnapshot {
  return {
    file: file(relativePath), markdownSource: '', html: `<p>${relativePath}</p>`,
    features: new Set(features), visualBlocks: [], warnings: [],
  };
}

function extra(path: string): ExportAsset {
  return { sourcePath: path, outputPath: `_extras/${path}`, bytes: new TextEncoder().encode(path), mimeType: 'text/plain', kind: 'extra' };
}

describe('HTML export composition', () => {
  it('returns one self-contained HTML file for one document without explicit extras', () => {
    const artifact = composeHtmlExport({
      documents: [document('guide.md', ['core', 'mediaModal'])], html: ['<p>Guide</p>'],
      layout: 'document', batchMode: 'separate', title: 'Guide', baseName: 'guide', theme, runtimeAssets,
    });

    expect(artifact.kind).toBe('html');
    const text = new TextDecoder().decode(artifact.bytes);
    expect(text).toContain('window.__core=1');
    expect(text).toContain('window.__media=1');
    expect(text).not.toContain('window.__charts=1');
  });

  it('promotes one HTML document with explicit extras to a ZIP package', () => {
    const artifact = composeHtmlExport({
      documents: [document('guide.md', ['core'])], html: ['<p>Guide</p>'],
      layout: 'document', batchMode: 'separate', title: 'Guide', baseName: 'guide', theme, runtimeAssets,
      extras: [extra('data/config.json')],
    });

    expect(artifact.kind).toBe('zip');
    expect(artifact.entries?.map((entry) => entry.path)).toEqual(['guide.md.html', '_extras/data/config.json']);
  });
});

describe('Static Website composition', () => {
  it('stores the union of required runtimes once and keeps referenced assets/extras', () => {
    const docs = [document('guide.md', ['core', 'mediaModal']), document('tables/data.md', ['core', 'dataTable', 'charts'])];
    const referenced: ExportAsset = {
      sourcePath: 'images/hero.png', outputPath: '_assets/images/hero.png', bytes: new Uint8Array([1]), mimeType: 'image/png', kind: 'referenced',
    };
    const artifact = composeStaticSiteExport({
      documents: docs,
      html: ['<img src="_assets/images/hero.png">', '<table class="mdn-table"></table>'],
      referencedAssets: [referenced], extras: [extra('data/raw.csv')], layout: 'document', batchMode: 'separate',
      title: 'Docs', baseName: 'docs', theme, runtimeAssets,
    });
    const paths = artifact.entries?.map((entry) => entry.path) ?? [];

    expect(artifact.kind).toBe('zip');
    expect(paths).toContain('index.html');
    expect(paths).toContain('guide.md.html');
    expect(paths).toContain('tables/data.md.html');
    expect(paths.filter((path) => path === '_runtime/core.js')).toHaveLength(1);
    expect(paths).toContain('_runtime/media.js');
    expect(paths).toContain('_runtime/table.js');
    expect(paths).toContain('_runtime/charts.js');
    expect(paths).not.toContain('_runtime/html-preview.js');
    expect(paths).toContain('_assets/images/hero.png');
    expect(paths).toContain('_extras/data/raw.csv');
  });
});
