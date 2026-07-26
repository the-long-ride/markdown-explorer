export type Delimiter = ',' | '\t' | ';' | '|';
export type HeaderMode = 'auto' | 'header' | 'noheader';
export type DelimitedWarning = 'malformedQuote' | 'unevenRows';

export interface DelimitedFenceOptions {
  delimiter?: Delimiter;
  headerMode?: HeaderMode;
}

export interface DelimitedPreview {
  delimiter: Delimiter;
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
  warnings: DelimitedWarning[];
}

export type DelimitedSourceSegmentKind = 'field' | 'syntax';

export interface DelimitedSourceSegment {
  kind: DelimitedSourceSegmentKind;
  text: string;
  columnIndex: number;
}

export function tokenizeDelimitedSource(
  source: string,
  delimiter: Delimiter,
): DelimitedSourceSegment[] {
  const segments: DelimitedSourceSegment[] = [];
  let columnIndex = 0;
  let inQuotes = false;

  const push = (kind: DelimitedSourceSegmentKind, text: string, column = columnIndex) => {
    if (!text) return;
    const previous = segments[segments.length - 1];
    if (previous && previous.kind === kind && previous.columnIndex === column) {
      previous.text += text;
      return;
    }
    segments.push({ kind, text, columnIndex: column });
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === '\uFEFF' && index === 0) {
      push('syntax', character, 0);
      continue;
    }

    if (character === '"') {
      if (inQuotes && source[index + 1] === '"') {
        push('syntax', '""');
        index += 1;
      } else {
        inQuotes = !inQuotes;
        push('syntax', character);
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      push('syntax', character);
      columnIndex += 1;
      continue;
    }

    if (character === '\r' || character === '\n') {
      const newline = character === '\r' && source[index + 1] === '\n' ? '\r\n' : character;
      if (newline.length === 2) index += 1;
      push('syntax', newline);
      if (!inQuotes) columnIndex = 0;
      continue;
    }

    push('field', character);
  }

  return segments;
}

interface ParsedRows {
  rows: string[][];
  malformedQuote: boolean;
}

const DELIMITER_NAMES: Record<string, Delimiter> = {
  comma: ',',
  csv: ',',
  tab: '\t',
  '\\t': '\t',
  tsv: '\t',
  semicolon: ';',
  semi: ';',
  pipe: '|',
  bar: '|',
};

const HEADER_WORDS = new Set([
  'id', 'name', 'title', 'date', 'time', 'month', 'year', 'day', 'category',
  'type', 'status', 'description', 'count', 'total', 'value', 'amount', 'price',
  'email', 'phone', 'address', 'city', 'country', 'version', 'platform',
  'label', 'note', 'notes', 'summary', 'details', 'url', 'link', 'path', 'file',
  'filename', 'owner', 'author', 'user', 'key', 'code', 'message', 'result',
  'desktop', 'website', 'browser', 'chromium', 'tauri', 'vscode', 'downloads',
]);

export function parseDelimitedFenceInfo(info: string): DelimitedFenceOptions {
  const parts = info.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const language = parts[0] ?? 'csv';
  let delimiter: Delimiter | undefined = language === 'tsv' ? '\t' : undefined;
  let headerMode: HeaderMode = 'auto';

  for (const part of parts.slice(1)) {
    if (part === 'header') headerMode = 'header';
    else if (part === 'noheader' || part === 'no-header') headerMode = 'noheader';
    else if (part.startsWith('delimiter=')) {
      const raw = part.slice('delimiter='.length);
      delimiter = DELIMITER_NAMES[raw] ?? (raw.length === 1 && [',', '\t', ';', '|'].includes(raw)
        ? raw as Delimiter
        : delimiter);
    }
  }

  return { delimiter, headerMode };
}

function parseRows(source: string, delimiter: Delimiter): ParsedRows {
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let malformedQuote = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else if (char === '\r') {
        if (text[index + 1] === '\n') index += 1;
        field += '\n';
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length === 0) inQuotes = true;
      else field += char;
      continue;
    }
    if (char === delimiter) {
      pushField();
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      pushRow();
      continue;
    }
    field += char;
  }

  if (inQuotes) malformedQuote = true;
  if (field.length > 0 || row.length > 0 || (text.length > 0 && text.endsWith(delimiter))) {
    pushRow();
  }

  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === '')) {
    rows.pop();
  }

  return { rows, malformedQuote };
}

function modeWidth(rows: readonly string[][]): { width: number; count: number } {
  const counts = new Map<number, number>();
  for (const row of rows) counts.set(row.length, (counts.get(row.length) ?? 0) + 1);
  let width = 0;
  let count = 0;
  for (const [candidateWidth, candidateCount] of counts) {
    if (candidateCount > count || (candidateCount === count && candidateWidth > width)) {
      width = candidateWidth;
      count = candidateCount;
    }
  }
  return { width, count };
}

export function detectDelimiter(source: string): Delimiter {
  const candidates: Delimiter[] = [',', '\t', ';', '|'];
  let best: { delimiter: Delimiter; score: number } = { delimiter: ',', score: Number.NEGATIVE_INFINITY };

  for (const delimiter of candidates) {
    const parsed = parseRows(source, delimiter);
    const sampledRows = parsed.rows.slice(0, 40);
    const { width, count } = modeWidth(sampledRows);
    const multiColumnRows = sampledRows.filter((row) => row.length > 1).length;
    const inconsistency = sampledRows.reduce((sum, row) => sum + Math.abs(row.length - width), 0);
    const score = width > 1
      ? (count * 20) + (multiColumnRows * 8) + width - (inconsistency * 5) - (parsed.malformedQuote ? 10 : 0)
      : -100;
    if (score > best.score) best = { delimiter, score };
  }

  return best.delimiter;
}

export function excelColumnName(index: number): string {
  if (!Number.isInteger(index) || index < 0) return '';
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

type CellKind = 'empty' | 'boolean' | 'number' | 'date' | 'text';

function cellKind(value: string): CellKind {
  const trimmed = value.trim();
  if (!trimmed) return 'empty';
  if (/^(?:true|false|yes|no)$/i.test(trimmed)) return 'boolean';
  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return 'number';
  if (/^\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?(?:[ T].*)?$/.test(trimmed)
    || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(trimmed)) return 'date';
  return 'text';
}

function dominantKind(values: readonly string[]): CellKind {
  const counts = new Map<CellKind, number>();
  for (const value of values) {
    const kind = cellKind(value);
    if (kind === 'empty') continue;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  let result: CellKind = 'empty';
  let best = 0;
  for (const [kind, count] of counts) {
    if (count > best) {
      result = kind;
      best = count;
    }
  }
  return result;
}

function looksLikeHeaderLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  if (!normalized) return false;
  if (HEADER_WORDS.has(normalized)) return true;
  return normalized.split(' ').some((word) => HEADER_WORDS.has(word))
    || /^[a-z_][a-z0-9_ -]{0,40}$/i.test(value.trim()) && /[_ -]/.test(value.trim());
}

export function inferHeader(rows: readonly string[][]): boolean {
  if (rows.length < 2) return false;
  const width = Math.max(...rows.map((row) => row.length));
  const first = rows[0];
  if (width === 0 || first.some((value) => !value.trim())) return false;
  const normalized = first.map((value) => value.trim().toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) return false;

  let typeMismatchScore = 0;
  let typedColumns = 0;
  let labelScore = 0;
  for (let column = 0; column < width; column += 1) {
    const firstKind = cellKind(first[column] ?? '');
    const laterKind = dominantKind(rows.slice(1).map((row) => row[column] ?? ''));
    if (laterKind !== 'empty') typedColumns += 1;
    if (firstKind === 'text' && laterKind !== 'text' && laterKind !== 'empty') typeMismatchScore += 2;
    else if (firstKind !== laterKind && laterKind !== 'empty') typeMismatchScore += 1;
    if (looksLikeHeaderLabel(first[column] ?? '')) labelScore += 1;
  }

  if (typeMismatchScore >= Math.max(2, Math.ceil(typedColumns / 2))) return true;
  if (width === 1) return labelScore === 1;
  return labelScore >= Math.max(2, Math.ceil(width * 0.6));
}

function normalizeHeaders(values: readonly string[], width: number): string[] {
  const used = new Map<string, number>();
  return Array.from({ length: width }, (_, index) => {
    const base = (values[index] ?? '').trim() || excelColumnName(index);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} ${count}`;
  });
}

export function parseDelimitedText(
  source: string,
  options: DelimitedFenceOptions = {},
): DelimitedPreview {
  const delimiter = options.delimiter ?? detectDelimiter(source);
  const headerMode = options.headerMode ?? 'auto';
  const parsed = parseRows(source, delimiter);
  const rawRows = parsed.rows;
  const width = rawRows.reduce((max, row) => Math.max(max, row.length), 0);
  const unevenRows = rawRows.some((row) => row.length !== width);
  const hasHeader = headerMode === 'header'
    || (headerMode === 'auto' && inferHeader(rawRows));
  const headers = hasHeader
    ? normalizeHeaders(rawRows[0] ?? [], width)
    : Array.from({ length: width }, (_, index) => excelColumnName(index));
  const dataRows = (hasHeader ? rawRows.slice(1) : rawRows).map((row) =>
    Array.from({ length: width }, (_, index) => row[index] ?? ''),
  );
  const warnings: DelimitedWarning[] = [];
  if (parsed.malformedQuote) warnings.push('malformedQuote');
  if (unevenRows) warnings.push('unevenRows');

  return { delimiter, headers, rows: dataRows, hasHeader, warnings };
}
