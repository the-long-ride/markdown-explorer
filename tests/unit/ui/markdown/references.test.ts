import { describe, expect, it } from 'vitest';
import { extractDocumentReferences } from '../../../../ui/src/markdown/references';

describe('extractDocumentReferences', () => {
  it('extracts wiki links, embeds, markdown links/media, and static HTML refs with source ranges', () => {
    const source = [
      '# Intro',
      'See [[Guide]] and ![[media/chart.png]].',
      '[Manual](guide.md?raw=1#Install)',
      '![Logo](images/logo.png)',
      '<a href="notes/ref.md#A"><img src="assets/x.svg"></a>',
    ].join('\n');
    const result = extractDocumentReferences(source);

    expect(result.references.map((reference) => ({
      kind: reference.kind,
      target: reference.target,
      fragment: reference.fragment,
    }))).toEqual([
      { kind: 'wiki-link', target: 'Guide', fragment: undefined },
      { kind: 'wiki-embed', target: 'media/chart.png', fragment: undefined },
      { kind: 'link', target: 'guide.md', fragment: 'Install' },
      { kind: 'media', target: 'images/logo.png', fragment: undefined },
      { kind: 'html-link', target: 'notes/ref.md', fragment: 'A' },
      { kind: 'html-media', target: 'assets/x.svg', fragment: undefined },
    ]);
    for (const reference of result.references) {
      expect(source.slice(reference.sourceStart, reference.sourceEnd).length).toBeGreaterThan(0);
    }
  });

  it('keeps standard Markdown destinations literal instead of applying wiki extension guesses', () => {
    const result = extractDocumentReferences('[Guide](Guide) [MD](Guide.md)');
    expect(result.references.map((reference) => reference.target)).toEqual(['Guide', 'Guide.md']);
  });

  it('strips query strings and percent-decodes fragments for local reference analysis', () => {
    const [reference] = extractDocumentReferences('[x](docs/a.md?download=1#API%20Usage)').references;
    expect(reference).toMatchObject({
      target: 'docs/a.md',
      fragment: 'API Usage',
    });
  });

  it('records dynamic MDX href/src attributes as dynamic rather than local references', () => {
    const result = extractDocumentReferences('<Card href={target} src={imagePath} /><A href="static.md" />');
    expect(result.dynamicReferences.map((reference) => reference.attribute)).toEqual(['href', 'src']);
    expect(result.references).toEqual([
      expect.objectContaining({ kind: 'html-link', target: 'static.md' }),
    ]);
  });

  it('does not treat wiki links or tags inside fenced/inline code as prose references', () => {
    const source = [
      'Real [[Guide]] #docs',
      '`[[Inline]] #inline`',
      '```md',
      '[[Fenced]] #fenced',
      '```',
    ].join('\n');
    const result = extractDocumentReferences(source);
    expect(result.references.map((reference) => reference.target)).toEqual(['Guide']);
    expect(result.tags).toEqual(['docs']);
  });

  it('extracts Markdown-aware tags without reading URL fragments or HTML attributes as tags', () => {
    const result = extractDocumentReferences([
      '#docs #nested/topic',
      '[x](a.md#anchor)',
      '<div data-tag="#attribute">#body</div>',
      'Escaped \\#not-a-tag and word#not-a-tag',
    ].join('\n'));
    expect(result.tags).toEqual(['docs', 'nested/topic', 'body']);
  });

  it('classifies remote URLs without fetching them', () => {
    const result = extractDocumentReferences('[site](https://example.com/a#top) ![img](https://example.com/x.png)');
    expect(result.references).toEqual([
      expect.objectContaining({ kind: 'link', target: 'https://example.com/a', fragment: 'top', remote: true }),
      expect.objectContaining({ kind: 'media', target: 'https://example.com/x.png', remote: true }),
    ]);
  });
});
