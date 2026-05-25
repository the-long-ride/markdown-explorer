// ============================================================
// markdown/parser.ts — Block-level markdown tokenizer
// ============================================================

// ── Token types ────────────────────────────────────────────

export type BlockToken =
  | HeadingToken
  | ParagraphToken
  | CodeBlockToken
  | BlockquoteToken
  | TableToken
  | ListToken
  | HrToken;

export interface HeadingToken   { type: 'heading';    level: number; text: string }
export interface ParagraphToken { type: 'paragraph';  text: string; isJsx?: boolean }
export interface HrToken        { type: 'hr' }

export interface CodeBlockToken {
  type: 'code';
  lang: string;
  content: string;
}

export interface BlockquoteToken {
  type: 'blockquote';
  /** Raw lines with `>` stripped */
  lines: string[];
}

export interface TableToken {
  type: 'table';
  headers: string[];
  /** Alignment per column: 'left' | 'center' | 'right' | null */
  align: Array<'left' | 'center' | 'right' | null>;
  rows: string[][];
}

export interface ListItem {
  text: string;
  isTask: boolean;
  checked: boolean;
}

export interface ListToken {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

// ── Parser ─────────────────────────────────────────────────

export interface ParseResult {
  tokens: BlockToken[];
  frontmatter: Record<string, string>;
}

export function parse(markdown: string, isMdx = false): ParseResult {
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const { body: afterFm, frontmatter } = extractFrontmatter(normalized);
  
  let body = afterFm;
  if (isMdx) {
    // Strip imports and exports from MDX body so they don't render as paragraph text
    const lines = body.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('import ') && !trimmed.startsWith('export ');
    });
    body = filteredLines.join('\n');
  }

  const lines = body.split('\n');
  const tokens = tokenize(lines, isMdx);
  return { tokens, frontmatter };
}

// ── Frontmatter ────────────────────────────────────────────

function extractFrontmatter(text: string): { body: string; frontmatter: Record<string, string> } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { body: text, frontmatter: {} };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep > 0) {
      const key = line.slice(0, sep).trim();
      const val = line.slice(sep + 1).trim();
      frontmatter[key] = val;
    }
  }
  return { body: text.slice(match[0].length), frontmatter };
}

// ── Block tokenizer ────────────────────────────────────────

function tokenize(lines: string[], isMdx = false): BlockToken[] {
  const tokens: BlockToken[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (line.trim() === '') { i++; continue; }

    // JSX Block (MDX only)
    if (isMdx && /^<[A-Za-z]/.test(line.trim())) {
      const jsxLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        jsxLines.push(lines[i]);
        i++;
      }
      tokens.push({ type: 'paragraph', text: jsxLines.join('\n'), isJsx: true });
      continue;
    }

    // Fenced code block
    const fenceMatch = /^(`{3,}|~{3,})([\w.-]*)/.exec(line);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const lang = fenceMatch[2].trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      tokens.push({ type: 'code', lang, content: codeLines.join('\n') });
      continue;
    }

    // ATX heading
    const headingMatch = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/.exec(line);
    if (headingMatch) {
      tokens.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Setext heading (underline style)
    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (/^=+$/.test(next.trim()) && line.trim()) {
        tokens.push({ type: 'heading', level: 1, text: line.trim() });
        i += 2; continue;
      }
      if (/^-+$/.test(next.trim()) && line.trim() && !line.match(/^[-*+]\s/)) {
        tokens.push({ type: 'heading', level: 2, text: line.trim() });
        i += 2; continue;
      }
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      tokens.push({ type: 'hr' });
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        bqLines.push(lines[i].slice(1).trimStart());
        i++;
      }
      tokens.push({ type: 'blockquote', lines: bqLines });
      continue;
    }

    // Table (pipe table)
    if (line.includes('|') && i + 1 < lines.length && /^[\s|:\-]+$/.test(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i].includes('|') || /^[\s|:\-]+$/.test(lines[i]))) {
        tableLines.push(lines[i]);
        i++;
      }
      const table = parseTable(tableLines);
      if (table) tokens.push(table);
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s/.test(line)) {
      const items: ListItem[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        items.push(parseListItem(lines[i].replace(/^\d+[.)]\s/, '')));
        i++;
      }
      tokens.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: ListItem[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(parseListItem(lines[i].replace(/^[-*+]\s/, '')));
        i++;
      }
      tokens.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Paragraph — collect contiguous non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|`{3,}|~{3,}|[-*_]{3,}$)/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      tokens.push({ type: 'paragraph', text: paraLines.join(' ') });
    }
  }

  return tokens;
}

// ── Table parser ───────────────────────────────────────────

function parseTable(lines: string[]): TableToken | null {
  if (lines.length < 2) return null;

  const splitCells = (row: string) =>
    row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  const headers = splitCells(lines[0]);
  const sepCells = splitCells(lines[1]);

  const align: Array<'left' | 'center' | 'right' | null> = sepCells.map(cell => {
    const s = cell.trim();
    if (s.startsWith(':') && s.endsWith(':')) return 'center';
    if (s.endsWith(':')) return 'right';
    if (s.startsWith(':')) return 'left';
    return null;
  });

  const rows = lines.slice(2).map(splitCells).filter(r => r.some(c => c !== ''));

  return { type: 'table', headers, align, rows };
}

// ── List item parser ───────────────────────────────────────

function parseListItem(text: string): ListItem {
  const taskMatch = /^\[(x| )\]\s+(.+)$/i.exec(text);
  if (taskMatch) {
    return { text: taskMatch[2], isTask: true, checked: taskMatch[1].toLowerCase() === 'x' };
  }
  return { text, isTask: false, checked: false };
}
