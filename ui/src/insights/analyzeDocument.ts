import { buildDocumentAnchorIndex } from '../markdown/anchors.ts';
import { parse, type BlockToken } from '../markdown/parser.ts';
import { extractDocumentReferences, type DocumentReference, type DynamicDocumentReference } from '../markdown/references.ts';
import { parseFrontmatterDocument, type ParsedFrontmatterMetadata } from '../markdown/frontmatter.ts';
import { normalizeExactDuplicateSource } from './duplicates.ts';
import type { InsightsSettings } from './config.ts';
import { lintDocument, type InsightsLintFinding } from './lint.ts';

export interface AnalyzeDocumentInput {
  readonly path: string;
  readonly source: string;
  readonly revision: string;
  readonly lintRules?: InsightsSettings['lintRules'];
}

export interface AnalyzedHeading {
  readonly text: string;
  readonly level: number;
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

export interface AnalyzedSection {
  readonly heading: string;
  readonly level: number;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly text: string;
  readonly fingerprint: string;
}

export interface AnalyzedDiagram {
  readonly kind: 'mermaid';
  readonly status: 'valid' | 'invalid';
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly fingerprint: string;
  readonly code?: string;
}

export interface PersistedAnalyzedDocument {
  readonly path: string;
  readonly revision: string;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
  readonly anchors: readonly string[];
  readonly headings: readonly AnalyzedHeading[];
  readonly references: readonly DocumentReference[];
  readonly dynamicReferences: readonly DynamicDocumentReference[];
  readonly sections: readonly Omit<AnalyzedSection, 'text'>[];
  readonly diagrams: readonly AnalyzedDiagram[];
  readonly exactFingerprint: string;
  readonly terminologySignatures: readonly string[];
  readonly lint: readonly InsightsLintFinding[];
}

export interface AnalyzedDocument {
  readonly path: string;
  readonly revision: string;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
  readonly anchors: ReadonlySet<string>;
  readonly headings: readonly AnalyzedHeading[];
  readonly references: readonly DocumentReference[];
  readonly dynamicReferences: readonly DynamicDocumentReference[];
  readonly sections: readonly AnalyzedSection[];
  readonly diagrams: readonly AnalyzedDiagram[];
  readonly exactFingerprint: string;
  readonly terminology: readonly string[];
  readonly terminologySignatures: readonly string[];
  readonly lint: readonly InsightsLintFinding[];
  readonly persisted: PersistedAnalyzedDocument;
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'been', 'before', 'being', 'between', 'could', 'does', 'each',
  'from', 'have', 'into', 'more', 'most', 'other', 'over', 'same', 'some', 'such', 'than', 'that',
  'their', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'using', 'very',
  'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your', 'will', 'were', 'them', 'only',
]);

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function fallbackTitle(path: string): string {
  return basename(path).replace(/\.(?:md|mdx)$/i, '');
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    const key = value.normalize('NFC').toLocaleLowerCase('en-US');
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

function codeRanges(tokens: readonly BlockToken[]): Array<{ start: number; end: number }> {
  return tokens.flatMap(token => token.type === 'code'
    && token.sourceStart !== undefined && token.sourceEnd !== undefined
    ? [{ start: token.sourceStart, end: token.sourceEnd }]
    : []);
}

function proseForTerminology(source: string, tokens: readonly BlockToken[]): string {
  const chars = [...source];
  for (const range of codeRanges(tokens)) {
    for (let index = range.start; index < Math.min(range.end, chars.length); index += 1) chars[index] = ' ';
  }
  return chars.join('')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[\[[^\]]*\]\]/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#|~{}()[\]]/g, ' ')
    .replace(/\s+/g, ' ');
}

function extractTerminology(source: string, tokens: readonly BlockToken[]): string[] {
  const words = proseForTerminology(source, tokens)
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu) ?? [];
  const significant = words.filter(word => word.length >= 4 && !STOP_WORDS.has(word));
  const terms: string[] = [];
  for (let index = 0; index < significant.length; index += 1) {
    terms.push(significant[index]);
    if (index + 1 < significant.length) terms.push(`${significant[index]} ${significant[index + 1]}`);
  }
  return unique(terms).slice(0, 512);
}

function headingsFrom(tokens: readonly BlockToken[]): AnalyzedHeading[] {
  return tokens.flatMap(token => token.type === 'heading' ? [{
    text: token.text,
    level: token.level,
    sourceStart: token.sourceStart ?? 0,
    sourceEnd: token.sourceEnd ?? token.sourceStart ?? 0,
  }] : []);
}

function sectionsFrom(source: string, headings: readonly AnalyzedHeading[]): AnalyzedSection[] {
  return headings.map((heading, index) => {
    const next = headings[index + 1];
    const sourceStart = heading.sourceStart;
    const sourceEnd = next?.sourceStart ?? source.length;
    const text = source.slice(heading.sourceEnd, sourceEnd).trim();
    const normalized = `${heading.level}|${heading.text.trim().normalize('NFKC').toLocaleLowerCase('en-US')}|${text.replace(/\s+/g, ' ').trim()}`;
    return {
      heading: heading.text,
      level: heading.level,
      sourceStart,
      sourceEnd,
      text,
      fingerprint: fnv1a64(normalized),
    };
  });
}

function diagramsFrom(tokens: readonly BlockToken[], lint: readonly InsightsLintFinding[]): AnalyzedDiagram[] {
  const invalidRanges = lint
    .filter(finding => finding.ruleId === 'mermaid/invalid')
    .map(finding => ({ start: finding.sourceStart ?? -1, end: finding.sourceEnd ?? -1 }));
  return tokens.flatMap(token => {
    if (token.type !== 'code' || token.lang.toLowerCase() !== 'mermaid') return [];
    const sourceStart = token.sourceStart ?? 0;
    const sourceEnd = token.sourceEnd ?? sourceStart;
    const invalid = invalidRanges.some(range => sourceStart < range.end && sourceEnd > range.start);
    return [{
      kind: 'mermaid' as const,
      status: invalid ? 'invalid' as const : 'valid' as const,
      sourceStart,
      sourceEnd,
      fingerprint: fnv1a64(token.content.replace(/\s+/g, ' ').trim()),
      code: token.content,
    }];
  });
}

function metadataTitle(metadata: ParsedFrontmatterMetadata, headings: readonly AnalyzedHeading[], path: string): string {
  return metadata.title?.trim() || headings.find(heading => heading.level === 1)?.text.trim() || headings[0]?.text.trim() || fallbackTitle(path);
}

export function analyzeDocument(input: AnalyzeDocumentInput): AnalyzedDocument {
  const parsed = parse(input.source, /\.mdx$/i.test(input.path));
  const frontmatter = parseFrontmatterDocument(input.source);
  const metadata = frontmatter.metadata;
  const extracted = extractDocumentReferences(input.source, parsed.tokens);
  const headings = headingsFrom(parsed.tokens);
  const anchors = buildDocumentAnchorIndex(parsed.tokens, input.source).anchors;
  const aliases = unique(metadata.aliases);
  const tags = unique([...metadata.tags, ...extracted.tags]);
  const title = metadataTitle(metadata, headings, input.path);
  const sections = sectionsFrom(input.source, headings);
  const terminology = extractTerminology(input.source, parsed.tokens);
  const terminologySignatures = terminology.map(fnv1a64).sort();
  const lint = lintDocument({
    path: input.path,
    source: input.source,
    tokens: parsed.tokens,
    frontmatterDiagnostics: frontmatter.diagnostics,
    lintRules: input.lintRules,
  });
  const diagrams = diagramsFrom(parsed.tokens, lint);
  const exactFingerprint = fnv1a64(normalizeExactDuplicateSource(input.source));
  const persisted: PersistedAnalyzedDocument = {
    path: input.path,
    revision: input.revision,
    title,
    aliases,
    tags,
    anchors: [...anchors].sort(),
    headings,
    references: extracted.references,
    dynamicReferences: extracted.dynamicReferences,
    sections: sections.map(({ text: _text, ...section }) => section),
    diagrams,
    exactFingerprint,
    terminologySignatures,
    lint,
  };
  return {
    path: input.path,
    revision: input.revision,
    title,
    aliases,
    tags,
    anchors,
    headings,
    references: extracted.references,
    dynamicReferences: extracted.dynamicReferences,
    sections,
    diagrams,
    exactFingerprint,
    terminology,
    terminologySignatures,
    lint,
    persisted,
  };
}

export function restorePersistedAnalyzedDocument(persisted: PersistedAnalyzedDocument): AnalyzedDocument {
  return {
    path: persisted.path,
    revision: persisted.revision,
    title: persisted.title,
    aliases: persisted.aliases,
    tags: persisted.tags,
    anchors: new Set(persisted.anchors),
    headings: persisted.headings,
    references: persisted.references,
    dynamicReferences: persisted.dynamicReferences,
    sections: persisted.sections.map(section => ({ ...section, text: '' })),
    diagrams: persisted.diagrams,
    exactFingerprint: persisted.exactFingerprint,
    terminology: [],
    terminologySignatures: persisted.terminologySignatures,
    lint: persisted.lint,
    persisted,
  };
}
