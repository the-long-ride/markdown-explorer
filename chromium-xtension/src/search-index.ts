// =============================================================================
// chrome/src/search-index.ts — Browser-side async search index
// =============================================================================

import type { MdFile } from '../../ui/src/types';
import { resolveFileHandle } from './file-access';

interface CacheEntry {
  lastModified: number;
  size: number;
  raw: string;
  lower: string;
}

function makeSearchExcerpt(text: string, index: number, queryLength: number): string {
  const beforeText = text.slice(0, index).replace(/\s+/g, ' ').trim();
  const matchText = text.slice(index, index + queryLength).replace(/\s+/g, ' ').trim();
  const afterText = text.slice(index + queryLength).replace(/\s+/g, ' ').trim();
  const beforeWords = beforeText ? beforeText.split(' ') : [];
  const afterWords = afterText ? afterText.split(' ') : [];
  const parts: string[] = [];

  if (beforeWords.length > 10) parts.push('...');
  parts.push(...beforeWords.slice(-10));
  if (matchText) parts.push(matchText);
  parts.push(...afterWords.slice(0, 10));
  if (afterWords.length > 10) parts.push('...');

  return parts.join(' ').trim();
}

function stripKnownExtension(fileName: string): string {
  const extIdx = fileName.lastIndexOf('.');
  return extIdx !== -1 ? fileName.slice(0, extIdx) : fileName;
}

export class BrowserSearchIndex {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly rootHandle: FileSystemDirectoryHandle;

  constructor(rootHandle: FileSystemDirectoryHandle) {
    this.rootHandle = rootHandle;
  }

  private async getEntry(relativePath: string): Promise<CacheEntry | null> {
    try {
      const fileHandle = await resolveFileHandle(this.rootHandle, relativePath);
      if (!fileHandle) return null;

      const file = await fileHandle.getFile();
      const cached = this.cache.get(relativePath);
      if (cached && cached.lastModified === file.lastModified && cached.size === file.size) {
        return cached;
      }

      const raw = await file.text();
      const entry: CacheEntry = {
        lastModified: file.lastModified,
        size: file.size,
        raw,
        lower: raw.toLowerCase()
      };
      this.cache.set(relativePath, entry);
      return entry;
    } catch (err) {
      console.error('Failed to index file:', relativePath, err);
      return null;
    }
  }

  public prime(items: MdFile[]): void {
    const markdownItems = items.filter(item => {
      const lower = item.fileName.toLowerCase();
      return lower.endsWith('.md') || lower.endsWith('.mdx');
    });

    let index = 0;
    const step = async () => {
      const end = Math.min(index + 25, markdownItems.length);
      for (; index < end; index++) {
        const item = markdownItems[index];
        await this.getEntry(item.relativePath);
      }
      if (index < markdownItems.length) {
        setTimeout(step, 0);
      }
    };
    step();
  }

  public async search(query: string, items: MdFile[], limit = 80): Promise<any[]> {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery || trimmedQuery.length < 2) return [];

    const results: any[] = [];
    const maxMatchesPerFile = 8;

    for (const item of items) {
      const fileName = item.fileName;
      const relativePath = item.relativePath;
      const title = item.title || stripKnownExtension(fileName);

      const titleScore = title.toLowerCase().includes(trimmedQuery) ? 5 : 0;
      const fileNameScore = fileName.toLowerCase().includes(trimmedQuery) ? 4 : 0;
      const pathScore = relativePath.toLowerCase().includes(trimmedQuery) ? 2 : 0;
      const baseScore = titleScore + fileNameScore + pathScore;
      const contentMatches: Array<{ index: number; ordinal: number; excerpt: string }> = [];

      try {
        const entry = await this.getEntry(item.relativePath);
        if (entry) {
          let index = entry.lower.indexOf(trimmedQuery);
          let ordinal = 0;
          while (index !== -1 && contentMatches.length < maxMatchesPerFile) {
            contentMatches.push({
              index,
              ordinal,
              excerpt: makeSearchExcerpt(entry.raw, index, trimmedQuery.length)
            });
            ordinal++;
            index = entry.lower.indexOf(trimmedQuery, index + trimmedQuery.length);
          }
        }
      } catch (err) {
        console.error('Failed to search content of file:', item.relativePath, err);
      }

      if (contentMatches.length > 0) {
        for (const match of contentMatches) {
          results.push({
            ...item,
            title,
            fileName,
            relativePath,
            excerpt: match.excerpt,
            matchIndex: match.index,
            matchOrdinal: match.ordinal,
            score: baseScore + 3 - Math.min(match.ordinal, 20) / 100
          });
        }
      } else if (baseScore > 0) {
        results.push({
          ...item,
          title,
          fileName,
          relativePath,
          excerpt: '',
          score: baseScore
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(({ score, ...result }) => result);
  }
}
