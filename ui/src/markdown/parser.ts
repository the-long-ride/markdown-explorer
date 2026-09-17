// ============================================================
// markdown/parser.ts — Block-level markdown tokenizer
// ============================================================

// ── Token types ────────────────────────────────────────────

import {
  getListMarker,
  isPipeTableSeparator,
  parseListItem,
  parseTable,
  parseTabTable,
} from './tableParser.ts';
import { extractFrontmatter, mapBodyOffsetToSource, scanFrontmatterPreamble } from './sourceMapping.ts';

export type BlockToken =
  | HeadingToken
  | ParagraphToken
  | HtmlCommentToken
  | CodeBlockToken
  | MathBlockToken
  | BlockquoteToken
  | TableToken
  | ListToken
  | HrToken;

interface SourceRangedToken {
  sourceStart?: number;
  sourceEnd?: number;
  sourceText?: string;
}

export interface HeadingToken extends SourceRangedToken {
  type: "heading";
  level: number;
  text: string;
}
export interface ParagraphToken extends SourceRangedToken {
  type: "paragraph";
  text: string;
  isJsx?: boolean;
}
export interface HtmlCommentToken extends SourceRangedToken {
  type: "html-comment";
  content: string;
}
export interface HrToken extends SourceRangedToken {
  type: "hr";
}

export interface CodeBlockToken extends SourceRangedToken {
  type: "code";
  lang: string;
  meta?: string;
  content: string;
}

export interface MathBlockToken extends SourceRangedToken {
  type: "math";
  content: string;
}

export interface BlockquoteToken extends SourceRangedToken {
  type: "blockquote";
  /** Raw lines with `>` stripped */
  lines: string[];
}

export interface TableToken extends SourceRangedToken {
  type: "table";
  headers: string[];
  /** Alignment per column: 'left' | 'center' | 'right' | null */
  align: Array<"left" | "center" | "right" | null>;
  rows: string[][];
}

export interface ListItem {
  text: string;
  isTask: boolean;
  checked: boolean;
  nestedMarkdown?: string;
}

export interface ListToken extends SourceRangedToken {
  type: "list";
  ordered: boolean;
  start?: number;
  items: ListItem[];
}

// ── Parser ─────────────────────────────────────────────────

export interface ParseResult {
  tokens: BlockToken[];
  frontmatter: Record<string, string>;
}

export function parse(markdown: string, isMdx = false): ParseResult {
  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const { body: afterFm, frontmatter, sourceSegments } = extractFrontmatter(normalized);

  let body = afterFm;
  if (isMdx) {
    // Hide imports/exports without changing character offsets. Inline editing
    // depends on token source ranges pointing into the original Markdown source.
    const lines = body.split("\n");
    body = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("import ") || trimmed.startsWith("export ")) {
        return " ".repeat(line.length);
      }
      return line;
    }).join("\n");
  }

  const lines = body.split("\n");
  const tokens = tokenize(lines, isMdx);
  for (const token of tokens) {
    if (token.sourceStart === undefined || token.sourceEnd === undefined) continue;
    token.sourceStart = mapBodyOffsetToSource(token.sourceStart, sourceSegments);
    token.sourceEnd = mapBodyOffsetToSource(token.sourceEnd, sourceSegments);
  }
  return { tokens, frontmatter };
}

// Frontmatter source mapping lives in sourceMapping.ts.
void scanFrontmatterPreamble;

// ── Block tokenizer ────────────────────────────────────────

function tokenize(lines: string[], isMdx = false): BlockToken[] {
  const tokens: BlockToken[] = [];
  const lineOffsets: number[] = [];
  let bodyLength = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    lineOffsets.push(bodyLength);
    bodyLength += lines[lineIndex].length + (lineIndex < lines.length - 1 ? 1 : 0);
  }
  const ranged = <T extends BlockToken>(token: T, startLine: number, endLineExclusive: number): T => {
    const lastLine = Math.max(startLine, endLineExclusive - 1);
    return {
      ...token,
      sourceStart: lineOffsets[Math.max(0, startLine)] ?? 0,
      sourceEnd: (lineOffsets[lastLine] ?? bodyLength) + (lines[lastLine]?.length ?? 0),
      sourceText: lines.slice(startLine, endLineExclusive).join('\n'),
    };
  };
  let i = 0;

  while (i < lines.length) {
    const startIndex = i;
    const line = lines[i];

    // Skip blank lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Display math block: $$ ... $$ or \[ ... \]
    if (line.trimStart().startsWith("<!--")) {
      const commentLines: string[] = [];
      let endIndex = i;
      let closingIndex = -1;
      let sourceLength = 0;

      while (endIndex < lines.length && closingIndex === -1) {
        const commentLine = lines[endIndex];
        const lineClosingIndex = commentLine.indexOf("-->");
        commentLines.push(commentLine);
        if (lineClosingIndex !== -1) {
          closingIndex = sourceLength + lineClosingIndex;
        }
        sourceLength += commentLine.length + 1;
        endIndex++;
      }

      if (closingIndex !== -1) {
        const source = commentLines.join("\n");
        const trailingText = source.slice(closingIndex + "-->".length);
        tokens.push(ranged({
          type: "html-comment",
          content: source.slice(source.indexOf("<!--") + 4, closingIndex),
        }, startIndex, endIndex));
        if (trailingText) {
          lines[endIndex - 1] = trailingText;
          i = endIndex - 1;
        } else {
          i = endIndex;
        }
        continue;
      }
    }

    const displayMathFence = line.trim();
    if (displayMathFence === "$$" || displayMathFence === "\\[") {
      const closingFence = displayMathFence === "$$" ? "$$" : "\\]";
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== closingFence) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      tokens.push(ranged({ type: "math", content: mathLines.join("\n") }, startIndex, i));
      continue;
    }

    // JSX Block (MDX only)
    if (isMdx && /^<[A-Za-z]/.test(line.trim())) {
      const jsxLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        jsxLines.push(lines[i]);
        i++;
      }
      tokens.push(ranged({
        type: "paragraph",
        text: jsxLines.join("\n"),
        isJsx: true,
      }, startIndex, i));
      continue;
    }

    // Fenced code block
    const fenceMatch = /^(`{3,}|~{3,})\s*([^\s`]*)?(?:\s+(.*?))?\s*$/.exec(line);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const lang = (fenceMatch[2] ?? '').trim();
      const meta = (fenceMatch[3] ?? '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      tokens.push(ranged({ type: "code", lang, ...(meta ? { meta } : {}), content: codeLines.join("\n") }, startIndex, i));
      continue;
    }

    // ATX heading
    const headingMatch = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/.exec(line);
    if (headingMatch) {
      i++;
      tokens.push(ranged({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      }, startIndex, i));
      continue;
    }

    // Setext heading (underline style)
    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (/^=+$/.test(next.trim()) && line.trim()) {
        i += 2;
        tokens.push(ranged({ type: "heading", level: 1, text: line.trim() }, startIndex, i));
        continue;
      }
      if (/^-+$/.test(next.trim()) && line.trim() && !line.match(/^[-*+]\s/)) {
        i += 2;
        tokens.push(ranged({ type: "heading", level: 2, text: line.trim() }, startIndex, i));
        continue;
      }
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      i++;
      tokens.push(ranged({ type: "hr" }, startIndex, i));
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        bqLines.push(lines[i].slice(1).trimStart());
        i++;
      }
      tokens.push(ranged({ type: "blockquote", lines: bqLines }, startIndex, i));
      continue;
    }

    // Table (pipe table)
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isPipeTableSeparator(lines[i + 1])
    ) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].includes("|") || /^[\s|:\-]+$/.test(lines[i]))
      ) {
        tableLines.push(lines[i]);
        i++;
      }
      const table = parseTable(tableLines);
      if (table) tokens.push(ranged(table, startIndex, i));
      continue;
    }

    // Table (tab-separated text copied from docs/spreadsheets)
    if (
      line.includes("\t") &&
      i + 1 < lines.length &&
      lines[i + 1].includes("\t")
    ) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        lines[i].includes("\t")
      ) {
        tableLines.push(lines[i]);
        i++;
      }
      const table = parseTabTable(tableLines);
      if (table) tokens.push(ranged(table, startIndex, i));
      continue;
    }

    // List tokenizer (handles both ordered & unordered, supporting indentation and nested markdown)
    const listMarker = getListMarker(line);
    if (listMarker) {
      const listType = listMarker.type;
      const listStart = listMarker.start;
      const items: ListItem[] = [];

      while (i < lines.length) {
        const currentMarker = getListMarker(lines[i]);
        if (currentMarker && currentMarker.type === listType) {
          const item = parseListItem(currentMarker.text);
          const nestedLines: string[] = [];
          i++; // consume list marker line

          // Collect indented lines that belong to this list item
          while (i < lines.length) {
            const nextLine = lines[i];
            if (nextLine.trim() === "") {
              let peek = i + 1;
              while (peek < lines.length && lines[peek].trim() === "") {
                peek++;
              }
              if (peek < lines.length && /^\s{2,}/.test(lines[peek])) {
                nestedLines.push("");
                i = peek; // skip intermediate blank lines
              } else {
                break;
              }
            } else if (/^\s{2,}/.test(nextLine)) {
              const stripCount = Math.min(
                nextLine.search(/\S/),
                currentMarker.markerLength,
              );
              nestedLines.push(nextLine.slice(stripCount));
              i++;
            } else {
              break;
            }
          }

          if (nestedLines.length > 0) {
            item.nestedMarkdown = nestedLines.join("\n");
          }
          items.push(item);
        } else {
          break;
        }

        // Peek ahead to see if the next list item exists (possibly after some blank lines)
        let peek = i;
        while (peek < lines.length && lines[peek].trim() === "") {
          peek++;
        }
        if (peek < lines.length) {
          const nextMarker = getListMarker(lines[peek]);
          if (nextMarker && nextMarker.type === listType) {
            i = peek;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      tokens.push(ranged({
        type: "list",
        ordered: listType === "ol",
        start: listStart,
        items,
      }, startIndex, i));
      continue;
    }

    // Paragraph — collect contiguous non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|>|`{3,}|~{3,}|\$\$|\\\[|[-*_]{3,}$)/.test(lines[i]) &&
      !(lines[i].trimStart().startsWith("<!--") && lines.slice(i).some((line) => line.includes("-->"))) &&
      !getListMarker(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      tokens.push(ranged({ type: "paragraph", text: paraLines.join(" ") }, startIndex, i));
    }

    // Safety fallback: if no tokenizer consumed the line, consume it as a paragraph to prevent infinite loops.
    if (i === startIndex) {
      i++;
      tokens.push(ranged({ type: "paragraph", text: lines[startIndex] }, startIndex, i));
    }
  }

  return tokens;
}

// ── List marker helper ──────────────────────────────────────
