export interface MarkdownSelection {
  readonly from: number;
  readonly to: number;
}

export interface MarkdownTransformResult {
  readonly source: string;
  readonly selection: MarkdownSelection;
}

export type MarkdownFormatCommand =
  | 'bold' | 'italic'
  | 'heading-1' | 'heading-2' | 'heading-3'
  | 'heading-4' | 'heading-5' | 'heading-6'
  | 'quote' | 'inline-code' | 'code-block' | 'link'
  | 'bullet-list' | 'numbered-list' | 'task-list' | 'table';

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

const LIST_PREFIX = /^\s*(?:(?:[-+*])|(?:\d+[.)])|(?:[-+*]\s+\[[ xX]\]))\s+/;

function stripLinePrefix(line: string): string {
  return line.replace(LIST_PREFIX, '').replace(/^\s*>\s?/, '');
}

function applyHeading(
  source: string,
  selection: MarkdownSelection,
  level: number,
): MarkdownTransformResult {
  const marker = `${'#'.repeat(level)} `;
  return replaceSelectedLines(source, selection, (line) => {
    const content = line.replace(/^\s*#{1,6}\s+/, '');
    return `${marker}${content}`;
  });
}

function applyLinePrefix(
  source: string,
  selection: MarkdownSelection,
  prefix: (index: number) => string,
): MarkdownTransformResult {
  return replaceSelectedLines(source, selection, (line, index) => `${prefix(index)}${stripLinePrefix(line)}`);
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

export function applyMarkdownFormat(
  source: string,
  selection: MarkdownSelection,
  command: MarkdownFormatCommand,
): MarkdownTransformResult {
  switch (command) {
    case 'bold': return wrapSelection(source, selection, '**');
    case 'italic': return wrapSelection(source, selection, '*');
    case 'inline-code': return wrapSelection(source, selection, '`');
    case 'link': return applyLink(source, selection);
    case 'code-block': return applyCodeBlock(source, selection);
    case 'table': return applyTable(source, selection);
    case 'quote': return applyLinePrefix(source, selection, () => '> ');
    case 'bullet-list': return applyLinePrefix(source, selection, () => '- ');
    case 'numbered-list': return applyLinePrefix(source, selection, (index) => `${index + 1}. `);
    case 'task-list': return applyLinePrefix(source, selection, () => '- [ ] ');
    case 'heading-1': return applyHeading(source, selection, 1);
    case 'heading-2': return applyHeading(source, selection, 2);
    case 'heading-3': return applyHeading(source, selection, 3);
    case 'heading-4': return applyHeading(source, selection, 4);
    case 'heading-5': return applyHeading(source, selection, 5);
    case 'heading-6': return applyHeading(source, selection, 6);
  }
}
