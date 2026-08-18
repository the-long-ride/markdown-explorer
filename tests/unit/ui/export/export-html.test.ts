import { describe, expect, it } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import { buildStandaloneExportHtml, exportHtmlPath, rewriteExportLinks } from '../../../../ui/src/export/exportHtml';

function file(relativePath: string): MdFile {
  return {
    fsPath: `/workspace/${relativePath}`, relativePath, parts: relativePath.split('/'),
    fileName: relativePath.split('/').at(-1) || relativePath,
    title: relativePath.replace(/\.mdx?$/, ''), extension: relativePath.endsWith('.mdx') ? '.mdx' : '.md', documentKind: 'markdown',
  };
}

const source = file('guide/intro.md');
const target = file('reference/api.md');

describe('rewriteExportLinks', () => {
  it('rewrites exported markdown links to extension-preserving html targets and keeps fragments', () => {
    const html = '<p><a href="../reference/api.md#methods">API</a></p>';
    expect(rewriteExportLinks(html, source, [source, target])).toContain('href="../reference/api.md.html#methods"');
  });

  it('preserves external, data, mail and fragment links', () => {
    const html = '<a href="https://example.com">A</a><a href="mailto:x@y.z">B</a><a href="data:text/plain,x">C</a><a href="#local">D</a>';
    expect(rewriteExportLinks(html, source, [source, target])).toBe(html);
  });

  it('disambiguates same-stem documents with different extensions', () => {
    const markdown = file('guide/topic.md');
    const mdx = file('guide/topic.mdx');
    const exported = [markdown, mdx];

    expect(exportHtmlPath(markdown, exported)).toBe('guide/topic.md.html');
    expect(exportHtmlPath(mdx, exported)).toBe('guide/topic.mdx.html');
    expect(rewriteExportLinks('<a href="./topic.mdx">MDX</a>', markdown, exported))
      .toContain('href="topic.mdx.html"');
  });
});

describe('buildStandaloneExportHtml', () => {
  const pages = [
    { file: source, html: '<h1 id="intro">Intro</h1><p>Hello</p>' },
    { file: target, html: '<h1 id="api">API</h1><p>World</p>' },
  ];

  it('builds document-only output without Explorer chrome', () => {
    const html = buildStandaloneExportHtml({ pages: [pages[0]], layout: 'document', title: 'Intro', themeCss: ':root{--accent:#f00}' });
    expect(html).toContain('class="mdn-body mdn-export-page"');
    expect(html).not.toContain('<nav class="mdn-export-sidebar"');
    expect(html).not.toContain('<aside class="mdn-export-toc"');
    expect(html).toContain('--accent:#f00');
  });

  it('builds Explorer layout with topbar, sidebar and toc shell', () => {
    const html = buildStandaloneExportHtml({ pages, layout: 'explorer', title: 'Docs', themeCss: ':root{--accent:#f00}' });
    expect(html).toContain('mdn-export-topbar');
    expect(html).toContain('mdn-export-sidebar');
    expect(html).toContain('mdn-export-toc');
    expect(html).toContain('doc-guide-intro-md');
    expect(html).toContain('doc-reference-api-md');
  });

  it('uses unique merged section IDs for same-stem documents', () => {
    const markdown = file('guide/topic.md');
    const mdx = file('guide/topic.mdx');
    const html = buildStandaloneExportHtml({
      pages: [
        { file: markdown, html: '<p>Markdown</p>' },
        { file: mdx, html: '<p>MDX</p>' },
      ],
      layout: 'explorer',
      title: 'Topics',
      themeCss: '',
    });

    expect(html).toContain('id="doc-guide-topic-md"');
    expect(html).toContain('id="doc-guide-topic-mdx"');
  });
});
