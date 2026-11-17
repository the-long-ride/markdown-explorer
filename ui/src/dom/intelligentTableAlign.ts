import type { ResolvedTableColumnAlignment } from '../themeTypes';

export interface IntelligentCellInput {
  text: string;
  hasCheckbox?: boolean;
}

const CHECKBOX_TOKEN_RE = /^(?:\[\s*[xX ]\s*\]|[☐☑☒✅✓✗✘])$/;
const HTML_CHECKBOX_RE = /<input\b[^>]*type\s*=\s*["']?checkbox["']?[^>]*>/i;
const BOOLEAN_RE = /^(?:true|false|yes|no)$/i;

const MONTH_NAMES =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const ISO_DATE_RE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i;
const NUMERIC_DATE_RE = /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)?$/i;
const MONTH_FIRST_DATE_RE = new RegExp(`^(?:${MONTH_NAMES})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{2,4})?$`, 'i');
const DAY_FIRST_DATE_RE = new RegExp(`^\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAMES})(?:,?\\s+\\d{2,4})?$`, 'i');
const MONTH_YEAR_RE = new RegExp(`^(?:${MONTH_NAMES})\\s+\\d{4}$`, 'i');
const TIME_RE = /^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?$/i;

const CURRENCY_PREFIX_RE = /^(?:[-+]?\s*(?:[$€£¥₩₹]|USD|EUR|GBP|JPY|CAD|AUD)\s*[-+]?|[-+]\s*[$€£¥₩₹])\s*/i;
const CURRENCY_SUFFIX_RE = /\s*(?:[$€£¥₩₹]|USD|EUR|GBP|JPY|CAD|AUD|%)$/i;
const PLAIN_NUMBER_RE = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;

function stripInlineMarkdown(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('`') && text.endsWith('`') && text.length >= 2) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/^(?:\*\*|__|\*|~~)(.+)(?:\*\*|__|\*|~~)$/s, '$1').trim();
  return text;
}

function isCheckboxCell(cell: IntelligentCellInput): boolean {
  if (cell.hasCheckbox) return true;
  const trimmed = cell.text.trim();
  if (!trimmed) return false;
  if (HTML_CHECKBOX_RE.test(trimmed)) return true;
  return CHECKBOX_TOKEN_RE.test(stripInlineMarkdown(trimmed));
}

function isBooleanCell(text: string): boolean {
  return BOOLEAN_RE.test(stripInlineMarkdown(text));
}

function isDateTimeCell(text: string): boolean {
  const cleaned = stripInlineMarkdown(text);
  if (!cleaned) return false;
  return (
    ISO_DATE_RE.test(cleaned) ||
    NUMERIC_DATE_RE.test(cleaned) ||
    MONTH_FIRST_DATE_RE.test(cleaned) ||
    DAY_FIRST_DATE_RE.test(cleaned) ||
    MONTH_YEAR_RE.test(cleaned) ||
    TIME_RE.test(cleaned)
  );
}

interface ParsedNumber {
  value: number;
  isPlain: boolean;
}

function parseNumberCell(text: string): ParsedNumber | null {
  const cleaned = stripInlineMarkdown(text);
  if (!cleaned) return null;

  if (PLAIN_NUMBER_RE.test(cleaned)) {
    const numeric = Number(cleaned.replace(/,/g, ''));
    return Number.isFinite(numeric) ? { value: numeric, isPlain: true } : null;
  }

  const stripped = cleaned.replace(CURRENCY_PREFIX_RE, '').replace(CURRENCY_SUFFIX_RE, '').trim();
  if (stripped && stripped !== cleaned && PLAIN_NUMBER_RE.test(stripped)) {
    const numeric = Number(stripped.replace(/,/g, ''));
    return Number.isFinite(numeric) ? { value: numeric, isPlain: false } : null;
  }

  return null;
}

function isSequentialNumericColumn(parsedNumbers: ParsedNumber[]): boolean {
  if (parsedNumbers.length < 2) return false;
  if (!parsedNumbers.every((item) => item.isPlain)) return false;

  const step = parsedNumbers[1].value - parsedNumbers[0].value;
  if (!(step > 0)) return false;

  for (let i = 2; i < parsedNumbers.length; i += 1) {
    const diff = parsedNumbers[i].value - parsedNumbers[i - 1].value;
    if (Math.abs(diff - step) > 1e-9) return false;
  }
  return true;
}

function isRepeatableCategoryColumn(values: string[]): boolean {
  if (values.length < 2) return false;
  if (!values.every((value) => value.length <= 30)) return false;
  const uniqueCount = new Set(values).size;
  return uniqueCount / values.length <= 0.6;
}

/**
 * Infers intelligent column alignment from cell inputs across rows.
 */
export function inferIntelligentColumnAlignmentFromCells(
  cells: IntelligentCellInput[],
): ResolvedTableColumnAlignment {
  const nonEmpty = cells.filter((cell) => cell.hasCheckbox || cell.text.trim().length > 0);
  if (nonEmpty.length === 0) return 'left';

  if (nonEmpty.every(isCheckboxCell)) return 'center';

  const normalizedTexts = nonEmpty.map((cell) => stripInlineMarkdown(cell.text));
  if (normalizedTexts.every(isBooleanCell)) return 'center';
  if (normalizedTexts.every(isDateTimeCell)) return 'center';

  const parsedNumbers = normalizedTexts.map(parseNumberCell);
  if (parsedNumbers.every((parsed): parsed is ParsedNumber => parsed !== null)) {
    return isSequentialNumericColumn(parsedNumbers) ? 'center' : 'right';
  }

  if (isRepeatableCategoryColumn(normalizedTexts)) return 'center';

  return 'left';
}

/**
 * Infers intelligent column alignment from raw string cell values.
 */
export function inferIntelligentColumnAlignment(values: string[]): ResolvedTableColumnAlignment {
  return inferIntelligentColumnAlignmentFromCells(values.map((text) => ({ text })));
}
