import { describe, expect, it } from 'vitest';
import { buildRelationshipCandidates, getRelationshipEvidence } from '../../../../ui/src/insights/relationships';

const doc = (path: string, extra: Record<string, unknown> = {}) => ({ path, title: '', tags: [], headings: [], links: [], terms: [], ...extra }) as any;

describe('relationship candidates edges', () => {
  it('records direct links in both directions', () => {
    const evidence = getRelationshipEvidence(doc('a.md', { links: ['b.md'] }), doc('b.md', { links: ['a.md'] })) as any;
    expect(evidence.directLinks).toEqual(['a.md->b.md', 'b.md->a.md']);
  });

  it('caps shared buckets and adds link pairs while skipping self and unknown links', () => {
    const docs = Array.from({ length: 82 }, (_, index) => doc(`d${index}.md`, { tags: ['shared'] }));
    docs.push(doc('x.md', { links: ['x.md', 'y.md', 'missing.md'], title: 'Alpha beta' }), doc('y.md', { title: 'Alpha gamma' }));
    const candidates = buildRelationshipCandidates(docs);
    expect(candidates.has('x.md\u0000y.md')).toBe(true);
    expect([...candidates].some((pair) => pair.includes('d81.md'))).toBe(false);
  });
});
