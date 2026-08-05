import type { ListItem, TableToken } from './parser.ts';
export interface ListMarkerInfo {
  type: "ol" | "ul";
  start?: number;
  markerLength: number;
  text: string;
}

export function getListMarker(line: string): ListMarkerInfo | null {
  const match = /^(\s{0,3})(\d+[.)]|[-*+])\s+(.*)$/.exec(line);
  if (!match) return null;
  const indent = match[1];
  const marker = match[2];
  const text = match[3];

  if (/^[-*+]$/.test(marker)) {
    return {
      type: "ul",
      markerLength: indent.length + marker.length + 1,
      text,
    };
  } else {
    return {
      type: "ol",
      start: parseInt(marker, 10),
      markerLength: indent.length + marker.length + 1,
      text,
    };
  }
}

// ── Table parser ───────────────────────────────────────────

export function parseTable(lines: string[]): TableToken | null {
  if (lines.length < 2) return null;

  const headers = splitPipeCells(lines[0]);
  const sepCells = splitPipeCells(lines[1]);

  const align: Array<"left" | "center" | "right" | null> = sepCells.map(
    (cell) => {
      const s = cell.trim();
      if (s.startsWith(":") && s.endsWith(":")) return "center";
      if (s.endsWith(":")) return "right";
      if (s.startsWith(":")) return "left";
      return null;
    },
  );

  const rows = lines
    .slice(2)
    .filter((row) => !isPipeTableSeparator(row))
    .map((row) => normalizeTableCells(splitPipeCells(row), headers.length))
    .filter((r) => r.some((c) => c !== ""));

  return { type: "table", headers, align, rows };
}

export function parseTabTable(lines: string[]): TableToken | null {
  if (lines.length < 2) return null;

  const headers = splitTabCells(lines[0]);
  if (headers.length < 2) return null;

  const rows = lines
    .slice(1)
    .map((row) => normalizeTableCells(splitTabCells(row), headers.length))
    .filter((r) => r.some((c) => c !== ""));

  return {
    type: "table",
    headers,
    align: headers.map(() => null),
    rows,
  };
}

export function isPipeTableSeparator(line: string): boolean {
  if (!line.includes("|")) return false;
  const cells = splitPipeCells(line);
  return (
    cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()))
  );
}

function splitPipeCells(row: string): string[] {
  let source = row.trim();
  if (source.startsWith("|")) source = source.slice(1);
  if (source.endsWith("|")) source = source.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  let inCode = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (ch === "\\" && source[i + 1] === "|") {
      current += "|";
      i++;
      continue;
    }

    if (ch === "`") {
      let run = "`";
      while (source[i + 1] === "`") {
        run += "`";
        i++;
      }
      inCode = !inCode;
      current += run;
      continue;
    }

    if (ch === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function splitTabCells(row: string): string[] {
  return row.split("\t").map((cell) => cell.trim());
}

function normalizeTableCells(cells: string[], columnCount: number): string[] {
  if (columnCount <= 0 || cells.length === columnCount) return cells;
  if (cells.length < columnCount) {
    return [...cells, ...Array(columnCount - cells.length).fill("")];
  }
  if (columnCount === 2) {
    return [cells.slice(0, -1).join(" | "), cells[cells.length - 1]];
  }
  return [
    ...cells.slice(0, columnCount - 1),
    cells.slice(columnCount - 1).join(" | "),
  ];
}

// ── List item parser ───────────────────────────────────────

export function parseListItem(text: string): ListItem {
  const taskMatch = /^\[(x| )\]\s+(.+)$/i.exec(text);
  if (taskMatch) {
    return {
      text: taskMatch[2],
      isTask: true,
      checked: taskMatch[1].toLowerCase() === "x",
    };
  }
  return { text, isTask: false, checked: false };
}
