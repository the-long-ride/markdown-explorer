import { normalizeForSearch, unicodeIndexOf } from '../../utils/unicodeSearch';
import type { MdFile, WorkspaceSearchResult } from '../../types';

export interface CrossTabSearchItem {
  tabId: string;
  tabLabel: string;
  fsPath: string;
  title: string;
  fileName: string;
  relativePath: string;
  excerpt?: string;
  matchIndex?: number;
  matchOrdinal?: number;
  lineNumber?: number;
}

export type SearchResultItem = WorkspaceSearchResult | CrossTabSearchItem;

export interface WorkspaceChoice {
  id: string;
  label: string;
  path?: string;
}

export function toWorkspaceSearchResult(file: MdFile): WorkspaceSearchResult {
  return {
    fsPath: file.fsPath,
    title: file.title,
    fileName: file.fileName,
    relativePath: file.relativePath,
  };
}

export function buildWorkspaceChoices(
  crossTabItems: readonly CrossTabSearchItem[] | undefined,
  currentLabel: string,
  currentPath: string | undefined,
  allLabel: string,
): WorkspaceChoice[] {
  if (!crossTabItems) return [{ id: 'current', label: currentLabel, path: currentPath }];

  const byId = new Map<string, WorkspaceChoice>();
  for (const item of crossTabItems) {
    if (!byId.has(item.tabId)) byId.set(item.tabId, { id: item.tabId, label: item.tabLabel });
  }
  return [{ id: 'all', label: allLabel }, ...byId.values()];
}

export function buildCurrentTabResults(
  files: readonly MdFile[],
  query: string,
  matchCase: boolean,
): Array<{ item: WorkspaceSearchResult; score: number }> {
  if (query.length < 2) return [];

  const resultLimit = 20;
  const scoreBuckets: Array<Array<{ item: WorkspaceSearchResult; score: number }>> =
    Array.from({ length: 7 }, () => []);
  for (const file of files) {
    const score =
      (metadataIncludes(file.title, query, matchCase) ? 3 : 0) +
      (metadataIncludes(file.fileName, query, matchCase) ? 2 : 0) +
      (metadataIncludes(file.relativePath, query, matchCase) ? 1 : 0);
    if (score > 0 && scoreBuckets[score].length < resultLimit) {
      scoreBuckets[score].push({ item: toWorkspaceSearchResult(file), score });
    }
  }

  const results: Array<{ item: WorkspaceSearchResult; score: number }> = [];
  for (let score = scoreBuckets.length - 1; score > 0 && results.length < resultLimit; score -= 1) {
    results.push(...scoreBuckets[score].slice(0, resultLimit - results.length));
  }
  return results;
}

function findExcerptMatch(
  excerpt: string,
  needle: string,
  fromIndex: number,
  matchCase: boolean,
): { index: number; matchLength: number } | null {
  if (matchCase) {
    const index = excerpt.indexOf(needle, fromIndex);
    return index < 0 ? null : { index, matchLength: needle.length };
  }
  return unicodeIndexOf(excerpt, needle, fromIndex);
}

export function renderHighlightedExcerpt(excerpt: string, query: string, matchCase = false) {
  const needle = query.trim().replace(/\s+/g, ' ');
  if (!needle) return excerpt;

  const pieces = [];
  let cursor = 0;
  let result = findExcerptMatch(excerpt, needle, 0, matchCase);
  if (!result) return excerpt;

  while (result) {
    const matchIndex = result.index;
    const matchLength = result.matchLength;
    if (matchIndex > cursor) pieces.push(excerpt.slice(cursor, matchIndex));

    const matchEnd = matchIndex + matchLength;
    pieces.push(
      <strong key={`${matchIndex}-${matchEnd}`}>
        {excerpt.slice(matchIndex, matchEnd)}
      </strong>,
    );

    cursor = matchEnd;
    result = findExcerptMatch(excerpt, needle, cursor, matchCase);
  }

  if (cursor < excerpt.length) pieces.push(excerpt.slice(cursor));
  return pieces;
}

export function resultKey(item: SearchResultItem): string {
  const tabId = 'tabId' in item ? item.tabId : 'current';
  return `${tabId}:${item.fsPath}:${item.matchIndex ?? 'file'}:${item.matchOrdinal ?? 0}`;
}

export function isCrossTabItem(item: SearchResultItem): item is CrossTabSearchItem {
  return 'tabId' in item;
}

export function metadataIncludes(value: string | undefined, query: string, matchCase: boolean): boolean {
  if (!value) return false;
  return matchCase
    ? value.includes(query)
    : normalizeForSearch(value).includes(normalizeForSearch(query));
}
