import type { BlockToken } from '../markdown/parser.ts';
import type { FrontmatterDiagnostic } from '../markdown/frontmatter.ts';
import type { InsightsLintSeverity, InsightsSettings } from './config.ts';
import { isPipeTableSeparator } from '../markdown/tableParser.ts';

export interface InsightsLintFinding {
  readonly id: string;
  readonly path: string;
  readonly ruleId: string;
  readonly severity: InsightsLintSeverity;
  readonly defaultSeverity?: InsightsLintSeverity;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

export type InsightsLintSuppression =
  | { readonly scope: 'finding'; readonly findingId: string }
  | { readonly scope: 'path-rule'; readonly path: string; readonly ruleId: string }
  | { readonly scope: 'rule'; readonly ruleId: string };

export interface LintDocumentInput {
  readonly path: string;
  readonly source: string;
  readonly tokens: readonly BlockToken[];
  readonly frontmatterDiagnostics?: readonly FrontmatterDiagnostic[];
  readonly lintRules?: InsightsSettings['lintRules'];
}

interface SourceRange { readonly start: number; readonly end: number; }

export const INSIGHTS_LINT_RULE_DEFAULTS: Readonly<Record<string, InsightsLintSeverity>> = Object.freeze({
  'frontmatter/malformed': 'error',
  'frontmatter/duplicate-key': 'error',
  'frontmatter/invalid-insights-metadata': 'warning',
  'heading/skipped-level': 'warning',
  'heading/duplicate': 'warning',
  'table/malformed-delimiter': 'warning',
  'table/column-count': 'warning',
  'list/inconsistent-marker': 'warning',
  'list/indentation': 'warning',
  'format/trailing-whitespace': 'info',
  'wiki/malformed': 'warning',
  'link/malformed-uri': 'warning',
  'mermaid/invalid': 'warning',
});

function hashId(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < Math.min(offset, source.length); index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function lineOffsets(source: string): number[] {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) offsets.push(index + 1);
  }
  return offsets;
}

function rangesForCode(tokens: readonly BlockToken[]): SourceRange[] {
  return tokens.flatMap(token => token.type === 'code'
    && token.sourceStart !== undefined && token.sourceEnd !== undefined
    ? [{ start: token.sourceStart, end: token.sourceEnd }]
    : []);
}

function inlineCodeRanges(source: string, blocked: readonly SourceRange[]): SourceRange[] {
  const ranges: SourceRange[] = [];
  for (const match of source.matchAll(/(`+)([^\n]*?)\1/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (!blocked.some(range => start < range.end && end > range.start)) ranges.push({ start, end });
  }
  return ranges;
}

function blockedAt(ranges: readonly SourceRange[], start: number, end = start + 1): boolean {
  return ranges.some(range => start < range.end && end > range.start);
}

function splitPipeCells(row: string): string[] {
  let source = row.trim();
  if (source.startsWith('|')) source = source.slice(1);
  if (source.endsWith('|')) source = source.slice(0, -1);
  const cells: string[] = [];
  let current = '';
  let escaped = false;
  let codeTicks = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) { current += char; escaped = false; continue; }
    if (char === '\\') { escaped = true; current += char; continue; }
    if (char === '`') { codeTicks = codeTicks ? 0 : 1; current += char; continue; }
    if (char === '|' && !codeTicks) { cells.push(current.trim()); current = ''; continue; }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function looksLikeDelimiter(line: string): boolean {
  if (!line.includes('|')) return false;
  const cells = splitPipeCells(line);
  if (cells.length < 2) return false;
  const hasDelimiterCell = cells.some(cell => /^:?-{2,}:?$/.test(cell.trim()));
  const looksLikeProse = cells.some(cell => /\s{2,}|\b[a-zA-Z]{4,}\s+[a-zA-Z]{3,}\b/.test(cell.trim()));
  return hasDelimiterCell && !looksLikeProse;
}

function validAbsoluteUri(value: string): boolean {
  const trimmed = value.trim().replace(/^<|>$/g, '');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return Boolean(parsed.protocol);
  } catch {
    return false;
  }
}

function mermaidLooksValid(content: string): boolean {
  const first = content.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? '';
  return /^(?:---|%%|graph\b|flowchart\b|sequenceDiagram\b|classDiagram\b|stateDiagram(?:-v2)?\b|erDiagram\b|journey\b|gantt\b|pie\b|mindmap\b|timeline\b|quadrantChart\b|xychart(?:-beta)?\b|sankey-beta\b|architecture-beta\b|block-beta\b|packet-beta\b|kanban\b|gitGraph\b|C4(?:Context|Container|Component|Dynamic|Deployment)\b)/i.test(first);
}

function rawFinding(
  input: LintDocumentInput,
  ruleId: string,
  message: string,
  options: { line?: number; column?: number; sourceStart?: number; sourceEnd?: number; severity?: InsightsLintSeverity } = {},
): InsightsLintFinding | null {
  const ruleConfig = input.lintRules?.[ruleId];
  if (ruleConfig?.enabled === false) return null;
  const defaultSeverity = options.severity ?? INSIGHTS_LINT_RULE_DEFAULTS[ruleId] ?? 'warning';
  const severity = ruleConfig?.severity ?? defaultSeverity;
  const line = options.line ?? (options.sourceStart !== undefined ? lineAt(input.source, options.sourceStart) : undefined);
  const id = `${ruleId}:${hashId(`${input.path}|${ruleId}|${line ?? 0}|${options.sourceStart ?? 0}|${message}`)}`;
  return {
    id,
    path: input.path,
    ruleId,
    severity,
    defaultSeverity,
    message,
    ...(line !== undefined ? { line } : {}),
    ...(options.column !== undefined ? { column: options.column } : {}),
    ...(options.sourceStart !== undefined ? { sourceStart: options.sourceStart } : {}),
    ...(options.sourceEnd !== undefined ? { sourceEnd: options.sourceEnd } : {}),
  };
}

export function applyLintSuppressions(
  findings: readonly InsightsLintFinding[],
  suppressions: readonly InsightsLintSuppression[] | undefined,
): InsightsLintFinding[] {
  if (!suppressions?.length) return [...findings];

  return findings.filter(finding => !suppressions.some(suppression => {
    switch (suppression.scope) {
      case 'finding':
        return suppression.findingId === finding.id;
      case 'path-rule':
        return suppression.path === finding.path && suppression.ruleId === finding.ruleId;
      case 'rule':
        return suppression.ruleId === finding.ruleId;
    }
  }));
}

export function lintDocument(input: LintDocumentInput): InsightsLintFinding[] {
  const findings: InsightsLintFinding[] = [];
  const push = (finding: InsightsLintFinding | null) => { if (finding) findings.push(finding); };
  const codeRanges = rangesForCode(input.tokens);
  const blocked = [...codeRanges, ...inlineCodeRanges(input.source, codeRanges)];

  for (const diagnostic of input.frontmatterDiagnostics ?? []) {
    push(rawFinding(input, diagnostic.ruleId, diagnostic.message, {
      line: diagnostic.line,
      severity: diagnostic.severity,
    }));
  }

  let previousLevel: number | undefined;
  const headingCounts = new Map<string, number>();
  for (const token of input.tokens) {
    if (token.type !== 'heading') continue;
    const start = token.sourceStart ?? 0;
    if (previousLevel !== undefined && token.level > previousLevel + 1) {
      push(rawFinding(input, 'heading/skipped-level', `Heading level jumps from H${previousLevel} to H${token.level}.`, {
        sourceStart: start,
        sourceEnd: token.sourceEnd,
      }));
    }
    previousLevel = token.level;
    const key = token.text.trim().normalize('NFC').toLocaleLowerCase('en-US');
    const count = headingCounts.get(key) ?? 0;
    if (count > 0) {
      push(rawFinding(input, 'heading/duplicate', `Duplicate heading “${token.text.trim()}”.`, {
        sourceStart: start,
        sourceEnd: token.sourceEnd,
      }));
    }
    headingCounts.set(key, count + 1);
  }

  for (const token of input.tokens) {
    if (token.type !== 'code' || token.lang.toLowerCase() !== 'mermaid') continue;
    if (mermaidLooksValid(token.content)) continue;
    push(rawFinding(input, 'mermaid/invalid', 'Mermaid fence does not begin with a recognized diagram declaration.', {
      sourceStart: token.sourceStart ?? 0,
      sourceEnd: token.sourceEnd ?? token.sourceStart ?? 0,
    }));
  }

  const offsets = lineOffsets(input.source);
  const lines = input.source.split(/\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, '');
    const start = offsets[index] ?? 0;
    if (!blockedAt(codeRanges, start, start + line.length)) {
      const trailing = /[ \t]+$/.exec(line);
      if (trailing) {
        push(rawFinding(input, 'format/trailing-whitespace', 'Trailing whitespace.', {
          line: index + 1,
          column: trailing.index + 1,
          sourceStart: start + trailing.index,
          sourceEnd: start + line.length,
        }));
      }
    }
  }

  for (let index = 0; index + 1 < lines.length; index += 1) {
    const header = lines[index].replace(/\r$/, '');
    const delimiter = lines[index + 1].replace(/\r$/, '');
    const headerStart = offsets[index] ?? 0;
    if (blockedAt(codeRanges, headerStart, headerStart + header.length) || !header.includes('|')) continue;
    const headerColumns = splitPipeCells(header).length;
    if (headerColumns < 2 || !delimiter.includes('|')) continue;
    const validDelimiter = isPipeTableSeparator(delimiter);
    if (!validDelimiter && looksLikeDelimiter(delimiter)) {
      push(rawFinding(input, 'table/malformed-delimiter', 'Table delimiter row contains invalid cells.', {
        line: index + 2,
        sourceStart: offsets[index + 1],
        sourceEnd: (offsets[index + 1] ?? 0) + delimiter.length,
      }));
    }
    if (!validDelimiter && !looksLikeDelimiter(delimiter)) continue;
    let lastTableRowIndex = index + 1;
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex].replace(/\r$/, '');
      if (!row.trim() || !row.includes('|')) break;
      lastTableRowIndex = rowIndex;
      if (splitPipeCells(row).length !== headerColumns) {
        push(rawFinding(input, 'table/column-count', `Table row has ${splitPipeCells(row).length} columns; expected ${headerColumns}.`, {
          line: rowIndex + 1,
          sourceStart: offsets[rowIndex],
          sourceEnd: (offsets[rowIndex] ?? 0) + row.length,
        }));
      }
    }
    index = lastTableRowIndex;
  }

  let listBlockMarkers: string[] = [];
  const flushListMarkers = (line: number) => {
    const unordered = listBlockMarkers.filter(marker => /^[-*+]$/.test(marker));
    if (new Set(unordered).size > 1) {
      push(rawFinding(input, 'list/inconsistent-marker', 'List mixes unordered marker styles.', { line }));
    }
    listBlockMarkers = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, '');
    const start = offsets[index] ?? 0;
    if (blockedAt(codeRanges, start, start + line.length)) continue;
    const marker = /^(\s*)([-*+]|\d+[.)])\s+/.exec(line);
    if (!marker) {
      if (!line.trim()) flushListMarkers(index + 1);
      continue;
    }
    listBlockMarkers.push(marker[2].replace(/\d+/, '1'));
    if (marker[1].length % 2 !== 0) {
      push(rawFinding(input, 'list/indentation', 'List item indentation is not a multiple of two spaces.', {
        line: index + 1,
        sourceStart: start,
        sourceEnd: start + marker[1].length,
      }));
    }
  }
  flushListMarkers(lines.length);

  for (const match of input.source.matchAll(/!?\[\[[^\n]*$/gm)) {
    const start = match.index ?? 0;
    if (blockedAt(blocked, start, start + match[0].length)) continue;
    push(rawFinding(input, 'wiki/malformed', 'Malformed Wiki Link syntax.', { sourceStart: start, sourceEnd: start + match[0].length }));
  }

  for (const match of input.source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const start = match.index ?? 0;
    if (blockedAt(blocked, start, start + match[0].length)) continue;
    if (!validAbsoluteUri(match[1])) {
      push(rawFinding(input, 'link/malformed-uri', `Malformed absolute URI: ${match[1]}`, { sourceStart: start, sourceEnd: start + match[0].length }));
    }
  }

  return findings.sort((a, b) => (a.sourceStart ?? 0) - (b.sourceStart ?? 0) || a.ruleId.localeCompare(b.ruleId));
}
