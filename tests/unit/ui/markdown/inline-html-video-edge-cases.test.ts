import { describe, expect, it } from 'vitest';
import { renderInline } from '../../../../ui/src/markdown/inline';

describe('renderInline html, mdx and video edge cases', () => {
  it('decorates safe html links and images but keeps tags without urls', () => {
    expect(renderInline('<a href="https://x.dev">x</a>', true)).toContain('data-mdn-bookmark-kind="link"');
    expect(renderInline('<a name="n">x</a>', true)).not.toContain('bookmark-kind');
    expect(renderInline('<img alt="a" />', true)).not.toContain('bookmark-kind');
  });

  it('rewrites mdx expression attributes and self-closing components', () => {
    const html = renderInline('<IconBadge label={"hi"} count={3} /> <Box onHover={handler}>t</Box>', true);
    expect(html).toContain('label="hi"');
    expect(html).toContain('count="3"');
    expect(html).toContain('<icon-badge');
    expect(html).toContain('onhover="handler(event)"');
  });

  it('renders youtube variants and wiki embeds', () => {
    expect(renderInline('![](https://youtu.be/abc123?t=30s)')).toContain('youtube');
    expect(renderInline('![cap](https://www.youtube.com/watch?v=abc&list=PL1&start=12)')).toContain('list=PL1');
    expect(renderInline('![](https://www.youtube.com/shorts/xyz)')).toBeTypeOf('string');
    expect(renderInline('![](https://www.youtube.com/channel/abc)')).toBeTypeOf('string');
    expect(renderInline('![[#frag]]')).toContain('mdn-wiki-embed');
    expect(renderInline('[[note#part]]')).toContain('data-mdn-wiki-fragment="part"');
  });
});
