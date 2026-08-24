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

describe('HTML export composition', () => {
  it('returns one self-contained HTML file for one document without referenced assets', () => {
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
});

describe('Static Website composition', () => {
  it('stores the union of required runtimes once and keeps referenced assets', () => {
    const docs = [document('guide.md', ['core', 'mediaModal']), document('tables/data.md', ['core', 'dataTable', 'charts'])];
    const referenced: ExportAsset = {
      sourcePath: 'images/hero.png', outputPath: '_assets/images/hero.png', bytes: new Uint8Array([1]), mimeType: 'image/png',
    };
    const artifact = composeStaticSiteExport({
      documents: docs,
      html: ['<img src="_assets/images/hero.png">', '<table class="mdn-table"></table>'],
      referencedAssets: [referenced], layout: 'document', batchMode: 'separate',
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
  });

  it('exports Full Markdown Explorer pages with collapsible tree navigation and a right table of contents', () => {
    const docs = [
      document('guide/z.md', ['core']),
      document('guide/deep/a.md', ['core']),
      document('guide/b.md', ['core']),
    ];
    const artifact = composeStaticSiteExport({
      documents: docs,
      html: [
        '<section class="mdn-section mdn-section--h1" id="z-overview"><div class="mdn-section-header"><h1 class="mdn-section-title">Overview</h1></div></section>',
        '<section class="mdn-section mdn-section--h1" id="a-intro"><div class="mdn-section-header"><h1 class="mdn-section-title">Intro</h1></div></section>',
        '<section class="mdn-section mdn-section--h1" id="b-start"><div class="mdn-section-header"><h1 class="mdn-section-title">Start</h1></div></section>',
      ],
      referencedAssets: [], layout: 'explorer', batchMode: 'separate',
      title: 'Docs', baseName: 'docs', theme, runtimeAssets,
    });
    const page = artifact.entries?.find((entry) => entry.path === 'guide/z.md.html');
    expect(page).toBeTruthy();
    const html = new TextDecoder().decode(page!.data);
    expect(html).toContain('<details class="mdn-export-tree-folder" open>');
    expect(html).toContain('aria-label="On this page"');
    expect(html).toContain('class="mdn-export-toc__link is-level-1" href="#z-overview">Overview</a>');
    expect(html).not.toContain('aria-label="Files"');
    expect(html).toContain('href="deep/a.md.html"');
    expect(html).toContain('href="b.md.html"');
  });
});
