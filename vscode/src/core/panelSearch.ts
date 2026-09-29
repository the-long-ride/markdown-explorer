import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceScanner } from './scanner';
import { isKnownSupportedFilePath, isMarkdownFilePath, isTextDocumentFilePath, stripKnownExtension } from './documentConversion';
import type { MdFile, WorkspaceSearchResult } from '../types';
import { normalizeForSearch, unicodeIndexOf } from './unicodeSearch';
import { MAX_WORKSPACE_MATCHES_PER_FILE, MAX_WORKSPACE_SEARCH_RESULTS, WORKSPACE_SEARCH_BATCH_SIZE } from '../../../ui/src/constants/limits';

export interface IncrementalSearchOptions {
  limit?: number;
  batchSize?: number;
  yieldEvery?: number;
  matchCase?: boolean;
  shouldCancel?: () => boolean;
  onBatch?: (results: readonly WorkspaceSearchResult[]) => void;
}

export interface IncrementalSearchSummary {
  total: number;
  truncated: boolean;
  cancelled: boolean;
}

export function makeSearchExcerpt(text: string, index: number, matchLength: number) {
  const beforeWords = text.slice(0, index).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const matchText = text.slice(index, index + matchLength).replace(/\s+/g, ' ').trim();
  const afterWords = text.slice(index + matchLength).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return [...(beforeWords.length > 10 ? ['...'] : []), ...beforeWords.slice(-10), ...(matchText ? [matchText] : []), ...afterWords.slice(0, 10), ...(afterWords.length > 10 ? ['...'] : [])].join(' ').trim();
}

export function searchMarkdownItems(
  rawQuery: string,
  rawItems: readonly WorkspaceSearchResult[] | undefined,
  flat: MdFile[],
  limit = MAX_WORKSPACE_SEARCH_RESULTS,
  options: { matchCase?: boolean } = {},
): readonly WorkspaceSearchResult[] {
  const trimmedQuery = String(rawQuery || '').trim();
  if (trimmedQuery.length < 2) return [];
  const matchCase = Boolean(options.matchCase);
  const query = matchCase ? trimmedQuery : normalizeForSearch(trimmedQuery);
  const items = Array.isArray(rawItems) ? rawItems : flat;
  const results: Array<WorkspaceSearchResult & { score: number }> = [];
  for (const item of items) {
    if (!item.fsPath || !fs.existsSync(item.fsPath) || !isKnownSupportedFilePath(item.fsPath)) continue;
    const fileName = item.fileName || path.basename(item.fsPath);
    const relativePath = item.relativePath || fileName;
    const title = item.title || stripKnownExtension(fileName);
    const includesNeedle = (value: string) => matchCase
      ? value.includes(query)
      : normalizeForSearch(value).includes(query);
    const baseScore = (includesNeedle(title) ? 5 : 0) + (includesNeedle(fileName) ? 4 : 0) + (includesNeedle(relativePath) ? 2 : 0);
    const raw = isMarkdownFilePath(item.fsPath) || isTextDocumentFilePath(item.fsPath) ? WorkspaceScanner.readFile(item.fsPath) : '';
    let fromIndex = 0;
    let ordinal = 0;
    const findMatch = () => {
      if (!raw) return null;
      if (!matchCase) return unicodeIndexOf(raw, query, fromIndex);
      const index = raw.indexOf(query, fromIndex);
      return index === -1 ? null : { index, matchLength: query.length };
    };
    let match = findMatch();
    while (match && ordinal < 8) {
      results.push({ fsPath: item.fsPath, title, fileName, relativePath, excerpt: makeSearchExcerpt(raw, match.index, match.matchLength), matchIndex: match.index, matchOrdinal: ordinal, matchLength: match.matchLength, score: baseScore + 3 - Math.min(ordinal, 20) / 100 });
      ordinal += 1; fromIndex = match.index + match.matchLength; match = findMatch();
    }
    if (!ordinal && baseScore > 0) results.push({ fsPath: item.fsPath, title, fileName, relativePath, excerpt: '', score: baseScore });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ score, ...result }) => result);
}

export async function searchMarkdownItemsIncremental(
  rawQuery: string,
  rawItems: readonly WorkspaceSearchResult[] | undefined,
  flat: MdFile[],
  options: IncrementalSearchOptions = {},
): Promise<IncrementalSearchSummary> {
  const trimmedQuery = String(rawQuery || '').trim();
  if (trimmedQuery.length < 2) return { total: 0, truncated: false, cancelled: false };

  const matchCase = Boolean(options.matchCase);
  const query = matchCase ? trimmedQuery : normalizeForSearch(trimmedQuery);
  const items = Array.isArray(rawItems) ? rawItems : flat;
  const limit = Math.max(1, options.limit ?? MAX_WORKSPACE_SEARCH_RESULTS);
  const batchSize = Math.max(1, options.batchSize ?? WORKSPACE_SEARCH_BATCH_SIZE);
  const yieldEvery = Math.max(1, options.yieldEvery ?? 25);
  const shouldCancel = options.shouldCancel ?? (() => false);
  const onBatch = options.onBatch ?? (() => undefined);
  const batch: Array<WorkspaceSearchResult & { score: number }> = [];
  let total = 0;
  let truncated = false;
  let cancelled = false;
  let processed = 0;

  const flushBatch = () => {
    if (batch.length === 0) return;
    batch.sort((left, right) => right.score - left.score);
    onBatch(batch.splice(0).map(({ score: _score, ...result }) => result));
  };

  const pushResult = (result: WorkspaceSearchResult & { score: number }) => {
    if (total >= limit) {
      truncated = true;
      return false;
    }
    batch.push(result);
    total += 1;
    if (batch.length >= batchSize) flushBatch();
    if (total >= limit) truncated = true;
    return true;
  };

  searchItems:
  for (const item of items) {
    if (shouldCancel()) {
      cancelled = true;
      break;
    }
    if (!item.fsPath || !fs.existsSync(item.fsPath) || !isKnownSupportedFilePath(item.fsPath)) continue;

    const fileName = item.fileName || path.basename(item.fsPath);
    const relativePath = item.relativePath || fileName;
    const title = item.title || stripKnownExtension(fileName);
    const includesNeedle = (value: string) => matchCase
      ? value.includes(query)
      : normalizeForSearch(value).includes(query);
    const baseScore = (includesNeedle(title) ? 5 : 0) + (includesNeedle(fileName) ? 4 : 0) + (includesNeedle(relativePath) ? 2 : 0);
    const raw = isMarkdownFilePath(item.fsPath) || isTextDocumentFilePath(item.fsPath) ? WorkspaceScanner.readFile(item.fsPath) : '';
    let fromIndex = 0;
    let ordinal = 0;
    const findMatch = () => {
      if (!raw) return null;
      if (!matchCase) return unicodeIndexOf(raw, query, fromIndex);
      const index = raw.indexOf(query, fromIndex);
      return index === -1 ? null : { index, matchLength: query.length };
    };
    let match = findMatch();
    while (match && ordinal < MAX_WORKSPACE_MATCHES_PER_FILE) {
      if (!pushResult({
        fsPath: item.fsPath,
        title,
        fileName,
        relativePath,
        excerpt: makeSearchExcerpt(raw, match.index, match.matchLength),
        matchIndex: match.index,
        matchOrdinal: ordinal,
        matchLength: match.matchLength,
        score: baseScore + 3 - Math.min(ordinal, 20) / 100,
      })) break searchItems;
      ordinal += 1;
      fromIndex = match.index + match.matchLength;
      match = findMatch();
    }
    if (!ordinal && baseScore > 0 && !pushResult({
      fsPath: item.fsPath,
      title,
      fileName,
      relativePath,
      excerpt: '',
      score: baseScore,
    })) break;

    processed += 1;
    if (processed % yieldEvery === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (shouldCancel()) {
        cancelled = true;
        break;
      }
    }
    if (truncated) break;
  }

  flushBatch();
  return { total, truncated, cancelled };
}
