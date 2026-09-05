import { describe, expect, it } from 'vitest';
import {
  buildDocumentAnchorIndex,
  createHeadingIdAllocator,
  extractStaticAnchors,
} from '../../../../ui/src/markdown/anchors';
import { parse } from '../../../../ui/src/markdown/parser';
import { HtmlRenderer } from '../../../../ui/src/markdown/renderer';

describe('markdown anchors', () => {
  it('matches renderer duplicate suffixes', () => {
    const next = createHeadingIdAllocator();
    expect(next('API Usage')).toBe('api-usage');
    expect(next('API Usage')).toBe('api-usage-1');
    expect(next('API Usage')).toBe('api-usage-2');
  });

  it('indexes ATX and Setext headings with the same duplicate sequence', () => {
    const { tokens } = parse(`# API Usage\n\nAPI Usage\n---------\n\n## API Usage\n`);
    const index = buildDocumentAnchorIndex(tokens);
    expect([...index.anchors]).toEqual(['api-usage', 'api-usage-1', 'api-usage-2']);
  });

  it('includes literal HTML id and legacy anchor name', () => {
    const anchors = extractStaticAnchors('<div id="details"></div><a name="legacy"></a>');
    expect(anchors.anchors).toEqual(new Set(['details', 'legacy']));
    expect(anchors.dynamic).toEqual([]);
  });

  it('classifies dynamic MDX ids as dynamic rather than valid anchors', () => {
    const anchors = extractStaticAnchors('<section id={sectionId}></section><div id="static"></div>');
    expect(anchors.anchors).toEqual(new Set(['static']));
    expect(anchors.dynamic).toHaveLength(1);
    expect(anchors.dynamic[0]).toContain('id={sectionId}');
  });

  it('keeps HtmlRenderer TOC ids exactly aligned with the shared allocator', () => {
    const { tokens } = parse(`# API Usage\n\n## API Usage\n\n### API Usage\n`);
    const rendered = new HtmlRenderer().render(tokens);
    expect(rendered.toc.map((item) => item.id)).toEqual(['api-usage', 'api-usage-1', 'api-usage-2']);
    expect(rendered.html).toContain('id="api-usage"');
    expect(rendered.html).toContain('id="api-usage-1"');
  });
});
