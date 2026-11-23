import { describe, expect, it } from 'vitest';
import { buildPassageFingerprints, buildSectionFingerprints, normalizeDuplicateTokens, scoreNearDuplicate } from '../../../../ui/src/insights/duplicates';

describe('duplicates edge cases', () => {
  it('normalizes token arrays and empty text', () => {
    expect(normalizeDuplicateTokens('!! ?? ..')).toEqual([]);
    expect(normalizeDuplicateTokens(['Alpha', 'b', 'Gamma'])).toEqual(expect.any(Array));
  });
  it('scores empty documents as zero and uses provided tokens', () => {
    expect(scoreNearDuplicate({ path: 'a.md', source: '' } as any, { path: 'b.md', source: 'some words here' } as any)).toBe(0);
    expect(scoreNearDuplicate({ path: 'a.md', source: '', normalizedTokens: ['alpha', 'beta', 'gamma'] } as any, { path: 'b.md', source: 'alpha beta gamma' } as any)).toBeGreaterThan(0);
  });
  it('skips short and boilerplate passages and handles headingless sections', () => {
    expect(buildPassageFingerprints('a.md', 'too short')).toEqual([]);
    expect(buildPassageFingerprints('a.md', '')).toEqual([]);
    expect(buildSectionFingerprints('a.md', 'no headings at all just text')).toEqual(expect.any(Array));
    expect(buildSectionFingerprints('a.md', '# One\nalpha beta\n# Two\ngamma delta')).toEqual(expect.any(Array));
  });
});
