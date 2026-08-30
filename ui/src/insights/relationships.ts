import type { InsightsRelationshipWeights } from './config.ts';

export interface RelationshipDocument {
  readonly path: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly headings: readonly string[];
  readonly links: readonly string[];
  readonly terms: readonly string[];
  readonly terminologySignatures?: readonly string[];
}

export interface RelationshipEvidence {
  readonly directLinks: readonly string[];
  readonly sharedTags: readonly string[];
  readonly sharedHeadings: readonly string[];
  readonly sharedTitleTerms: readonly string[];
  readonly sharedTerms: readonly string[];
}

export interface RelatedDocumentScore {
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly score: number;
  readonly evidence: RelationshipEvidence;
  readonly contributions: InsightsRelationshipWeights;
  readonly persisted: {
    readonly sourcePath: string;
    readonly targetPath: string;
    readonly score: number;
    readonly terminologySignatures: readonly string[];
  };
}

export const RELATIONSHIP_PRESETS: Readonly<Record<'default' | 'link-focused' | 'tag-focused' | 'terminology-focused', InsightsRelationshipWeights>> = Object.freeze({
  default: Object.freeze({ links: 35, tags: 20, headings: 15, title: 10, terminology: 20 }),
  'link-focused': Object.freeze({ links: 55, tags: 15, headings: 10, title: 5, terminology: 15 }),
  'tag-focused': Object.freeze({ links: 20, tags: 45, headings: 10, title: 5, terminology: 20 }),
  'terminology-focused': Object.freeze({ links: 20, tags: 10, headings: 10, title: 10, terminology: 50 }),
});

const GENERIC_TITLE_TERMS = new Set([
  'guide', 'readme', 'notes', 'note', 'index', 'document', 'overview', 'untitled', 'home', 'main',
]);

function finite(value: number | undefined): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0; }

export function normalizeRelationshipWeights(weights: Partial<InsightsRelationshipWeights>): InsightsRelationshipWeights {
  const raw = {
    links: finite(weights.links), tags: finite(weights.tags), headings: finite(weights.headings),
    title: finite(weights.title), terminology: finite(weights.terminology),
  };
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { ...RELATIONSHIP_PRESETS.default };
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, (value / total) * 100])) as unknown as InsightsRelationshipWeights;
}

function norm(value: string): string { return value.normalize('NFKC').toLocaleLowerCase('en-US').trim(); }
function unique(values: readonly string[]): string[] { return [...new Set(values.map(norm).filter(Boolean))].sort(); }
function intersect(a: readonly string[], b: readonly string[]): string[] {
  const right = new Set(unique(b));
  return unique(a).filter(value => right.has(value));
}
function titleTerms(title: string): string[] {
  return unique(title.match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu) ?? [])
    .filter(term => !GENERIC_TITLE_TERMS.has(term));
}
function ratio(shared: number, a: number, b: number): number { return shared <= 0 ? 0 : Math.min(1, (2 * shared) / Math.max(1, a + b)); }
function hash(value: string): string {
  let h = 0xcbf29ce484222325n; const prime = 0x100000001b3n;
  for (let i = 0; i < value.length; i += 1) { h ^= BigInt(value.charCodeAt(i)); h = BigInt.asUintN(64, h * prime); }
  return h.toString(16).padStart(16, '0');
}

export function getRelationshipEvidence(a: RelationshipDocument, b: RelationshipDocument): RelationshipEvidence {
  const aLinks = new Set(a.links.map(norm)); const bLinks = new Set(b.links.map(norm));
  const directLinks: string[] = [];
  if (aLinks.has(norm(b.path))) directLinks.push(`${a.path}->${b.path}`);
  if (bLinks.has(norm(a.path))) directLinks.push(`${b.path}->${a.path}`);
  return {
    directLinks,
    sharedTags: intersect(a.tags, b.tags),
    sharedHeadings: intersect(a.headings, b.headings),
    sharedTitleTerms: intersect(titleTerms(a.title), titleTerms(b.title)),
    sharedTerms: intersect(a.terms, b.terms),
  };
}

export function scoreRelatedDocument(a: RelationshipDocument, b: RelationshipDocument, inputWeights: Partial<InsightsRelationshipWeights> = RELATIONSHIP_PRESETS.default): RelatedDocumentScore {
  const weights = normalizeRelationshipWeights(inputWeights);
  const evidence = getRelationshipEvidence(a, b);
  const linkSignal = Math.min(1, evidence.directLinks.length);
  const tagSignal = ratio(evidence.sharedTags.length, unique(a.tags).length, unique(b.tags).length);
  const headingSignal = ratio(evidence.sharedHeadings.length, unique(a.headings).length, unique(b.headings).length);
  const titleSignal = ratio(evidence.sharedTitleTerms.length, titleTerms(a.title).length, titleTerms(b.title).length);
  const termSignal = ratio(evidence.sharedTerms.length, unique(a.terms).length, unique(b.terms).length);
  const contributions: InsightsRelationshipWeights = {
    links: weights.links * linkSignal,
    tags: weights.tags * tagSignal,
    headings: weights.headings * headingSignal,
    title: weights.title * titleSignal,
    terminology: weights.terminology * termSignal,
  };
  const score = Math.max(0, Math.min(100, Object.values(contributions).reduce((sum, value) => sum + value, 0)));
  const rounded = Math.round(score * 100) / 100;
  return {
    sourcePath: a.path,
    targetPath: b.path,
    score: rounded,
    evidence,
    contributions,
    persisted: {
      sourcePath: a.path,
      targetPath: b.path,
      score: rounded,
      terminologySignatures: evidence.sharedTerms.map(hash).sort(),
    },
  };
}

function addBucket(map: Map<string, string[]>, key: string, path: string): void {
  if (!key) return;
  const list = map.get(key) ?? [];
  if (list.length < 250) list.push(path);
  map.set(key, list);
}

export function buildRelationshipCandidates(documents: readonly RelationshipDocument[]): Set<string> {
  const buckets = new Map<string, string[]>();
  const paths = new Set(documents.map(document => norm(document.path)));
  for (const document of documents) {
    for (const tag of unique(document.tags)) addBucket(buckets, `tag:${tag}`, document.path);
    for (const heading of unique(document.headings)) addBucket(buckets, `h:${heading}`, document.path);
    for (const term of unique(document.terms).slice(0, 64)) addBucket(buckets, `t:${term}`, document.path);
    for (const term of titleTerms(document.title)) addBucket(buckets, `title:${term}`, document.path);
    for (const link of document.links.map(norm)) if (paths.has(link)) addBucket(buckets, `link:${[norm(document.path), link].sort().join('|')}`, document.path);
  }
  const result = new Set<string>();
  for (const list of buckets.values()) {
    const uniquePaths = [...new Set(list)].sort();
    for (let i = 0; i < uniquePaths.length; i += 1) {
      for (let j = i + 1; j < uniquePaths.length; j += 1) result.add(`${uniquePaths[i]}\u0000${uniquePaths[j]}`);
    }
  }
  const byNorm = new Map(documents.map(document => [norm(document.path), document.path]));
  for (const document of documents) for (const link of document.links) {
    const target = byNorm.get(norm(link));
    if (target && target !== document.path) result.add([document.path, target].sort().join('\u0000'));
  }
  return result;
}
