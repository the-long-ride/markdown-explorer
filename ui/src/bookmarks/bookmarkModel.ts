import { BOOKMARK_DOCUMENT_VERSION, type BookmarkDocument, type BookmarkObjectIdentity, type BookmarkRecord, type BookmarkResolution, type BookmarkSelectionCapture, type BookmarkSortMode, type BookmarkSourceAnchor, type BookmarkTargetKind, type BookmarkWorkspaceGroup, type OpenBookmarkWorkspace } from './types.ts';

const CONTEXT_LENGTH = 80;

export function getBookmarkWorkspaceKey(workspacePath: string | undefined, workspaceName: string): string {
  const path = String(workspacePath ?? '').trim();
  return path || String(workspaceName ?? '').trim();
}

function findOccurrences(text: string, query: string): number[] {
  if (!query) return [];
  const occurrences: number[] = [];
  let from = 0;
  while (from <= text.length - query.length) {
    const index = text.indexOf(query, from);
    if (index < 0) break;
    occurrences.push(index);
    from = index + Math.max(1, query.length);
  }
  return occurrences;
}

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function contextFor(source: string, start: number, end: number): Pick<BookmarkSourceAnchor, 'prefix' | 'suffix'> {
  return {
    prefix: source.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: source.slice(end, Math.min(source.length, end + CONTEXT_LENGTH)),
  };
}

function createSourceAnchor(source: string, sourceStart: number, sourceEnd: number): BookmarkSourceAnchor | null {
  const start = Number.isFinite(sourceStart) ? Math.max(0, Math.floor(sourceStart)) : -1;
  const end = Number.isFinite(sourceEnd) ? Math.min(source.length, Math.floor(sourceEnd)) : -1;
  if (start < 0 || end <= start) return null;
  const fragment = source.slice(start, end);
  if (!fragment.trim()) return null;
  const occurrences = findOccurrences(source, fragment);
  const occurrence = Math.max(0, occurrences.indexOf(start));
  return {
    start,
    end,
    fragment,
    fingerprint: fingerprint(fragment),
    occurrence,
    ...contextFor(source, start, end),
  };
}

export function captureBookmarkSelection(
  documentText: string,
  selectedText: string,
  selectedStart: number,
): BookmarkSelectionCapture | null {
  const selection = String(selectedText ?? '').trim();
  if (!selection) return null;
  const source = String(documentText ?? '');
  const occurrences = findOccurrences(source, selection);
  const requestedStart = Number.isFinite(selectedStart) ? Math.max(0, Math.floor(selectedStart)) : -1;
  const matchIndex = occurrences.includes(requestedStart)
    ? requestedStart
    : occurrences.find((index) => index >= requestedStart) ?? occurrences[0] ?? -1;
  if (matchIndex < 0) return null;
  return {
    selectedText: selection,
    matchOrdinal: occurrences.indexOf(matchIndex),
    matchIndex,
    prefix: source.slice(Math.max(0, matchIndex - CONTEXT_LENGTH), matchIndex),
    suffix: source.slice(matchIndex + selection.length, matchIndex + selection.length + CONTEXT_LENGTH),
  };
}

function overlapSuffix(expected: string, actual: string): number {
  const limit = Math.min(expected.length, actual.length);
  for (let length = limit; length > 0; length -= 1) {
    if (expected.slice(-length) === actual.slice(-length)) return length;
  }
  return 0;
}

function overlapPrefix(expected: string, actual: string): number {
  const limit = Math.min(expected.length, actual.length);
  for (let length = limit; length > 0; length -= 1) {
    if (expected.slice(0, length) === actual.slice(0, length)) return length;
  }
  return 0;
}

function candidateContextScore(anchor: BookmarkSourceAnchor, source: string, start: number): number {
  const end = start + anchor.fragment.length;
  const actualPrefix = source.slice(Math.max(0, start - anchor.prefix.length), start);
  const actualSuffix = source.slice(end, end + anchor.suffix.length);
  const prefixScore = anchor.prefix ? overlapSuffix(anchor.prefix, actualPrefix) : 0;
  const suffixScore = anchor.suffix ? overlapPrefix(anchor.suffix, actualSuffix) : 0;
  return prefixScore + suffixScore;
}

function resolved(record: Pick<BookmarkRecord, 'targetKind'>, anchor: BookmarkSourceAnchor, start: number, occurrence: number): BookmarkResolution {
  return {
    status: 'resolved',
    sourceStart: start,
    sourceEnd: start + anchor.fragment.length,
    occurrence,
    kind: record.targetKind ?? 'text',
  };
}

export function resolveBookmarkTarget(
  bookmark: Pick<BookmarkRecord, 'targetKind' | 'sourceAnchor' | 'renderedText' | 'selectedText' | 'matchOrdinal' | 'matchIndex' | 'prefix' | 'suffix' | 'objectIdentity'>,
  documentText: string,
): BookmarkResolution {
  const source = String(documentText ?? '');
  const anchor = bookmark.sourceAnchor ?? normalizeSourceAnchor(null, {
    selectedText: bookmark.renderedText || bookmark.selectedText,
    matchIndex: bookmark.matchIndex,
    matchOrdinal: bookmark.matchOrdinal,
    prefix: bookmark.prefix,
    suffix: bookmark.suffix,
  });
  if (!anchor?.fragment) return { status: 'targetChanged' };

  const exact = source.slice(anchor.start, anchor.end);
  if (exact === anchor.fragment && fingerprint(exact) === anchor.fingerprint) {
    const occurrence = findOccurrences(source, anchor.fragment).indexOf(anchor.start);
    return resolved(bookmark, anchor, anchor.start, Math.max(0, occurrence));
  }

  const occurrences = findOccurrences(source, anchor.fragment);
  if (occurrences.length === 1) {
    const hasContext = Boolean(anchor.prefix || anchor.suffix);
    if (!hasContext || candidateContextScore(anchor, source, occurrences[0]) >= 6) {
      return resolved(bookmark, anchor, occurrences[0], 0);
    }
    return { status: 'targetChanged' };
  }
  if (occurrences.length > 1) {
    const scored = occurrences
      .map((start, occurrence) => ({ start, occurrence, score: candidateContextScore(anchor, source, start) }))
      .sort((left, right) => right.score - left.score || Math.abs(left.start - anchor.start) - Math.abs(right.start - anchor.start));
    const runnerUp = scored[1]?.score ?? -1;
    if (scored[0].score >= 6 && scored[0].score - runnerUp >= 2) {
      return resolved(bookmark, anchor, scored[0].start, scored[0].occurrence);
    }
    const hasContext = Boolean(anchor.prefix || anchor.suffix);
    const canUseOccurrence = bookmark.targetKind !== 'text' || !hasContext;
    const byOccurrence = occurrences[anchor.occurrence];
    if (canUseOccurrence && byOccurrence !== undefined) {
      return resolved(bookmark, anchor, byOccurrence, anchor.occurrence);
    }
    return { status: 'targetChanged' };
  }

  const legacyText = bookmark.renderedText || bookmark.selectedText;
  if (legacyText && legacyText !== anchor.fragment) {
    const legacyOccurrences = findOccurrences(source, legacyText);
    const legacyIndex = legacyOccurrences[bookmark.matchOrdinal];
    if (legacyIndex !== undefined && legacyOccurrences.length === 1) {
      const legacyAnchor = { ...anchor, fragment: legacyText };
      return resolved(bookmark, legacyAnchor, legacyIndex, bookmark.matchOrdinal);
    }
  }
  return { status: 'targetChanged' };
}

export function filterAndSortBookmarks(
  items: readonly BookmarkRecord[],
  query: string,
  sortMode: BookmarkSortMode,
): BookmarkRecord[] {
  const needle = query.trim().toLocaleLowerCase();
  const filtered = needle
    ? items.filter((item) => `${item.name}\n${item.renderedText || item.selectedText}`.toLocaleLowerCase().includes(needle))
    : [...items];
  return filtered.sort((left, right) => {
    if (sortMode === 'name-asc' || sortMode === 'name-desc') {
      const compared = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      return sortMode === 'name-asc' ? compared : -compared;
    }
    const compared = left.createdAt - right.createdAt;
    return sortMode === 'created-asc' ? compared : -compared;
  });
}

export function groupBookmarksByOpenWorkspace(
  items: readonly BookmarkRecord[],
  workspaces: readonly OpenBookmarkWorkspace[],
  activeWorkspaceKey: string,
): BookmarkWorkspaceGroup[] {
  return workspaces.map((workspace) => ({
    ...workspace,
    active: workspace.workspaceKey === activeWorkspaceKey,
    bookmarks: items.filter((item) => item.workspaceKey === workspace.workspaceKey),
  }));
}

function finiteInteger(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : fallback;
}

function finiteTimestamp(value: unknown): number | null {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : null;
}

function normalizeTargetKind(value: unknown): BookmarkTargetKind {
  return ['text', 'code', 'math', 'mermaid', 'image', 'link'].includes(String(value))
    ? value as BookmarkTargetKind
    : 'text';
}

function normalizeObjectIdentity(value: unknown): BookmarkObjectIdentity | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const identity: BookmarkObjectIdentity = {
    mathSource: String(raw.mathSource ?? '').trim() || undefined,
    mermaidSource: String(raw.mermaidSource ?? '').trim() || undefined,
    url: String(raw.url ?? '').trim() || undefined,
    label: String(raw.label ?? '').trim() || undefined,
    alt: String(raw.alt ?? '').trim() || undefined,
  };
  return Object.values(identity).some(Boolean) ? identity : undefined;
}

function normalizeSourceAnchor(value: unknown, fallback: {
  selectedText: string;
  matchIndex: number;
  matchOrdinal: number;
  prefix: string;
  suffix: string;
}): BookmarkSourceAnchor | null {
  if (value && typeof value === 'object') {
    const raw = value as Record<string, unknown>;
    const fragment = String(raw.fragment ?? '');
    const start = finiteInteger(raw.start, fallback.matchIndex);
    const end = finiteInteger(raw.end, start + fragment.length);
    if (!fragment || end <= start) return null;
    return {
      start,
      end,
      fragment,
      fingerprint: String(raw.fingerprint ?? '').trim() || fingerprint(fragment),
      occurrence: finiteInteger(raw.occurrence, fallback.matchOrdinal),
      prefix: String(raw.prefix ?? fallback.prefix),
      suffix: String(raw.suffix ?? fallback.suffix),
    };
  }
  if (!fallback.selectedText) return null;
  return {
    start: fallback.matchIndex,
    end: fallback.matchIndex + fallback.selectedText.length,
    fragment: fallback.selectedText,
    fingerprint: fingerprint(fallback.selectedText),
    occurrence: fallback.matchOrdinal,
    prefix: fallback.prefix,
    suffix: fallback.suffix,
  };
}

export function normalizeBookmarkRecord(value: unknown): BookmarkRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = String(raw.id ?? '').trim();
  const name = String(raw.name ?? '').trim();
  const workspaceKey = String(raw.workspaceKey ?? '').trim();
  const workspaceName = String(raw.workspaceName ?? '').trim();
  const filePath = String(raw.filePath ?? '').trim();
  const renderedText = String(raw.renderedText ?? raw.selectedText ?? '').trim();
  const createdAt = finiteTimestamp(raw.createdAt);
  const updatedAt = finiteTimestamp(raw.updatedAt);
  const matchOrdinal = finiteInteger(raw.matchOrdinal);
  const matchIndex = finiteInteger(raw.matchIndex);
  const prefix = String(raw.prefix ?? '');
  const suffix = String(raw.suffix ?? '');
  const sourceAnchor = normalizeSourceAnchor(raw.sourceAnchor, {
    selectedText: String(raw.selectedText ?? raw.renderedText ?? '').trim(),
    matchIndex,
    matchOrdinal,
    prefix,
    suffix,
  });
  if (!id || !name || !workspaceKey || !filePath || !renderedText || !sourceAnchor || createdAt === null || updatedAt === null) return null;
  const workspacePath = String(raw.workspacePath ?? '').trim() || undefined;
  const targetKind = normalizeTargetKind(raw.targetKind);
  return {
    id,
    name,
    workspaceKey,
    workspaceName,
    workspacePath,
    filePath,
    targetKind,
    sourceAnchor,
    objectIdentity: normalizeObjectIdentity(raw.objectIdentity),
    renderedText,
    selectedText: renderedText,
    matchOrdinal: sourceAnchor.occurrence,
    matchIndex: sourceAnchor.start,
    prefix: sourceAnchor.prefix,
    suffix: sourceAnchor.suffix,
    createdAt,
    updatedAt,
  };
}

export function normalizeBookmarkDocument(value: unknown): BookmarkDocument {
  if (!value || typeof value !== 'object') return { version: BOOKMARK_DOCUMENT_VERSION, items: [] };
  const raw = value as { version?: unknown; items?: unknown };
  if ((raw.version !== 1 && raw.version !== BOOKMARK_DOCUMENT_VERSION) || !Array.isArray(raw.items)) {
    return { version: BOOKMARK_DOCUMENT_VERSION, items: [] };
  }
  const seen = new Set<string>();
  const items: BookmarkRecord[] = [];
  for (const item of raw.items) {
    const normalized = normalizeBookmarkRecord(item);
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    items.push(normalized);
  }
  return { version: BOOKMARK_DOCUMENT_VERSION, items };
}

interface CreateBookmarkBaseInput {
  readonly id?: string;
  readonly name: string;
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly filePath: string;
  readonly source: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly renderedText: string;
  readonly now?: number;
}

export interface CreateTextBookmarkRecordInput extends CreateBookmarkBaseInput {
  readonly targetKind?: 'text' | 'code';
}

export interface CreateObjectBookmarkRecordInput extends CreateBookmarkBaseInput {
  readonly targetKind: Exclude<BookmarkTargetKind, 'text' | 'code'> | 'code';
  readonly objectIdentity?: BookmarkObjectIdentity;
}

function createBookmarkId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  } catch {}
  return `bookmark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createAnchoredRecord(
  input: CreateTextBookmarkRecordInput | CreateObjectBookmarkRecordInput,
  targetKind: BookmarkTargetKind,
  objectIdentity?: BookmarkObjectIdentity,
): BookmarkRecord | null {
  const name = input.name.trim();
  const filePath = input.filePath.trim();
  const workspaceName = input.workspaceName.trim();
  const renderedText = input.renderedText.trim();
  if (!name || !filePath || !renderedText) return null;
  const sourceAnchor = createSourceAnchor(String(input.source ?? ''), input.sourceStart, input.sourceEnd);
  if (!sourceAnchor) return null;
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  return {
    id: input.id?.trim() || createBookmarkId(),
    name,
    workspaceKey: getBookmarkWorkspaceKey(input.workspacePath, workspaceName),
    workspaceName,
    workspacePath: input.workspacePath?.trim() || undefined,
    filePath,
    targetKind,
    sourceAnchor,
    objectIdentity,
    renderedText,
    selectedText: renderedText,
    matchOrdinal: sourceAnchor.occurrence,
    matchIndex: sourceAnchor.start,
    prefix: sourceAnchor.prefix,
    suffix: sourceAnchor.suffix,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTextBookmarkRecord(input: CreateTextBookmarkRecordInput): BookmarkRecord | null {
  return createAnchoredRecord(input, input.targetKind ?? 'text');
}

export function createObjectBookmarkRecord(input: CreateObjectBookmarkRecordInput): BookmarkRecord | null {
  return createAnchoredRecord(input, input.targetKind, input.objectIdentity);
}

export interface CreateBookmarkRecordInput {
  readonly id?: string;
  readonly name: string;
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly filePath: string;
  readonly documentText: string;
  readonly selectedText: string;
  readonly selectedStart: number;
  readonly now?: number;
}

export function getOccurrenceIndex(text: string, query: string, ordinal: number): number {
  return findOccurrences(text, query)[Math.max(0, Math.floor(ordinal))] ?? -1;
}

/** Backward-compatible creator for version-1 call sites. */
export function createBookmarkRecord(input: CreateBookmarkRecordInput): BookmarkRecord | null {
  const selection = input.selectedText.trim();
  if (!selection) return null;
  const start = getOccurrenceIndex(input.documentText, selection, findOccurrences(input.documentText, selection).indexOf(input.selectedStart));
  const sourceStart = start >= 0 ? start : input.selectedStart;
  return createTextBookmarkRecord({
    id: input.id,
    name: input.name,
    workspaceName: input.workspaceName,
    workspacePath: input.workspacePath,
    filePath: input.filePath,
    source: input.documentText,
    sourceStart,
    sourceEnd: sourceStart + selection.length,
    renderedText: selection,
    now: input.now,
  });
}
