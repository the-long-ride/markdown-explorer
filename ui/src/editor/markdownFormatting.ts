export interface MarkdownSelection {
  readonly from: number;
  readonly to: number;
}

export interface MarkdownTransformResult {
  readonly source: string;
  readonly selection: MarkdownSelection;
}

export type MarkdownFormatCommand =
  | 'bold' | 'italic' | 'underline'
  | 'heading-1' | 'heading-2' | 'heading-3'
  | 'heading-4' | 'heading-5' | 'heading-6'
  | 'quote' | 'inline-code' | 'code-block' | 'link'
  | 'bullet-list' | 'numbered-list' | 'task-list' | 'table'
  | 'properties';

function normalizeSelection(source: string, selection: MarkdownSelection): MarkdownSelection {
  const from = Math.max(0, Math.min(source.length, Math.min(selection.from, selection.to)));
  const to = Math.max(from, Math.min(source.length, Math.max(selection.from, selection.to)));
  return { from, to };
}

function wrapSelection(
  source: string,
  selection: MarkdownSelection,
  before: string,
  after = before,
): MarkdownTransformResult {
  const { from, to } = normalizeSelection(source, selection);
  const selected = source.slice(from, to);
  const replacement = `${before}${selected}${after}`;
  return {
    source: source.slice(0, from) + replacement + source.slice(to),
    selection: selected
      ? { from: from + before.length, to: from + before.length + selected.length }
      : { from: from + before.length, to: from + before.length },
  };
}

function toggleWrap(
  source: string,
  selection: MarkdownSelection,
  before: string,
  after = before,
): MarkdownTransformResult {
  const { from, to } = normalizeSelection(source, selection);
  const selected = source.slice(from, to);

  if (
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const unwrapped = selected.slice(before.length, selected.length - after.length);
    return {
      source: source.slice(0, from) + unwrapped + source.slice(to),
      selection: { from, to: from + unwrapped.length },
    };
  }

  if (
    from >= before.length &&
    to + after.length <= source.length &&
    source.slice(from - before.length, from) === before &&
    source.slice(to, to + after.length) === after
  ) {
    return {
      source: source.slice(0, from - before.length) + selected + source.slice(to + after.length),
      selection: { from: from - before.length, to: from - before.length + selected.length },
    };
  }

  return wrapSelection(source, selection, before, after);
}

function toggleItalic(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const { from, to } = normalizeSelection(source, selection);
  const selected = source.slice(from, to);

  if (
    selected.length >= 2 &&
    selected.startsWith('*') &&
    selected.endsWith('*') &&
    !(selected.startsWith('**') && selected.endsWith('**'))
  ) {
    const unwrapped = selected.slice(1, -1);
    return {
      source: source.slice(0, from) + unwrapped + source.slice(to),
      selection: { from, to: from + unwrapped.length },
    };
  }

  if (
    from >= 1 &&
    to + 1 <= source.length &&
    source[from - 1] === '*' &&
    source[to] === '*' &&
    source[from - 2] !== '*' &&
    source[to + 1] !== '*'
  ) {
    return {
      source: source.slice(0, from - 1) + selected + source.slice(to + 1),
      selection: { from: from - 1, to: from - 1 + selected.length },
    };
  }

  return wrapSelection(source, selection, '*');
}

function toggleUnderline(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const { from, to } = normalizeSelection(source, selection);
  const selected = source.slice(from, to);

  if (/^<u>[\s\S]*<\/u>$/i.test(selected)) {
    const unwrapped = selected.replace(/^<u>/i, '').replace(/<\/u>$/i, '');
    return {
      source: source.slice(0, from) + unwrapped + source.slice(to),
      selection: { from, to: from + unwrapped.length },
    };
  }

  if (
    from >= 3 &&
    to + 4 <= source.length &&
    /^<u>$/i.test(source.slice(from - 3, from)) &&
    /^<\/u>$/i.test(source.slice(to, to + 4))
  ) {
    return {
      source: source.slice(0, from - 3) + selected + source.slice(to + 4),
      selection: { from: from - 3, to: from - 3 + selected.length },
    };
  }

  return wrapSelection(source, selection, '<u>', '</u>');
}

function selectedLineRange(source: string, selection: MarkdownSelection): { start: number; end: number; text: string } {
  const normalized = normalizeSelection(source, selection);
  const start = source.lastIndexOf('\n', Math.max(0, normalized.from - 1)) + 1;
  let end = source.indexOf('\n', normalized.to);
  if (end < 0) end = source.length;
  return { start, end, text: source.slice(start, end) };
}

function replaceSelectedLines(
  source: string,
  selection: MarkdownSelection,
  transform: (line: string, index: number) => string,
): MarkdownTransformResult {
  const range = selectedLineRange(source, selection);
  const replacement = range.text.split('\n').map(transform).join('\n');
  return {
    source: source.slice(0, range.start) + replacement + source.slice(range.end),
    selection: { from: range.start, to: range.start + replacement.length },
  };
}

const TASK_PREFIX = /^\s*[-*+]\s+\[[ xX]\]\s+/;
const BULLET_PREFIX = /^\s*[-*+]\s+/;
const NUMBERED_PREFIX = /^\s*\d+[.)]\s+/;
const QUOTE_PREFIX = /^\s*>\s?/;
const LIST_PREFIX = /^\s*(?:(?:[-*+]\s+\[[ xX]\])|(?:[-*+])|(?:\d+[.)]))\s+/;

function stripLinePrefix(line: string): string {
  return line.replace(LIST_PREFIX, '').replace(QUOTE_PREFIX, '');
}

function formatEmptyLine(
  source: string,
  range: { start: number; end: number },
  prefix: string,
): MarkdownTransformResult {
  const cursor = range.start + prefix.length;
  return {
    source: source.slice(0, range.start) + prefix + source.slice(range.end),
    selection: { from: cursor, to: cursor },
  };
}

function isSingleEmptyLine(text: string): boolean {
  return !text.includes('\n') && text.trim().length === 0;
}

function applyHeading(
  source: string,
  selection: MarkdownSelection,
  level: number,
): MarkdownTransformResult {
  const marker = `${'#'.repeat(level)} `;
  const range = selectedLineRange(source, selection);
  if (isSingleEmptyLine(range.text)) return formatEmptyLine(source, range, marker);
  const lines = range.text.split('\n').filter((l) => l.trim().length > 0);
  const allMatch = lines.length > 0 && lines.every((line) => line.startsWith(marker));

  return replaceSelectedLines(source, selection, (line) => {
    if (line.trim().length === 0) return line;
    const content = line.replace(/^\s*#{1,6}\s+/, '');
    if (allMatch) return content;
    return `${marker}${content}`;
  });
}

function applyQuote(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const range = selectedLineRange(source, selection);
  if (isSingleEmptyLine(range.text)) return formatEmptyLine(source, range, '> ');
  const lines = range.text.split('\n').filter((l) => l.trim().length > 0);
  const allMatch = lines.length > 0 && lines.every((line) => QUOTE_PREFIX.test(line));

  return replaceSelectedLines(source, selection, (line) => {
    if (line.trim().length === 0) return line;
    if (allMatch) return line.replace(QUOTE_PREFIX, '');
    return `> ${stripLinePrefix(line)}`;
  });
}

function applyBulletList(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const range = selectedLineRange(source, selection);
  if (isSingleEmptyLine(range.text)) return formatEmptyLine(source, range, '- ');
  const lines = range.text.split('\n').filter((l) => l.trim().length > 0);
  const allMatch = lines.length > 0 && lines.every((line) => BULLET_PREFIX.test(line) && !TASK_PREFIX.test(line));

  return replaceSelectedLines(source, selection, (line) => {
    if (line.trim().length === 0) return line;
    if (allMatch) return line.replace(BULLET_PREFIX, '');
    return `- ${stripLinePrefix(line)}`;
  });
}

function applyNumberedList(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const range = selectedLineRange(source, selection);
  if (isSingleEmptyLine(range.text)) return formatEmptyLine(source, range, '1. ');
  const lines = range.text.split('\n').filter((l) => l.trim().length > 0);
  const allMatch = lines.length > 0 && lines.every((line) => NUMBERED_PREFIX.test(line));

  let counter = 1;
  return replaceSelectedLines(source, selection, (line) => {
    if (line.trim().length === 0) return line;
    if (allMatch) return line.replace(NUMBERED_PREFIX, '');
    const result = `${counter}. ${stripLinePrefix(line)}`;
    counter += 1;
    return result;
  });
}

function applyTaskList(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const range = selectedLineRange(source, selection);
  if (isSingleEmptyLine(range.text)) return formatEmptyLine(source, range, '- [ ] ');
  const lines = range.text.split('\n').filter((l) => l.trim().length > 0);
  const allMatch = lines.length > 0 && lines.every((line) => TASK_PREFIX.test(line));

  return replaceSelectedLines(source, selection, (line) => {
    if (line.trim().length === 0) return line;
    if (allMatch) return line.replace(TASK_PREFIX, '');
    return `- [ ] ${stripLinePrefix(line)}`;
  });
}

const MARKDOWN_LINK_REGEX = /^\[([^\]]*)\]\(([^)]*)\)$/;
const URL_LIKE_REGEX = /^(https?:\/\/|mailto:|#)[^\s]+$/i;

export function parseMarkdownLinkSelection(selectedText: string): { label: string; url: string } {
  const linkMatch = selectedText.match(MARKDOWN_LINK_REGEX);
  if (linkMatch) {
    return { label: linkMatch[1], url: linkMatch[2] };
  }
  const trimmed = selectedText.trim();
  if (URL_LIKE_REGEX.test(trimmed)) {
    return { label: '', url: trimmed };
  }
  return { label: selectedText, url: '' };
}

export function applyMarkdownLink(
  source: string,
  selection: MarkdownSelection,
  url: string,
  label?: string,
): MarkdownTransformResult {
  const { from, to } = normalizeSelection(source, selection);
  const cleanUrl = url.trim() || 'url';
  const selected = source.slice(from, to);
  const cleanLabel = (label ?? '').trim() || selected || cleanUrl;
  const replacement = `[${cleanLabel}](${cleanUrl})`;
  return {
    source: source.slice(0, from) + replacement + source.slice(to),
    selection: { from: from + 1, to: from + 1 + cleanLabel.length },
  };
}

function applyLink(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const { from, to } = normalizeSelection(source, selection);
  const selected = source.slice(from, to);
  const label = selected || 'text';
  const replacement = `[${label}](url)`;
  return {
    source: source.slice(0, from) + replacement + source.slice(to),
    selection: { from: from + 1, to: from + 1 + label.length },
  };
}

function applyCodeBlock(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const { from, to } = normalizeSelection(source, selection);
  const selected = source.slice(from, to);
  const replacement = selected ? `\`\`\`\n${selected}\n\`\`\`` : '```\n\n```';
  const contentStart = from + 4;
  return {
    source: source.slice(0, from) + replacement + source.slice(to),
    selection: selected
      ? { from: contentStart, to: contentStart + selected.length }
      : { from: contentStart, to: contentStart },
  };
}

function applyTable(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const { from, to } = normalizeSelection(source, selection);
  const table = '| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |';
  return {
    source: source.slice(0, from) + table + source.slice(to),
    selection: { from: from + 2, to: from + 10 },
  };
}

const DEFAULT_PROPERTY_VALUE =
  'property name - If you use the string/ text, please wrap them with quote block like this';

function applyProperties(source: string, selection: MarkdownSelection): MarkdownTransformResult {
  const { from, to } = normalizeSelection(source, selection);
  const selected = source.slice(from, to);
  const value = selected || DEFAULT_PROPERTY_VALUE;
  const prefix = from > 0 && source[from - 1] !== '\n' ? '\n' : '';
  const block = `---\nname: "${value}"\n---\n\n`;
  const replacement = `${prefix}${block}`;
  const valueStart = from + prefix.length + '---\nname: "'.length;
  const valueEnd = valueStart + value.length;
  return {
    source: source.slice(0, from) + replacement + source.slice(to),
    selection: { from: valueStart, to: valueEnd },
  };
}

export function applyMarkdownFormat(
  source: string,
  selection: MarkdownSelection,
  command: MarkdownFormatCommand,
): MarkdownTransformResult {
  switch (command) {
    case 'bold': return toggleWrap(source, selection, '**');
    case 'italic': return toggleItalic(source, selection);
    case 'underline': return toggleUnderline(source, selection);
    case 'inline-code': return toggleWrap(source, selection, '`');
    case 'link': return applyLink(source, selection);
    case 'code-block': return applyCodeBlock(source, selection);
    case 'table': return applyTable(source, selection);
    case 'properties': return applyProperties(source, selection);
    case 'quote': return applyQuote(source, selection);
    case 'bullet-list': return applyBulletList(source, selection);
    case 'numbered-list': return applyNumberedList(source, selection);
    case 'task-list': return applyTaskList(source, selection);
    case 'heading-1': return applyHeading(source, selection, 1);
    case 'heading-2': return applyHeading(source, selection, 2);
    case 'heading-3': return applyHeading(source, selection, 3);
    case 'heading-4': return applyHeading(source, selection, 4);
    case 'heading-5': return applyHeading(source, selection, 5);
    case 'heading-6': return applyHeading(source, selection, 6);
  }
}
