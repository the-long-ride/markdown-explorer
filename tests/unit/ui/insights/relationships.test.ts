import { describe, expect, it } from 'vitest';
import {
  RELATIONSHIP_PRESETS,
  buildRelationshipCandidates,
  normalizeRelationshipWeights,
  scoreRelatedDocument,
} from '../../../../ui/src/insights/relationships';

function fixtureDocument(overrides: Partial<any> = {}) {
  return {
    path: overrides.path ?? 'a.md',
    title: overrides.title ?? 'Guide',
    tags: overrides.tags ?? [],
    headings: overrides.headings ?? [],
    links: overrides.links ?? [],
    terms: overrides.terms ?? [],
    terminologySignatures: overrides.terminologySignatures ?? [],
  };
}

describe('insights relationships', () => {
  it('uses approved default weights', () => {
    expect(RELATIONSHIP_PRESETS.default).toEqual({ links: 35, tags: 20, headings: 15, title: 10, terminology: 20 });
  });

  it('normalizes custom weights to 100 without negative contributions', () => {
    expect(normalizeRelationshipWeights({ links: 2, tags: 2, headings: 2, title: 2, terminology: 2 }))
      .toEqual({ links: 20, tags: 20, headings: 20, title: 20, terminology: 20 });
    expect(Object.values(normalizeRelationshipWeights({ links: -5, tags: 100, headings: 0, title: 0, terminology: 0 })).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  it('returns actual evidence while persisting only hashed terminology', () => {
    const result = scoreRelatedDocument(
      fixtureDocument({ path: 'a.md', tags: ['api'], terms: ['refresh token'] }),
      fixtureDocument({ path: 'b.md', tags: ['api'], terms: ['refresh token'] }),
      RELATIONSHIP_PRESETS.default,
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.evidence.sharedTags).toContain('api');
    expect(result.evidence.sharedTerms).toContain('refresh token');
    expect(result.persisted.terminologySignatures.every((value: string) => /^[a-f0-9]{16,}$/i.test(value))).toBe(true);
    expect(JSON.stringify(result.persisted)).not.toContain('refresh token');
  });

  it('offers link, tag, and terminology focused presets with distinct priorities', () => {
    expect(RELATIONSHIP_PRESETS['link-focused'].links).toBeGreaterThan(RELATIONSHIP_PRESETS.default.links);
    expect(RELATIONSHIP_PRESETS['tag-focused'].tags).toBeGreaterThan(RELATIONSHIP_PRESETS.default.tags);
    expect(RELATIONSHIP_PRESETS['terminology-focused'].terminology).toBeGreaterThan(RELATIONSHIP_PRESETS.default.terminology);
  });

  it('generates sparse candidates from inverted signals and omits no-signal pairs', () => {
    const corpus = Array.from({ length: 2_000 }, (_, i) => fixtureDocument({
      path: `doc-${i}.md`,
      tags: [`tag-${i % 200}`],
      headings: [`Heading ${i % 400}`],
      terms: [`term-${i % 500}`],
    }));
    const candidates = buildRelationshipCandidates(corpus);
    expect(candidates.size).toBeLessThan(100_000);
    const isolated = buildRelationshipCandidates([
      fixtureDocument({ path: 'a.md', tags: ['a'] }),
      fixtureDocument({ path: 'b.md', tags: ['b'] }),
    ]);
    expect(isolated.size).toBe(0);
  });
});
