import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceScanner } from './scanner';
import { isKnownSupportedFilePath, isMarkdownFilePath, isTextDocumentFilePath, stripKnownExtension } from './documentConversion';
import type { MdFile, WorkspaceSearchResult } from '../types';
import { normalizeForSearch, unicodeIndexOf } from './unicodeSearch';

export function makeSearchExcerpt(text: string, index: number, matchLength: number) {
  const beforeWords = text.slice(0, index).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const matchText = text.slice(index, index + matchLength).replace(/\s+/g, ' ').trim();
  const afterWords = text.slice(index + matchLength).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return [...(beforeWords.length > 10 ? ['...'] : []), ...beforeWords.slice(-10), ...(matchText ? [matchText] : []), ...afterWords.slice(0, 10), ...(afterWords.length > 10 ? ['...'] : [])].join(' ').trim();
}

export function searchMarkdownItems(rawQuery: string, rawItems: readonly WorkspaceSearchResult[] | undefined, flat: MdFile[], limit = 80): readonly WorkspaceSearchResult[] {
  const query = String(rawQuery || '').trim().toLowerCase();
  if (query.length < 2) return [];
  const items = rawItems?.length ? rawItems : flat;
  const results: Array<WorkspaceSearchResult & { score: number }> = [];
  for (const item of items) {
    if (!item.fsPath || !fs.existsSync(item.fsPath) || !isKnownSupportedFilePath(item.fsPath)) continue;
    const fileName = item.fileName || path.basename(item.fsPath);
    const relativePath = item.relativePath || fileName;
    const title = item.title || stripKnownExtension(fileName);
    const baseScore = (normalizeForSearch(title).includes(query) ? 5 : 0) + (normalizeForSearch(fileName).includes(query) ? 4 : 0) + (normalizeForSearch(relativePath).includes(query) ? 2 : 0);
    const raw = isMarkdownFilePath(item.fsPath) || isTextDocumentFilePath(item.fsPath) ? WorkspaceScanner.readFile(item.fsPath) : '';
    let fromIndex = 0;
    let ordinal = 0;
    let match = raw ? unicodeIndexOf(raw, query, fromIndex) : null;
    while (match && ordinal < 8) {
      results.push({ fsPath: item.fsPath, title, fileName, relativePath, excerpt: makeSearchExcerpt(raw, match.index, match.matchLength), matchIndex: match.index, matchOrdinal: ordinal, matchLength: match.matchLength, score: baseScore + 3 - Math.min(ordinal, 20) / 100 });
      ordinal += 1; fromIndex = match.index + match.matchLength; match = unicodeIndexOf(raw, query, fromIndex);
    }
    if (!ordinal && baseScore > 0) results.push({ fsPath: item.fsPath, title, fileName, relativePath, excerpt: '', score: baseScore });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ score, ...result }) => result);
}
