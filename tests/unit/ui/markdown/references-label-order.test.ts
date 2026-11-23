import { describe, expect, it } from 'vitest';
import { extractDocumentReferences } from '../../../../ui/src/markdown/references';

describe('extractDocumentReferences labels and ordering', () => {
  it('omits empty labels, keeps media labels and orders by position', () => {
    const { references, tags } = extractDocumentReferences('[](a.md) ![pic](b.png) [x](c.md#frag) #tag #tag (#paren)\n#start');
    expect(references.map((r) => r.target)).toEqual(['a.md', 'b.png', 'c.md']);
    expect(references[0]).not.toHaveProperty('label');
    expect(references[1]).toMatchObject({ kind: 'media', label: 'pic' });
    expect(references[2]).toMatchObject({ fragment: 'frag' });
    expect(tags).toEqual(expect.arrayContaining(['tag', 'paren', 'start']));
  });
});
