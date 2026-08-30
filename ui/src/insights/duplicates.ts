export interface DuplicateCorpusDocument {
  readonly path: string;
  readonly source?: string;
  readonly normalizedTokens?: readonly string[];
}

export interface ContentFingerprint {
  readonly path: string;
  readonly fingerprint: string;
  readonly tokenCount: number;
}

export interface SectionFingerprint extends ContentFingerprint {
  readonly heading: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

export interface PassageFingerprint extends ContentFingerprint {
  readonly startToken: number;
  readonly endToken: number;
}

export interface DuplicateGroup {
  readonly key: string;
  readonly kind: 'exact' | 'section' | 'passage' | 'near';
  readonly paths: readonly string[];
  readonly score?: number;
  readonly fingerprint?: string;
}

export interface FindDuplicateOptions {
  readonly threshold?: number;
  readonly scorePair?: (a: DuplicateCorpusDocument, b: DuplicateCorpusDocument) => number;
  readonly suppressedGroupKeys?: readonly string[];
}

const BOILERPLATE = new Set([
  'copyright', 'rights', 'reserved', 'license', 'licensed', 'privacy', 'policy', 'terms', 'conditions',
  'table', 'contents', 'introduction', 'overview', 'note', 'notes', 'warning', 'example',
]);
const MIN_SECTION_CHARS = 100;
const MIN_SECTION_TOKENS = 20;
const PASSAGE_WINDOW = 120;
const PASSAGE_STRIDE = 60;
const MIN_PASSAGE_TOKENS = 40;

function hash(value: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < value.length; i += 1) {
    h ^= BigInt(value.charCodeAt(i));
    h = BigInt.asUintN(64, h * prime);
  }
  return h.toString(16).padStart(16, '0');
}

export function normalizeExactDuplicateSource(source: string): string {
  return source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '');
}

export function normalizeDuplicateTokens(value: string | readonly string[]): string[] {
  const source = typeof value === 'string' ? value : value.join(' ');
  return (source.normalize('NFKC').toLocaleLowerCase('en-US').match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu) ?? [])
    .filter(token => !BOILERPLATE.has(token));
}

function isBoilerplate(tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  const unique = new Set(tokens);
  const boilerCount = tokens.filter(token => BOILERPLATE.has(token)).length;
  return unique.size < Math.min(8, Math.ceil(tokens.length / 8)) || boilerCount / tokens.length > 0.7;
}

function fingerprintTokens(tokens: readonly string[]): string {
  return hash(tokens.join('\u0001'));
}

export function buildSectionFingerprints(path: string, source: string): SectionFingerprint[] {
  const normalized = source.replace(/\r\n?/g, '\n');
  const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
  const headings = [...normalized.matchAll(headingPattern)];
  const result: SectionFingerprint[] = [];
  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];
    const start = (current.index ?? 0) + current[0].length;
    const end = headings[i + 1]?.index ?? normalized.length;
    const text = normalized.slice(start, end).trim();
    const tokens = normalizeDuplicateTokens(text);
    if (text.length < MIN_SECTION_CHARS || tokens.length < MIN_SECTION_TOKENS || isBoilerplate(tokens)) continue;
    result.push({
      path,
      heading: current[2].trim(),
      sourceStart: current.index ?? 0,
      sourceEnd: end,
      fingerprint: fingerprintTokens(tokens),
      tokenCount: tokens.length,
    });
  }
  return result;
}

export function buildPassageFingerprints(path: string, source: string): PassageFingerprint[] {
  const tokens = normalizeDuplicateTokens(source);
  if (tokens.length < MIN_PASSAGE_TOKENS || isBoilerplate(tokens)) return [];
  const result: PassageFingerprint[] = [];
  for (let start = 0; start < tokens.length; start += PASSAGE_STRIDE) {
    const end = Math.min(tokens.length, start + PASSAGE_WINDOW);
    const window = tokens.slice(start, end);
    if (window.length < MIN_PASSAGE_TOKENS) break;
    if (!isBoilerplate(window)) {
      result.push({ path, startToken: start, endToken: end, fingerprint: fingerprintTokens(window), tokenCount: window.length });
    }
    if (end === tokens.length) break;
  }
  return result;
}

function tokensFor(document: DuplicateCorpusDocument): string[] {
  return document.normalizedTokens ? normalizeDuplicateTokens(document.normalizedTokens) : normalizeDuplicateTokens(document.source ?? '');
}

function shingles(tokens: readonly string[]): string[] {
  if (tokens.length === 0) return [];
  if (tokens.length < 3) return [...new Set(tokens)];
  const result: string[] = [];
  for (let i = 0; i + 2 < tokens.length; i += 1) result.push(`${tokens[i]}\u0001${tokens[i + 1]}\u0001${tokens[i + 2]}`);
  return [...new Set(result)];
}

export function scoreNearDuplicate(a: DuplicateCorpusDocument, b: DuplicateCorpusDocument): number {
  const aSet = new Set(tokensFor(a));
  const bSet = new Set(tokensFor(b));
  if (!aSet.size || !bSet.size) return 0;
  let intersection = 0;
  for (const token of aSet) if (bSet.has(token)) intersection += 1;
  return (2 * intersection) / (aSet.size + bSet.size);
}

export function buildNearDuplicateCandidates(corpus: readonly DuplicateCorpusDocument[]): Set<string> {
  const buckets = new Map<string, string[]>();
  for (const document of corpus) {
    const tokens = tokensFor(document);
    const evidence = shingles(tokens).slice(0, 64);
    if (evidence.length === 0) continue;
    const bucketKeys = new Set<string>();
    for (const shingle of evidence) bucketKeys.add(`${Number.parseInt(hash(shingle).slice(0, 4), 16) % 16}:${hash(shingle).slice(0, 8)}`);
    for (const token of [...new Set(tokens)].slice(0, 12)) bucketKeys.add(`t:${token}`);
    for (const key of bucketKeys) {
      const list = buckets.get(key) ?? [];
      if (list.length < 100) list.push(document.path);
      buckets.set(key, list);
    }
  }
  const pairs = new Set<string>();
  for (const list of buckets.values()) {
    const unique = [...new Set(list)].sort();
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) pairs.add(`${unique[i]}\u0000${unique[j]}`);
    }
  }
  return pairs;
}

function groupKey(kind: DuplicateGroup['kind'], paths: readonly string[], suffix = ''): string {
  return `${kind}:${hash(`${[...paths].sort().join('\u0000')}|${suffix}`)}`;
}

export function findDuplicateGroups(
  corpus: readonly DuplicateCorpusDocument[],
  options: FindDuplicateOptions = {},
): DuplicateGroup[] {
  const threshold = Math.max(0.5, Math.min(1, options.threshold ?? 0.90));
  const scorePair = options.scorePair ?? scoreNearDuplicate;
  const suppressed = new Set(options.suppressedGroupKeys ?? []);
  const result: DuplicateGroup[] = [];
  const byPath = new Map(corpus.map(document => [document.path, document]));

  const exact = new Map<string, string[]>();
  for (const document of corpus) {
    if (document.source === undefined) continue;
    const normalized = normalizeExactDuplicateSource(document.source);
    const key = hash(normalized);
    const paths = exact.get(key) ?? [];
    paths.push(document.path);
    exact.set(key, paths);
  }
  for (const [fingerprint, paths] of exact) {
    const unique = [...new Set(paths)].sort();
    if (unique.length < 2) continue;
    const key = groupKey('exact', unique, fingerprint);
    if (!suppressed.has(key)) result.push({ key, kind: 'exact', paths: unique, fingerprint });
  }

  for (const pair of buildNearDuplicateCandidates(corpus)) {
    const [aPath, bPath] = pair.split('\u0000');
    const a = byPath.get(aPath); const b = byPath.get(bPath);
    if (!a || !b) continue;
    const score = scorePair(a, b);
    if (score < threshold) continue;
    const paths = [aPath, bPath].sort();
    const key = groupKey('near', paths, score.toFixed(4));
    if (!suppressed.has(key)) result.push({ key, kind: 'near', paths, score });
  }

  return result.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
}

export const DUPLICATE_THRESHOLDS = Object.freeze({
  minSectionChars: MIN_SECTION_CHARS,
  minSectionTokens: MIN_SECTION_TOKENS,
  passageWindow: PASSAGE_WINDOW,
  passageStride: PASSAGE_STRIDE,
});
