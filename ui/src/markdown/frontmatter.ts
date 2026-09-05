import { isMap, isScalar, isSeq, parseDocument } from 'yaml';

export interface FrontmatterSourceSegment {
  readonly bodyStart: number;
  readonly sourceStart: number;
  readonly length: number;
}

export type FrontmatterDiagnosticSeverity = 'warning' | 'error';

export interface FrontmatterDiagnostic {
  readonly ruleId:
    | 'frontmatter/malformed'
    | 'frontmatter/duplicate-key'
    | 'frontmatter/invalid-insights-metadata';
  readonly severity: FrontmatterDiagnosticSeverity;
  readonly message: string;
  readonly line?: number;
}

export interface ParsedFrontmatterMetadata {
  readonly title?: string;
  readonly aliases: string[];
  readonly tags: string[];
}

export interface ParsedFrontmatterDocument {
  readonly body: string;
  readonly sourceSegments: FrontmatterSourceSegment[];
  readonly flatFrontmatter: Record<string, string>;
  readonly metadata: ParsedFrontmatterMetadata;
  readonly diagnostics: FrontmatterDiagnostic[];
}

interface FrontmatterRange {
  readonly start: number;
  readonly yamlStart: number;
  readonly yamlEnd: number;
  readonly end: number;
}

function emptyMetadata(): ParsedFrontmatterMetadata {
  return { aliases: [], tags: [] };
}

function fullSourceSegment(text: string): FrontmatterSourceSegment[] {
  return [{ bodyStart: 0, sourceStart: 0, length: text.length }];
}

export function scanFrontmatterPreamble(text: string): number {
  let index = 0;

  const skipBlankLines = () => {
    while (index < text.length) {
      const match = /^[ \t]*(?:\r?\n|\r)/.exec(text.slice(index));
      if (!match) break;
      index += match[0].length;
    }
  };

  skipBlankLines();
  while (text.startsWith('<!--', index)) {
    const closingIndex = text.indexOf('-->', index + 4);
    if (closingIndex === -1) return -1;
    index = closingIndex + 3;
    if (text[index] === '\r' && text[index + 1] === '\n') index += 2;
    else if (text[index] === '\n' || text[index] === '\r') index += 1;
    skipBlankLines();
  }

  return index;
}

function nextLine(text: string, start: number): { next: number; line: string } {
  const newline = text.indexOf('\n', start);
  const lineEnd = newline === -1 ? text.length : newline;
  const raw = text.slice(start, lineEnd);
  return {
    next: newline === -1 ? text.length : newline + 1,
    line: raw.endsWith('\r') ? raw.slice(0, -1) : raw,
  };
}

function findFrontmatterRange(text: string): FrontmatterRange | null {
  const start = scanFrontmatterPreamble(text);
  if (start < 0 || start >= text.length) return null;

  const opening = nextLine(text, start);
  if (!/^---[ \t]*$/.test(opening.line)) return null;

  let cursor = opening.next;
  while (cursor <= text.length) {
    const lineStart = cursor;
    const current = nextLine(text, lineStart);
    if (/^---[ \t]*$/.test(current.line)) {
      return {
        start,
        yamlStart: opening.next,
        yamlEnd: lineStart,
        end: current.next,
      };
    }
    if (current.next <= cursor || current.next >= text.length) break;
    cursor = current.next;
  }

  return null;
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < Math.min(offset, text.length); index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function sourceLine(baseLine: number, yamlSource: string, offset: number): number {
  return baseLine + lineAt(yamlSource, offset) - 1;
}

function scalarString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function nodeOffset(node: unknown): number {
  const range = (node as { range?: readonly number[] } | null)?.range;
  return range && typeof range[0] === 'number' ? range[0] : 0;
}

function nodeRawValue(node: unknown, yamlSource: string): string {
  const range = (node as { range?: readonly number[] } | null)?.range;
  if (range && typeof range[0] === 'number' && typeof range[1] === 'number') {
    return yamlSource.slice(range[0], range[1]).trim();
  }
  return '';
}

function legacyFlatFrontmatter(yamlSource: string): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const rawLine of yamlSource.split(/\r?\n/)) {
    const colonIndex = rawLine.indexOf(':');
    if (colonIndex <= 0) continue;
    const key = rawLine.slice(0, colonIndex).trim();
    if (!key) continue;
    flat[key] = rawLine.slice(colonIndex + 1).trim();
  }
  return flat;
}

function metadataList(
  key: 'aliases' | 'tags',
  node: unknown,
  diagnostics: FrontmatterDiagnostic[],
  baseLine: number,
  yamlSource: string,
): string[] {
  if (isScalar(node)) {
    const value = scalarString(node.value);
    if (value !== undefined) return [value];
  } else if (isSeq(node)) {
    const values: string[] = [];
    for (const item of node.items) {
      if (isScalar(item)) {
        const value = scalarString(item.value);
        if (value !== undefined) {
          values.push(value);
          continue;
        }
      }
      diagnostics.push({
        ruleId: 'frontmatter/invalid-insights-metadata',
        severity: 'warning',
        message: `${key} entries must be strings.`,
        line: sourceLine(baseLine, yamlSource, nodeOffset(item)),
      });
    }
    return values;
  }

  diagnostics.push({
    ruleId: 'frontmatter/invalid-insights-metadata',
    severity: 'warning',
    message: `${key} must be a string or a list of strings.`,
    line: sourceLine(baseLine, yamlSource, nodeOffset(node)),
  });
  return [];
}

function bodyMapping(source: string, range: FrontmatterRange): {
  body: string;
  sourceSegments: FrontmatterSourceSegment[];
} {
  const preamble = source.slice(0, range.start);
  const bodyAfterFrontmatter = source.slice(range.end);
  const body = `${preamble}${bodyAfterFrontmatter}`;
  const sourceSegments: FrontmatterSourceSegment[] = [];

  if (preamble.length > 0) {
    sourceSegments.push({ bodyStart: 0, sourceStart: 0, length: preamble.length });
  }
  sourceSegments.push({
    bodyStart: preamble.length,
    sourceStart: range.end,
    length: bodyAfterFrontmatter.length,
  });

  return { body, sourceSegments };
}

export function parseFrontmatterDocument(source: string): ParsedFrontmatterDocument {
  const range = findFrontmatterRange(source);
  if (!range) {
    return {
      body: source,
      sourceSegments: fullSourceSegment(source),
      flatFrontmatter: {},
      metadata: emptyMetadata(),
      diagnostics: [],
    };
  }

  const { body, sourceSegments } = bodyMapping(source, range);
  const yamlSource = source.slice(range.yamlStart, range.yamlEnd);
  const baseLine = lineAt(source, range.yamlStart);
  const diagnostics: FrontmatterDiagnostic[] = [];
  const document = parseDocument(yamlSource, {
    prettyErrors: false,
    uniqueKeys: false,
  });

  if (document.errors.length > 0) {
    for (const error of document.errors) {
      diagnostics.push({
        ruleId: 'frontmatter/malformed',
        severity: 'error',
        message: error.message,
        line: sourceLine(baseLine, yamlSource, error.pos?.[0] ?? 0),
      });
    }
    return {
      body,
      sourceSegments,
      flatFrontmatter: legacyFlatFrontmatter(yamlSource),
      metadata: emptyMetadata(),
      diagnostics,
    };
  }

  if (!document.contents || !isMap(document.contents)) {
    if (yamlSource.trim() !== '') {
      diagnostics.push({
        ruleId: 'frontmatter/malformed',
        severity: 'error',
        message: 'Frontmatter must be a YAML mapping.',
        line: baseLine,
      });
    }
    return { body, sourceSegments, flatFrontmatter: {}, metadata: emptyMetadata(), diagnostics };
  }

  const keyedPairs = document.contents.items.flatMap((pair) => {
    if (!isScalar(pair.key) || typeof pair.key.value !== 'string') return [];
    return [{ key: pair.key.value, pair }];
  });
  const keyCounts = new Map<string, number>();
  for (const { key } of keyedPairs) keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  const duplicateKeys = new Set(
    [...keyCounts].filter(([, count]) => count > 1).map(([key]) => key),
  );

  const reportedDuplicateKeys = new Set<string>();
  for (const { key, pair } of keyedPairs) {
    if (!duplicateKeys.has(key) || reportedDuplicateKeys.has(key)) continue;
    reportedDuplicateKeys.add(key);
    diagnostics.push({
      ruleId: 'frontmatter/duplicate-key',
      severity: 'error',
      message: `Duplicate frontmatter key "${key}" is ignored.`,
      line: sourceLine(baseLine, yamlSource, nodeOffset(pair.key)),
    });
  }

  const flatFrontmatter: Record<string, string> = {};
  const metadata: { title?: string; aliases: string[]; tags: string[] } = emptyMetadata();

  for (const { key, pair } of keyedPairs) {
    if (duplicateKeys.has(key)) continue;
    flatFrontmatter[key] = nodeRawValue(pair.value, yamlSource);

    if (key === 'title') {
      if (isScalar(pair.value)) {
        const title = scalarString(pair.value.value);
        if (title !== undefined) {
          metadata.title = title;
          continue;
        }
      }
      diagnostics.push({
        ruleId: 'frontmatter/invalid-insights-metadata',
        severity: 'warning',
        message: 'title must be a string.',
        line: sourceLine(baseLine, yamlSource, nodeOffset(pair.value ?? pair.key)),
      });
    } else if (key === 'aliases') {
      metadata.aliases = metadataList('aliases', pair.value, diagnostics, baseLine, yamlSource);
    } else if (key === 'tags') {
      metadata.tags = metadataList('tags', pair.value, diagnostics, baseLine, yamlSource);
    }
  }

  return { body, sourceSegments, flatFrontmatter, metadata, diagnostics };
}
