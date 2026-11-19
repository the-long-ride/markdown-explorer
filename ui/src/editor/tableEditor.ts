export type TableAlignment = 'left' | 'center' | 'right' | null;

export interface TableData {
  headers: string[];
  alignments: TableAlignment[];
  rows: string[][];
}

export interface TableRange {
  from: number;
  to: number;
  text: string;
  data: TableData;
}

export function splitPipeCells(row: string): string[] {
  let source = row.trim();
  if (source.startsWith('|')) source = source.slice(1);
  if (source.endsWith('|')) source = source.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  let inCode = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\' && source[i + 1] === '|') {
      current += '|';
      i++;
      continue;
    }
    if (ch === '`') {
      let run = '`';
      while (source[i + 1] === '`') {
        run += '`';
        i++;
      }
      inCode = !inCode;
      current += run;
      continue;
    }
    if (ch === '|' && !inCode) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

export function isPipeTableSeparator(line: string): boolean {
  if (!line.includes('|')) return false;
  const cells = splitPipeCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

function parseAlignment(cell: string): TableAlignment {
  const s = cell.trim();
  if (s.startsWith(':') && s.endsWith(':')) return 'center';
  if (s.endsWith(':')) return 'right';
  if (s.startsWith(':')) return 'left';
  return null;
}

export function parseMarkdownTable(markdown: string): TableData | null {
  const lines = markdown.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  if (!lines[0].includes('|') || !isPipeTableSeparator(lines[1])) return null;

  const headers = splitPipeCells(lines[0]);
  const sepCells = splitPipeCells(lines[1]);
  if (headers.length === 0 || sepCells.length === 0) return null;

  const alignments: TableAlignment[] = Array.from({ length: headers.length }, (_, i) => {
    return i < sepCells.length ? parseAlignment(sepCells[i]) : null;
  });

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|') || isPipeTableSeparator(line)) continue;
    const rawCells = splitPipeCells(line);
    const rowCells = Array.from({ length: headers.length }, (_, colIdx) => rawCells[colIdx] ?? '');
    rows.push(rowCells);
  }

  return { headers, alignments, rows };
}

function formatSeparator(alignment: TableAlignment, width: number): string {
  const minWidth = Math.max(3, width);
  switch (alignment) {
    case 'center':
      return `:${'-'.repeat(Math.max(1, minWidth - 2))}:`;
    case 'right':
      return `${'-'.repeat(Math.max(2, minWidth - 1))}:`;
    case 'left':
      return `:${'-'.repeat(Math.max(2, minWidth - 1))}`;
    default:
      return '-'.repeat(minWidth);
  }
}

export function serializeMarkdownTable(data: TableData): string {
  const colCount = data.headers.length;
  if (colCount === 0) return '';

  const colWidths: number[] = Array.from({ length: colCount }, (_, colIdx) => {
    let maxLen = Math.max(3, (data.headers[colIdx] ?? '').length);
    for (const row of data.rows) {
      const cellLen = (row[colIdx] ?? '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    return maxLen;
  });

  const headerLine = `| ${data.headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ')} |`;
  const sepLine = `| ${data.alignments.map((align, i) => formatSeparator(align, colWidths[i])).join(' | ')} |`;

  const bodyLines = data.rows.map((row) => {
    const cells = Array.from({ length: colCount }, (_, i) => {
      const cell = row[i] ?? '';
      return cell.padEnd(colWidths[i]);
    });
    return `| ${cells.join(' | ')} |`;
  });

  return [headerLine, sepLine, ...bodyLines].join('\n');
}

export function buildCustomTable(rows: number, cols: number): string {
  const columnCount = Math.max(1, Math.min(20, Math.floor(cols)));
  const totalRows = Math.max(1, Math.min(50, Math.floor(rows)));

  const headers = Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
  const alignments: TableAlignment[] = Array(columnCount).fill(null);

  const dataRowsCount = Math.max(0, totalRows - 1);
  let valueCounter = 1;
  const dataRows: string[][] = [];

  for (let r = 0; r < dataRowsCount; r++) {
    const row = Array.from({ length: columnCount }, () => `Value ${valueCounter++}`);
    dataRows.push(row);
  }

  // If table only has 1 row, add 1 empty row for valid markdown representation
  if (dataRows.length === 0) {
    dataRows.push(Array(columnCount).fill(''));
  }

  return serializeMarkdownTable({ headers, alignments, rows: dataRows });
}

export function insertRow(data: TableData, atIndex: number, position: 'above' | 'below'): TableData {
  const newRow = Array(data.headers.length).fill('');
  const insertIndex = position === 'above' ? Math.max(0, atIndex) : atIndex + 1;
  const nextRows = [...data.rows];
  nextRows.splice(Math.max(0, Math.min(nextRows.length, insertIndex)), 0, newRow);
  return { ...data, rows: nextRows };
}

export function deleteRow(data: TableData, atIndex: number): TableData {
  if (atIndex < 0 || atIndex >= data.rows.length) return data;
  const nextRows = data.rows.filter((_, idx) => idx !== atIndex);
  if (nextRows.length === 0) {
    nextRows.push(Array(data.headers.length).fill(''));
  }
  return { ...data, rows: nextRows };
}

export function insertColumn(
  data: TableData,
  atIndex: number,
  position: 'left' | 'right',
  headerTitle?: string,
): TableData {
  const insertIndex = position === 'left' ? Math.max(0, atIndex) : atIndex + 1;
  const colNum = data.headers.length + 1;
  const nextHeaders = [...data.headers];
  nextHeaders.splice(insertIndex, 0, headerTitle ?? `Column ${colNum}`);

  const nextAlignments = [...data.alignments];
  nextAlignments.splice(insertIndex, 0, null);

  const nextRows = data.rows.map((row) => {
    const nextRow = [...row];
    nextRow.splice(insertIndex, 0, '');
    return nextRow;
  });

  return { headers: nextHeaders, alignments: nextAlignments, rows: nextRows };
}

export function deleteColumn(data: TableData, atIndex: number): TableData {
  if (data.headers.length <= 1 || atIndex < 0 || atIndex >= data.headers.length) return data;
  const nextHeaders = data.headers.filter((_, idx) => idx !== atIndex);
  const nextAlignments = data.alignments.filter((_, idx) => idx !== atIndex);
  const nextRows = data.rows.map((row) => row.filter((_, idx) => idx !== atIndex));
  return { headers: nextHeaders, alignments: nextAlignments, rows: nextRows };
}

export function updateCell(data: TableData, rowIndex: number, colIndex: number, value: string): TableData {
  if (rowIndex === -1) {
    if (colIndex < 0 || colIndex >= data.headers.length) return data;
    const nextHeaders = [...data.headers];
    nextHeaders[colIndex] = value;
    return { ...data, headers: nextHeaders };
  }
  if (rowIndex < 0 || rowIndex >= data.rows.length || colIndex < 0 || colIndex >= data.headers.length) {
    return data;
  }
  const nextRows = data.rows.map((r, rIdx) => {
    if (rIdx !== rowIndex) return r;
    const nextR = [...r];
    nextR[colIndex] = value;
    return nextR;
  });
  return { ...data, rows: nextRows };
}

export function clearCells(
  data: TableData,
  cells: ReadonlyArray<{ row: number; col: number }>,
): TableData {
  if (cells.length === 0) return data;
  let nextHeaders = [...data.headers];
  let headersChanged = false;
  const rowsMap = new Map<number, string[]>();

  for (const { row, col } of cells) {
    if (row === -1) {
      if (col >= 0 && col < nextHeaders.length && nextHeaders[col] !== '') {
        nextHeaders[col] = '';
        headersChanged = true;
      }
    } else if (row >= 0 && row < data.rows.length) {
      let r = rowsMap.get(row);
      if (!r) {
        r = [...data.rows[row]];
        rowsMap.set(row, r);
      }
      if (col >= 0 && col < r.length && r[col] !== '') {
        r[col] = '';
      }
    }
  }

  if (!headersChanged && rowsMap.size === 0) return data;

  const nextRows = data.rows.map((row, idx) => rowsMap.get(idx) ?? row);
  return {
    ...data,
    headers: headersChanged ? nextHeaders : data.headers,
    rows: nextRows,
  };
}

export function tablesEqual(a: TableData, b: TableData): boolean {
  if (a === b) return true;
  if (a.headers.length !== b.headers.length) return false;
  if (a.rows.length !== b.rows.length) return false;
  if (!a.headers.every((h, i) => h === b.headers[i])) return false;
  if (!a.alignments.every((align, i) => align === b.alignments[i])) return false;
  for (let r = 0; r < a.rows.length; r++) {
    const rowA = a.rows[r];
    const rowB = b.rows[r];
    if (rowA.length !== rowB.length) return false;
    for (let c = 0; c < rowA.length; c++) {
      if (rowA[c] !== rowB[c]) return false;
    }
  }
  return true;
}

export function findTableRanges(docText: string): TableRange[] {
  const ranges: TableRange[] = [];
  const lines = docText.split('\n');
  let offset = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      offset += line.length + 1;
      continue;
    }

    if (!inCodeBlock && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (line.includes('|') && isPipeTableSeparator(nextLine)) {
        const startOffset = offset;
        const tableLines = [line, nextLine];
        let j = i + 2;
        while (j < lines.length && lines[j].includes('|') && lines[j].trim().length > 0) {
          tableLines.push(lines[j]);
          j++;
        }

        const tableText = tableLines.join('\n');
        const tableEnd = startOffset + tableText.length;
        const parsed = parseMarkdownTable(tableText);
        if (parsed) {
          ranges.push({ from: startOffset, to: tableEnd, text: tableText, data: parsed });
        }

        offset += tableText.length + 1;
        i = j - 1;
        continue;
      }
    }

    offset += line.length + 1;
  }

  return ranges;
}
