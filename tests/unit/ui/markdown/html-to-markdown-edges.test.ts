import { describe, expect, it } from 'vitest';
import { convertHtmlSourceToMarkdown } from '../../../../ui/src/markdown/htmlToMarkdown';

describe('convertHtmlSourceToMarkdown edges', () => {
  it('renders tables with uneven rows, header-only tables and skips empty ones', () => {
    const md = convertHtmlSourceToMarkdown('<table><tr><th>A</th><th>B|C</th></tr><tr><td>1</td></tr></table><table><tr><th>Solo</th></tr></table><table></table><table><tr></tr></table>');
    expect(md).toContain('| A | B\\|C |');
    expect(md).toContain('| 1 |  |');
    expect(md).toContain('| Solo |');
  });

  it('handles links, images, code and nested lists edge cases', () => {
    const md = convertHtmlSourceToMarkdown([
      '<a>bare</a><a href="https://x.test"></a>',
      '<img src="a.png" alt="A" title="say &quot;hi&quot;"><img alt="nosrc">',
      '<pre>plain\n\n</pre><pre><code class="lang-js">x</code></pre><code>a`b</code>',
      '<ol><li>one<ul><li>inner</li></ul></li><span>not li</span></ol>',
      '<iframe src="x"></iframe><custom-tag>kept</custom-tag><!-- c --><s>gone</s><blockquote>q1<br>q2</blockquote><hr>',
    ].join(''));
    expect(md).toContain('bare');
    expect(md).toContain('[https://x.test](https://x.test)');
    expect(md).toContain('![A](a.png "say \\"hi\\"")');
    expect(md).not.toContain('nosrc');
    expect(md).toContain('```\nplain\n```');
    expect(md).toContain('```js\nx\n```');
    expect(md).toContain('`a\\`b`');
    expect(md).toContain('1. one');
    expect(md).toContain('kept');
    expect(md).toContain('~~gone~~');
    expect(md).toContain('> q1');
  });
});
