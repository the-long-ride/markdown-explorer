import { describe, expect, it } from 'vitest';
import { renderInline } from '../../../../ui/src/markdown/inline';

describe('wiki inline rendering', () => {
  it('renders a wiki link as a resolver-backed internal action', () => {
    const html = renderInline('See [[Setup|Install guide]]');
    expect(html).toContain('class="mdn-wiki-link"');
    expect(html).toContain('data-mdn-wiki-target="Setup"');
    expect(html).toContain('>Install guide</a>');
    expect(html).not.toContain('href="Setup"');
  });

  it('renders a wiki embed as an unloaded resolver-backed embed marker', () => {
    const html = renderInline('![[media/chart.png]]');
    expect(html).toContain('class="mdn-wiki-embed"');
    expect(html).toContain('data-mdn-wiki-target="media/chart.png"');
    expect(html).toContain('data-mdn-wiki-kind="embed"');
  });

  it('keeps current-document fragments and labels in data attributes', () => {
    const html = renderInline('[[#Overview|Jump]]');
    expect(html).toContain('data-mdn-wiki-target=""');
    expect(html).toContain('data-mdn-wiki-fragment="Overview"');
    expect(html).toContain('>Jump</a>');
  });
});
