import { virtualFiles, getVirtualContent } from "./virtual-workspace";
import type { MdFile } from "../../ui/src/types";
import { normalizeForSearch, prepareHaystack } from "../../ui/src/utils/unicodeSearch";
import {
  MAX_WORKSPACE_SEARCH_RESULTS,
  WORKSPACE_SEARCH_BATCH_SIZE,
} from "../../ui/src/constants/limits";


// Simple content search over virtual files
interface SearchExcerpt { excerpt: string; index: number; matchLength: number }

export function makeExcerpt(text: string, index: number, matchLength: number): string {
  const before = text.slice(0, index).replace(/\s+/g, ' ').trim();
  const after = text.slice(index + matchLength).replace(/\s+/g, ' ').trim();
  const bWords = before ? before.split(' ') : [];
  const aWords = after ? after.split(' ') : [];
  const parts: string[] = [];
  if (bWords.length > 8) parts.push('...');
  parts.push(...bWords.slice(-8));
  parts.push(text.slice(index, index + matchLength));
  parts.push(...aWords.slice(0, 8));
  if (aWords.length > 8) parts.push('...');
  return parts.join(' ').trim();
}

export function searchVirtualFiles(
  query: string,
  limit = MAX_WORKSPACE_SEARCH_RESULTS,
  options: { matchCase?: boolean } = {},
): unknown[] {
  const matchCase = options.matchCase === true;
  const q = matchCase ? query.trim() : query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results: Array<{
    file: MdFile;
    score: number;
    excerpt: string;
    matchIndex: number;
    matchLength: number;
    matchOrdinal: number;
  }> = [];

  for (const file of virtualFiles) {
    const raw = getVirtualContent(file.relativePath) ?? '';
    const haystack = matchCase ? null : prepareHaystack(raw);
    const titleValue = matchCase ? file.title : normalizeForSearch(file.title);
    const fileValue = matchCase ? file.fileName : normalizeForSearch(file.fileName);
    const titleScore = titleValue.includes(q) ? 5 : 0;
    const fileScore = fileValue.includes(q) ? 4 : 0;
    let ordinal = 0;
    let nextNormIndex = 0;

    while (results.length < limit * 2) {
      const exactIndex = matchCase ? raw.indexOf(q, nextNormIndex) : -1;
      const normalizedResult = matchCase ? null : haystack?.indexOfNormalized(q, nextNormIndex);
      if (matchCase ? exactIndex < 0 : !normalizedResult) break;
      const matchIndex = matchCase ? exactIndex : normalizedResult!.match.index;
      const matchLength = matchCase ? q.length : normalizedResult!.match.matchLength;
      results.push({
        file,
        score: titleScore + fileScore + 3 - Math.min(ordinal, 20) / 100,
        excerpt: makeExcerpt(raw, matchIndex, matchLength),
        matchIndex,
        matchLength,
        matchOrdinal: ordinal,
      });
      ordinal++;
      nextNormIndex = matchCase ? matchIndex + matchLength : normalizedResult!.nextNormIndex;
      if (ordinal >= 8) break;
    }

    if (ordinal === 0 && (titleScore + fileScore) > 0) {
      results.push({
        file,
        score: titleScore + fileScore,
        excerpt: '',
        matchIndex: 0,
        matchLength: 0,
        matchOrdinal: 0,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(r => ({
    ...r.file,
    title: r.file.title,
    excerpt: r.excerpt,
    matchIndex: r.matchIndex,
    matchLength: r.matchLength,
    matchOrdinal: r.matchOrdinal,
  }));
}

export interface VirtualSearchIncrementalOptions {
  limit?: number;
  batchSize?: number;
  yieldEvery?: number;
  matchCase?: boolean;
  shouldCancel?: () => boolean;
  onBatch?: (results: readonly unknown[]) => void;
}

export async function searchVirtualFilesIncremental(
  query: string,
  options: VirtualSearchIncrementalOptions = {},
): Promise<{ total: number; truncated: boolean; cancelled: boolean }> {
  const limit = Math.max(1, Math.min(MAX_WORKSPACE_SEARCH_RESULTS, Math.floor(options.limit ?? MAX_WORKSPACE_SEARCH_RESULTS)));
  const batchSize = Math.max(1, Math.min(WORKSPACE_SEARCH_BATCH_SIZE, Math.floor(options.batchSize ?? WORKSPACE_SEARCH_BATCH_SIZE)));
  const yieldEvery = Math.max(1, Math.floor(options.yieldEvery ?? 25));
  const candidates = searchVirtualFiles(query, limit + 1, { matchCase: options.matchCase });
  const truncated = candidates.length > limit;
  const results = candidates.slice(0, limit);
  let total = 0;
  let cancelled = false;

  for (let index = 0; index < results.length; index += batchSize) {
    if (options.shouldCancel?.()) {
      cancelled = true;
      break;
    }
    options.onBatch?.(results.slice(index, index + batchSize));
    total = Math.min(index + batchSize, results.length);
    if (Math.floor(index / batchSize) % yieldEvery === 0) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  return { total, truncated, cancelled };
}
