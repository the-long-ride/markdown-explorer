import { describe, expect, it } from 'vitest';
import { highlightXmlMarkup } from '../../../../ui/src/markdown/highlighting/xml';

describe('highlightXmlMarkup edge cases', () => {
  it('handles bare, quoted, unterminated and malformed attributes', () => {
    const html = highlightXmlMarkup('<root a=bare b="q" c=\'s\' d e= = f="open><child/></root>');
    expect(html).toContain('<span class="hl-str">bare</span>');
    expect(html).toContain('hl-str');
  });

  it('handles text without tags, comments, cdata and invalid tag names', () => {
    expect(highlightXmlMarkup('plain & text')).toContain('&amp;');
    expect(highlightXmlMarkup('<!-- open comment')).toContain('open comment');
    expect(highlightXmlMarkup('a <!-- c --> <![CDATA[x]]> <?xml version="1.0"?> < 1 <=x> <a')).toContain('&lt;');
    expect(highlightXmlMarkup('<tag attr="1"   >  text  </tag>  ')).toContain('text');
  });
});
