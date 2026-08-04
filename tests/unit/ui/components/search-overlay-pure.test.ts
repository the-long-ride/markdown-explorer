import { describe, it, expect } from 'vitest';
import { renderHighlightedExcerpt } from '../../../../ui/src/components/Search/SearchOverlay';

describe('SearchOverlay pure functions', () => {
  describe('renderHighlightedExcerpt', () => {
    it('returns original excerpt when query is empty', () => {
      expect(renderHighlightedExcerpt('hello world', '')).toBe('hello world');
    });

    it('returns original excerpt when query is whitespace', () => {
      expect(renderHighlightedExcerpt('hello world', '   ')).toBe('hello world');
    });

    it('returns original excerpt when no match found', () => {
      expect(renderHighlightedExcerpt('hello world', 'xyz')).toBe('hello world');
    });

    it('highlights a single match', () => {
      const result = renderHighlightedExcerpt('hello world', 'world') as any[];
      expect(Array.isArray(result)).toBe(true);
      expect(result.some((p: any) => p.type === 'strong')).toBe(true);
    });

    it('highlights case-insensitively', () => {
      const result = renderHighlightedExcerpt('Hello World', 'hello') as any[];
      expect(Array.isArray(result)).toBe(true);
      expect(result.some((p: any) => p.type === 'strong')).toBe(true);
    });

    it('highlights multiple matches', () => {
      const result = renderHighlightedExcerpt('abc abc abc', 'abc') as any[];
      const strongs = result.filter((p: any) => p.type === 'strong');
      expect(strongs.length).toBe(3);
    });

    it('includes text before first match', () => {
      const result = renderHighlightedExcerpt('prefix hello suffix', 'hello') as any[];
      const firstPiece = result.find((p: any) => typeof p === 'string');
      expect(firstPiece).toContain('prefix');
    });

    it('includes text after last match', () => {
      const result = renderHighlightedExcerpt('prefix hello suffix', 'hello') as any[];
      const lastPiece = result[result.length - 1];
      if (typeof lastPiece === 'string') {
        expect(lastPiece).toContain('suffix');
      }
    });

    it('handles match at start', () => {
      const result = renderHighlightedExcerpt('hello world', 'hello') as any[];
      expect(result[0].type).toBe('strong');
    });

    it('handles match at end', () => {
      const result = renderHighlightedExcerpt('hello world', 'world') as any[];
      const strongs = result.filter((p: any) => p.type === 'strong');
      expect(strongs.length).toBe(1);
    });
  });
});

it('highlights only exact-case matches when match case is enabled', () => {
  const result = renderHighlightedExcerpt('Alpha alpha ALPHA', 'Alpha', true) as any[];
  const strongs = result.filter((piece: any) => piece.type === 'strong');
  expect(strongs).toHaveLength(1);
  expect(strongs[0].props.children).toBe('Alpha');
});

describe('buildCurrentTabResults', () => {
  it('keeps the best 20 metadata matches without sorting the whole workspace', async () => {
    const { buildCurrentTabResults } = await import('../../../../ui/src/components/Search/searchOverlayModel');
    const files = Array.from({ length: 100 }, (_, index) => ({
      fsPath: `/workspace/file-${index}.md`,
      relativePath: index < 25 ? `needle/file-${index}.md` : `other/file-${index}.md`,
      parts: ['other', `file-${index}.md`],
      fileName: index < 10 ? `needle-${index}.md` : `file-${index}.md`,
      title: index < 5 ? `Needle ${index}` : `File ${index}`,
    }));

    const results = buildCurrentTabResults(files, 'needle', false);

    expect(results).toHaveLength(20);
    expect(results.slice(0, 5).every((result) => result.score === 6)).toBe(true);
    expect(results.map((result) => result.item.fsPath)).toEqual([
      ...files.slice(0, 10).map((file) => file.fsPath),
      ...files.slice(10, 20).map((file) => file.fsPath),
    ]);
  });
});
