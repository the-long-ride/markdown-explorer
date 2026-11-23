import { describe, expect, it } from 'vitest';
import { exportHtmlPath, extractExportToc, rewriteExportLinks } from '../../../../ui/src/export/exportHtml';

const file = (relativePath: string) => ({ name: relativePath.split('/').pop() || '', relativePath, fsPath: `/w/${relativePath}` }) as any;

describe('exportHtml path edges', () => {
  it('names empty paths document and resolves workspace-absolute links', () => {
    expect(exportHtmlPath(file(''))).toBe('document.html');
    const source = file('docs/a.md');
    const target = file('ref/b.md');
    const html = '<a href="/ref/b.md?x=1#top">b</a><a href="mailto:x@y.z">m</a><a href="#local">l</a>';
    const rewritten = rewriteExportLinks(html, source, [source, target]);
    expect(rewritten).toContain('href="../ref/b.md.html#top"');
    expect(rewritten).toContain('mailto:x@y.z');
  });

  it('skips toc headings without text', () => {
    const toc = extractExportToc('<h2 id="empty"></h2><h2 id="t">Title</h2>');
    expect(toc.map((entry) => entry.id)).toEqual(['t']);
  });
});
