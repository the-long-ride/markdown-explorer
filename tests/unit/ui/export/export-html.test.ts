import { describe, expect, it } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import { buildStandaloneExportHtml, exportHtmlPath, injectExportScripts, rewriteExportLinks } from '../../../../ui/src/export/exportHtml';
import type { ExportThemeSnapshot } from '../../../../ui/src/export/exportTheme';

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
    expect(rewriteExportLinks('<a href="./topic.mdx">MDX</a>', markdown, exported)).toContain('href="topic.mdx.html"');
  });

  it('makes case-distinct archive paths portable on case-insensitive filesystems', () => {
    const upper = file('guide/Topic.md');
    const lower = file('guide/topic.md');
    const upperPath = exportHtmlPath(upper, [upper, lower]);
    const lowerPath = exportHtmlPath(lower, [upper, lower]);
    expect(upperPath.toLowerCase()).not.toBe(lowerPath.toLowerCase());
    expect(rewriteExportLinks('<a href="./topic.md">lower</a>', upper, [upper, lower])).toContain(`href="${lowerPath.split('/').at(-1)}"`);
  });

  it('cannot collide with source names that mimic a generated case marker', () => {
    const upper = file('guide/Topic.md');
    const markerLike = file('guide/topic.md--case-0');
    expect(exportHtmlPath(upper, [upper, markerLike]).toLowerCase()).not.toBe(exportHtmlPath(markerLike, [upper, markerLike]).toLowerCase());
  });

  it('encodes Windows-forbidden ASCII characters in portable export paths', () => {
    const unsafe = file('guide/bad:<>"|?*.md');
    expect(exportHtmlPath(unsafe)).toBe('guide/bad~3a~~3c~~3e~~22~~7c~~3f~~2a~.md.html');
  });

  it('encodes trailing dots and spaces in path segments', () => {
    expect(exportHtmlPath(file('folder./readme.md'))).toBe('folder~2e~/readme.md.html');
    expect(exportHtmlPath(file('folder /readme.md'))).toBe('folder~20~/readme.md.html');
  });

  it('escapes lowercase Windows device names including names with extensions', () => {
    expect(exportHtmlPath(file('con/readme.md'))).toBe('~63~on/readme.md.html');
    expect(exportHtmlPath(file('guide/con.md'))).toBe('guide/~63~on.md.html');
    expect(exportHtmlPath(file('aux/readme.md'))).toBe('~61~ux/readme.md.html');
    expect(exportHtmlPath(file('com1/readme.md'))).toBe('~63~om1/readme.md.html');
    expect(exportHtmlPath(file('lpt9/readme.md'))).toBe('~6c~pt9/readme.md.html');
    expect(exportHtmlPath(file('console/readme.md'))).toBe('console/readme.md.html');
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

  it('applies portable theme identity and gives the document page normal vertical scrolling', () => {
    const theme: ExportThemeSnapshot = {
      rootAttributes: { 'data-theme': 'dark', 'data-theme-style': 'raw-grid' }, cssVariables: { '--accent': '#f00' },
      cssText: '.mdn-body{color:var(--tx)}', fontFaceCss: '@font-face{font-family:"Export Test";src:local("Export Test")}',
    };
    const html = buildStandaloneExportHtml({ pages: [pages[0]], layout: 'document', title: 'Intro', theme });
    expect(html).toContain('data-mdn-export="true"');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('@font-face');
    expect(html).toContain('overflow-y:auto!important');
    expect(html).toContain('height:auto');
  });

  it('injects inline or local external runtime scripts before body close', () => {
    const base = buildStandaloneExportHtml({ pages: [pages[0]], layout: 'document', title: 'Intro', themeCss: '' });
    const inline = injectExportScripts(base, [{ inline: 'window.ok="</script>"' }]);
    const external = injectExportScripts(base, [{ src: '../_runtime/core.js' }]);
    expect(inline).toContain('<script>window.ok="<\\/script>"</script></body>');
    expect(external).toContain('<script src="../_runtime/core.js"></script></body>');
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
    const html = buildStandaloneExportHtml({ pages: [{ file: markdown, html: '<p>Markdown</p>' }, { file: mdx, html: '<p>MDX</p>' }], layout: 'explorer', title: 'Topics', themeCss: '' });
    expect(html).toContain('id="doc-guide-topic-md"');
    expect(html).toContain('id="doc-guide-topic-mdx"');
  });

  it('disambiguates merged section IDs when punctuation normalizes to the same slug', () => {
    const dotted = file('guide/a.b.md');
    const dashed = file('guide/a-b.md');
    const html = buildStandaloneExportHtml({ pages: [{ file: dotted, html: '<p>Dotted</p>' }, { file: dashed, html: '<p>Dashed</p>' }], layout: 'explorer', title: 'Collision', themeCss: '' });
    const ids = [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(html).toContain(`href="#${ids[0]}"`);
    expect(html).toContain(`href="#${ids[1]}"`);
  });

  it('keeps case-only merged paths on distinct anchors', () => {
    const upper = file('guide/A-B.md');
    const lower = file('guide/a-b.md');
    const html = buildStandaloneExportHtml({ pages: [{ file: upper, html: '<a href="./a-b.md">lower</a>' }, { file: lower, html: '<p>Lower</p>' }], layout: 'explorer', title: 'Case collision', themeCss: '' });
    const ids = [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(html).toContain(`href="#${ids[1]}"`);
  });
});
