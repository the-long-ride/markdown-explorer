import { describe, expect, it } from 'vitest';
import { escapeExportHtml, extractExportToc, injectExportScripts } from '../../../../ui/src/export/exportHtml';

describe('exportHtml helper edge cases', () => {
  it('escapes every special character', () => {
    expect(escapeExportHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
  it('injects scripts before body end or appends them', () => {
    expect(injectExportScripts('<p>x</p>', [])).toBe('<p>x</p>');
    expect(injectExportScripts('<p>x</p>', [{ inline: 'a()' }])).toMatch(/^<p>x<\/p><script/);
    expect(injectExportScripts('<body></body>', [{ src: 'a.js' }])).toMatch(/a\.js.*<\/body>$/s);
  });
  it('skips empty headings when extracting the toc', () => {
    const toc = extractExportToc('<h2 id="a"><a href="#a"></a></h2><h2 id="b">B</h2><h3 class="x" id="c"> </h3>');
    expect(toc.map((e) => e.id)).toContain('b');
    expect(toc.map((e) => e.id)).not.toContain('a');
  });
});
