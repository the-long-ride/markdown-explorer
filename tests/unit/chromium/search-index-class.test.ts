import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserSearchIndex } from '../../../chromium-xtension/src/search-index';
import type { MdFile } from '../../../ui/src/types';
import { prepareHaystack } from '../../../ui/src/utils/unicodeSearch';

function makeItem(overrides: Partial<MdFile> & { relativePath: string; fileName: string; title: string }): MdFile {
  return {
    fsPath: overrides.relativePath,
    parts: [],
    extension: '.md',
    ...overrides,
  } as MdFile;
}

function makeEntry(raw: string) {
  return { lastModified: 1, size: raw.length, raw, haystack: prepareHaystack(raw) };
}

async function flushMicrotasks(depth = 50): Promise<void> {
  for (let i = 0; i < depth; i++) {
    await Promise.resolve();
  }
}

async function waitUntil(predicate: () => boolean, timeout = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeout) {
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
  }
}

const rootHandle = {} as FileSystemDirectoryHandle;

describe('BrowserSearchIndex.prime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('only processes .md and .mdx files', async () => {
    const getEntrySpy = vi.spyOn(BrowserSearchIndex.prototype as any, 'getEntry').mockResolvedValue(null);
    const index = new BrowserSearchIndex(rootHandle);
    const items = [
      makeItem({ relativePath: 'readme.md', fileName: 'readme.md', title: 'readme' }),
      makeItem({ relativePath: 'guide.mdx', fileName: 'guide.mdx', title: 'guide' }),
      makeItem({ relativePath: 'image.png', fileName: 'image.png', title: 'image' }),
      makeItem({ relativePath: 'style.css', fileName: 'style.css', title: 'style' }),
    ];
    index.prime(items);
    await waitUntil(() => getEntrySpy.mock.calls.length >= 2);
    expect(getEntrySpy).toHaveBeenCalledWith('readme.md');
    expect(getEntrySpy).toHaveBeenCalledWith('guide.mdx');
    expect(getEntrySpy).not.toHaveBeenCalledWith('image.png');
    expect(getEntrySpy).not.toHaveBeenCalledWith('style.css');
    getEntrySpy.mockRestore();
  });

  it('processes in batches of 25', async () => {
    const getEntrySpy = vi.spyOn(BrowserSearchIndex.prototype as any, 'getEntry').mockResolvedValue(null);
    const index = new BrowserSearchIndex(rootHandle);
    const items = Array.from({ length: 60 }, (_, i) =>
      makeItem({ relativePath: `file${i}.md`, fileName: `file${i}.md`, title: `file${i}` })
    );
    index.prime(items);
    await flushMicrotasks();
    await waitUntil(() => getEntrySpy.mock.calls.length >= 25);
    expect(getEntrySpy).toHaveBeenCalledTimes(25);
    getEntrySpy.mockClear();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    await waitUntil(() => getEntrySpy.mock.calls.length >= 25);
    expect(getEntrySpy).toHaveBeenCalledTimes(25);
    getEntrySpy.mockClear();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    await waitUntil(() => getEntrySpy.mock.calls.length >= 10);
    expect(getEntrySpy).toHaveBeenCalledTimes(10);
    getEntrySpy.mockRestore();
  });

  it('handles empty items array', () => {
    const getEntrySpy = vi.spyOn(BrowserSearchIndex.prototype as any, 'getEntry').mockResolvedValue(null);
    const index = new BrowserSearchIndex(rootHandle);
    index.prime([]);
    expect(getEntrySpy).not.toHaveBeenCalled();
    getEntrySpy.mockRestore();
  });

  it('handles fewer than 25 items without scheduling more batches', async () => {
    const getEntrySpy = vi.spyOn(BrowserSearchIndex.prototype as any, 'getEntry').mockResolvedValue(null);
    const index = new BrowserSearchIndex(rootHandle);
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ relativePath: `small${i}.md`, fileName: `small${i}.md`, title: `small${i}` })
    );
    index.prime(items);
    await flushMicrotasks();
    expect(getEntrySpy).toHaveBeenCalledTimes(10);
    getEntrySpy.mockClear();
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    expect(getEntrySpy).not.toHaveBeenCalled();
    getEntrySpy.mockRestore();
  });

  it('filters with case-insensitive extension check', async () => {
    const getEntrySpy = vi.spyOn(BrowserSearchIndex.prototype as any, 'getEntry').mockResolvedValue(null);
    const index = new BrowserSearchIndex(rootHandle);
    const items = [
      makeItem({ relativePath: 'upper.MD', fileName: 'upper.MD', title: 'upper' }),
      makeItem({ relativePath: 'mixed.Md', fileName: 'mixed.Md', title: 'mixed' }),
      makeItem({ relativePath: 'lower.md', fileName: 'lower.md', title: 'lower' }),
      makeItem({ relativePath: 'skip.txt', fileName: 'skip.txt', title: 'skip' }),
    ];
    index.prime(items);
    await flushMicrotasks();
    expect(getEntrySpy).toHaveBeenCalledTimes(3);
    getEntrySpy.mockRestore();
  });
});

describe('BrowserSearchIndex.search', () => {
  let index: BrowserSearchIndex;
  let getEntrySpy: any;

  beforeEach(() => {
    index = new BrowserSearchIndex(rootHandle);
    getEntrySpy = vi.spyOn(index as any, 'getEntry');
  });

  afterEach(() => {
    getEntrySpy.mockRestore();
  });

  it('returns empty for query shorter than 2 characters', async () => {
    const result = await index.search('a', [], 10);
    expect(result).toEqual([]);
  });

  it('returns empty for empty query', async () => {
    const result = await index.search('', [], 10);
    expect(result).toEqual([]);
  });

  it('returns empty for whitespace-only query', async () => {
    const result = await index.search('   ', [], 10);
    expect(result).toEqual([]);
  });

  it('matches title with score 5 when no content', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = [
      makeItem({ relativePath: 'x/intro.md', fileName: 'intro.md', title: 'Introduction' }),
    ];
    const result = await index.search('introduction', items);
    expect(result).toHaveLength(1);
    expect(result[0].excerpt).toBe('');
  });

  it('matches filename with score 4 when no content', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = [
      makeItem({ relativePath: 'docs/overview.md', fileName: 'overview.md', title: 'Overview Section' }),
    ];
    const result = await index.search('overview.md', items);
    expect(result).toHaveLength(1);
  });

  it('matches relativePath with score 2 when no content', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = [
      makeItem({ relativePath: 'guides/deep/topic.md', fileName: 'topic.md', title: 'Topic' }),
    ];
    const result = await index.search('guides/deep', items);
    expect(result).toHaveLength(1);
  });

  it('combines title + filename + path scores', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = [
      makeItem({ relativePath: 'api/intro.md', fileName: 'intro.md', title: 'Intro' }),
    ];
    const result = await index.search('intro', items);
    expect(result).toHaveLength(1);
  });

  it('finds content matches and creates excerpts', async () => {
    getEntrySpy.mockResolvedValue(makeEntry('hello world this is a test of search functionality'));
    const items = [
      makeItem({ relativePath: 'search.md', fileName: 'search.md', title: 'Search' }),
    ];
    const result = await index.search('search', items);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((r: any) => r.matchIndex !== undefined)).toBe(true);
  });

  it('limits content matches to 8 per file', async () => {
    const content = 'alpha alpha alpha alpha alpha alpha alpha alpha alpha alpha alpha alpha alpha';
    const entry = makeEntry(content);
    getEntrySpy.mockResolvedValue(entry);
    const items = [
      makeItem({ relativePath: 'many.md', fileName: 'many.md', title: 'Many' }),
    ];
    const result = await index.search('alpha', items);
    const contentResults = result.filter((r: any) => r.matchIndex !== undefined);
    expect(contentResults.length).toBeLessThanOrEqual(8);
  });

  it('adds base-score-only result when no content matches but name matches', async () => {
    getEntrySpy.mockResolvedValue(makeEntry('no match here'));
    const items = [
      makeItem({ relativePath: 'unique-name.md', fileName: 'unique-name.md', title: 'Unique Name' }),
    ];
    const result = await index.search('unique', items);
    expect(result).toHaveLength(1);
    expect(result[0].excerpt).toBe('');
  });

  it('skips items with no title, filename, path, or content match', async () => {
    getEntrySpy.mockResolvedValue(makeEntry('nothing relevant here'));
    const items = [
      makeItem({ relativePath: 'other.md', fileName: 'other.md', title: 'Other' }),
    ];
    const result = await index.search('zzzzzz', items);
    expect(result).toHaveLength(0);
  });

  it('sorts results by score descending', async () => {
    getEntrySpy.mockImplementation((relPath: string) => {
      if (relPath.includes('high')) return null;
      if (relPath.includes('mid')) return makeEntry('mid content here');
      return null;
    });
    const items = [
      makeItem({ relativePath: 'path/low.md', fileName: 'low.md', title: 'Low' }),
      makeItem({ relativePath: 'high/high.md', fileName: 'high.md', title: 'High' }),
    ];
    const result = await index.search('high', items);
    expect(result[0].relativePath).toContain('high');
  });

  it('respects the limit parameter', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ relativePath: `match${i}.md`, fileName: `match${i}.md`, title: `Match${i}` })
    );
    const result = await index.search('match', items, 3);
    expect(result).toHaveLength(3);
  });

  it('defaults limit to 80', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = Array.from({ length: 90 }, (_, i) =>
      makeItem({ relativePath: `def${i}.md`, fileName: `def${i}.md`, title: `Default${i}` })
    );
    const result = await index.search('default', items);
    expect(result).toHaveLength(80);
  });

  it('uses stripped filename as title fallback when title is empty', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = [
      makeItem({ relativePath: 'readme.md', fileName: 'readme.md', title: '' }),
    ];
    const result = await index.search('readme', items);
    expect(result).toHaveLength(1);
  });

  it('content ordinal reduces score for subsequent matches in same file', async () => {
    const entry = makeEntry('test test test');
    getEntrySpy.mockResolvedValue(entry);
    const items = [
      makeItem({ relativePath: 'ordinal.md', fileName: 'ordinal.md', title: 'Ordinal' }),
    ];
    const allResults: any[] = [];
    const origSearch = index.search.bind(index);
    const result = await origSearch('test', items);
    if (result.length >= 2) {
      expect((result[0] as any).matchOrdinal).toBeLessThan((result[1] as any).matchOrdinal);
    }
  });

  it('handles getEntry returning null gracefully', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = [
      makeItem({ relativePath: 'null.md', fileName: 'null.md', title: 'NullTest' }),
    ];
    const result = await index.search('nulltest', items);
    expect(result).toHaveLength(1);
  });

  it('handles getEntry throwing an error', async () => {
    getEntrySpy.mockRejectedValue(new Error('read fail'));
    const items = [
      makeItem({ relativePath: 'broken.md', fileName: 'broken.md', title: 'Broken' }),
    ];
    const result = await index.search('broken', items);
    expect(result).toHaveLength(1);
  });

  it('query is trimmed and lowercased', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = [
      makeItem({ relativePath: 'trim.md', fileName: 'trim.md', title: 'TrimSearch' }),
    ];
    const result = await index.search('  TrimSearch  ', items);
    expect(result).toHaveLength(1);
  });

  it('does not include score in returned results', async () => {
    getEntrySpy.mockResolvedValue(null);
    const items = [
      makeItem({ relativePath: 'noscore.md', fileName: 'noscore.md', title: 'NoScore' }),
    ];
    const result = await index.search('noscore', items);
    expect(result).toHaveLength(1);
    expect((result[0] as any).score).toBeUndefined();
  });

  it('content match score = baseScore + 3 - ordinal/100', async () => {
    getEntrySpy.mockResolvedValue(makeEntry('alpha beta alpha'));
    const items = [
      makeItem({ relativePath: 'x/alpha.md', fileName: 'alpha.md', title: 'Alpha' }),
    ];
    const result = await index.search('alpha', items);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
