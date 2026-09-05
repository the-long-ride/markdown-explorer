import { describe, expect, it, vi } from 'vitest';
import {
  buildNearDuplicateCandidates,
  buildPassageFingerprints,
  buildSectionFingerprints,
  findDuplicateGroups,
  normalizeExactDuplicateSource,
  scoreNearDuplicate,
} from '../../../../ui/src/insights/duplicates';

describe('workspace insights duplicates', () => {
  it('normalizes BOM, line endings, and trailing whitespace for exact duplicates', () => {
    expect(normalizeExactDuplicateSource('\uFEFF# A  \r\ntext\t\r\n'))
      .toBe(normalizeExactDuplicateSource('# A\ntext\n'));
  });

  it('ignores trivial sections and fingerprints substantive repeated sections', () => {
    const short = '# A\nTiny repeated note.';
    expect(buildSectionFingerprints('a.md', short)).toHaveLength(0);
    const body = Array.from({ length: 30 }, (_, i) => `meaningful-token-${i}`).join(' ');
    const sections = buildSectionFingerprints('a.md', `# Auth\n${body}`);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ path: 'a.md', heading: 'Auth' });
  });

  it('builds bounded passage windows with overlap and suppresses boilerplate-only windows', () => {
    const tokens = Array.from({ length: 260 }, (_, i) => `token-${i}`);
    const passages = buildPassageFingerprints('a.md', tokens.join(' '));
    expect(passages.length).toBeGreaterThanOrEqual(3);
    expect(passages.length).toBeLessThan(10);
    expect(buildPassageFingerprints('boiler.md', 'copyright all rights reserved '.repeat(80))).toHaveLength(0);
  });

  it('scores near duplicates by meaningful token overlap', () => {
    const a = { path: 'a.md', normalizedTokens: ['refresh', 'token', 'rotation', 'security'] };
    const b = { path: 'b.md', normalizedTokens: ['refresh', 'token', 'rotation', 'security', 'guide'] };
    const c = { path: 'c.md', normalizedTokens: ['garden', 'plants', 'watering'] };
    expect(scoreNearDuplicate(a, b)).toBeGreaterThan(0.75);
    expect(scoreNearDuplicate(a, c)).toBe(0);
  });

  it('uses sparse candidate buckets instead of comparing every document pair', () => {
    const corpus = Array.from({ length: 2_000 }, (_, index) => ({
      path: `doc-${index}.md`,
      normalizedTokens: [`topic-${index % 200}`, `unique-${index}`],
    }));
    const scorer = vi.fn(scoreNearDuplicate);
    findDuplicateGroups(corpus, { scorePair: scorer, threshold: 0.90 });
    expect(scorer.mock.calls.length).toBeLessThan(20_000);
    expect(buildNearDuplicateCandidates(corpus).size).toBeLessThan(20_000);
  });

  it('groups exact and near duplicates while honoring suppressions', () => {
    const corpus = [
      { path: 'a.md', source: '# A\nSame body', normalizedTokens: ['same', 'body', 'refresh', 'tokens'] },
      { path: 'b.md', source: '# A\r\nSame body  \r\n', normalizedTokens: ['same', 'body', 'refresh', 'tokens'] },
      { path: 'c.md', source: '# C\nOther', normalizedTokens: ['same', 'body', 'refresh', 'tokens', 'guide'] },
    ];
    const groups = findDuplicateGroups(corpus, { threshold: 0.75 });
    expect(groups.some(group => group.kind === 'exact' && group.paths.includes('a.md') && group.paths.includes('b.md'))).toBe(true);
    expect(findDuplicateGroups(corpus, { threshold: 0.75, suppressedGroupKeys: groups.map(group => group.key) })).toHaveLength(0);
  });
});
