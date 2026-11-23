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

const decode = (b: Uint8Array) => new TextDecoder().decode(b);

describe('export site batch edges', () => {
  it('rejects incomplete document sets', () => {
    expect(() => composeHtmlExport({ documents: [], html: [], layout: 'document', batchMode: 'separate', title: 'T', baseName: 'b', theme, runtimeAssets })).toThrow('HTML export has no complete document set');
    expect(() => composeStaticSiteExport({ documents: [document('a.md', ['core'])], html: [], referencedAssets: [], layout: 'document', batchMode: 'separate', title: 'T', baseName: 'b', theme, runtimeAssets })).toThrow('Static Website export');
  });

  it('builds merged html and multi-page zips', () => {
    const docs = [document('a.md', ['core']), document('b/c.md', ['core', 'mediaModal'])];
    const merged = composeHtmlExport({ documents: docs, html: ['<p>A</p>', '<p>C</p>'], layout: 'document', batchMode: 'merged', title: 'T', baseName: 'b', theme, runtimeAssets });
    expect(merged).toMatchObject({ kind: 'html', fileName: 'b-merged.html' });
    expect(decode(merged.bytes)).toContain('window.__core=1');
    const zip = composeHtmlExport({ documents: docs, html: ['<p>A</p>', '<p>C</p>'], layout: 'document', batchMode: 'separate', title: 'T', baseName: 'b', theme, runtimeAssets });
    expect(zip).toMatchObject({ kind: 'zip', fileName: 'b-html.zip' });
    const site = composeStaticSiteExport({ documents: docs, html: ['<p>A</p>', '<p>C</p>'], referencedAssets: [], layout: 'document', batchMode: 'merged', title: 'T', baseName: 'b', theme: { ...theme, rootAttributes: {} }, runtimeAssets });
    expect(site.entries?.some((e) => e.path === 'index.html')).toBe(true);
  });

  it('fails on missing runtime bundles and duplicate package paths', () => {
    expect(() => composeHtmlExport({ documents: [document('a.md', ['core'])], html: ['x'], layout: 'document', batchMode: 'separate', title: 'T', baseName: 'b', theme, runtimeAssets: [] })).toThrow('Missing export runtime bundle');
    const dup = [document('a.md', ['core']), document('a.md', ['core'])];
    expect(() => composeHtmlExport({ documents: dup, html: ['x', 'y'], layout: 'document', batchMode: 'separate', title: 'T', baseName: 'b', theme, runtimeAssets })).toThrow('Duplicate export package path');
  });
});
