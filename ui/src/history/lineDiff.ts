export type DiffLine =
  | { readonly type: 'context'; readonly left: number; readonly right: number; readonly text: string }
  | { readonly type: 'remove'; readonly left: number; readonly text: string }
  | { readonly type: 'add'; readonly right: number; readonly text: string };

export interface DiffHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly DiffLine[];
}

type PrimitiveDiff =
  | { type: 'context'; text: string }
  | { type: 'remove'; text: string }
  | { type: 'add'; text: string };

function splitLines(source: string): string[] {
  if (source === '') return [];
  return source.replace(/\r\n?/g, '\n').split('\n');
}

function backtrack(trace: readonly Map<number, number>[], left: readonly string[], right: readonly string[]): PrimitiveDiff[] {
  let x = left.length;
  let y = right.length;
  const reversed: PrimitiveDiff[] = [];

  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const frontier = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && (frontier.get(k - 1) ?? Number.NEGATIVE_INFINITY) < (frontier.get(k + 1) ?? Number.NEGATIVE_INFINITY))
      ? k + 1
      : k - 1;
    const prevX = frontier.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      reversed.push({ type: 'context', text: left[x - 1] });
      x -= 1;
      y -= 1;
    }
    if (d === 0) break;
    if (x === prevX) {
      reversed.push({ type: 'add', text: right[y - 1] });
      y -= 1;
    } else {
      reversed.push({ type: 'remove', text: left[x - 1] });
      x -= 1;
    }
  }

  while (x > 0 && y > 0 && left[x - 1] === right[y - 1]) {
    reversed.push({ type: 'context', text: left[x - 1] });
    x -= 1;
    y -= 1;
  }
  while (x > 0) reversed.push({ type: 'remove', text: left[--x] });
  while (y > 0) reversed.push({ type: 'add', text: right[--y] });

  return reversed.reverse();
}

function shortestEditScript(left: readonly string[], right: readonly string[]): PrimitiveDiff[] {
  if (left.length === 0) return right.map((text) => ({ type: 'add' as const, text }));
  if (right.length === 0) return left.map((text) => ({ type: 'remove' as const, text }));

  const max = left.length + right.length;
  let frontier = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];

  for (let d = 0; d <= max; d += 1) {
    trace.push(new Map(frontier));
    const next = new Map<number, number>();
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (frontier.get(k - 1) ?? -1) < (frontier.get(k + 1) ?? -1))) {
        x = frontier.get(k + 1) ?? 0;
      } else {
        x = (frontier.get(k - 1) ?? 0) + 1;
      }
      let y = x - k;
      while (x < left.length && y < right.length && left[x] === right[y]) {
        x += 1;
        y += 1;
      }
      next.set(k, x);
      if (x >= left.length && y >= right.length) return backtrack(trace, left, right);
    }
    frontier = next;
  }
  return [];
}

function normalizeChangeOrder(operations: readonly PrimitiveDiff[]): PrimitiveDiff[] {
  const normalized: PrimitiveDiff[] = [];
  for (let index = 0; index < operations.length;) {
    if (operations[index].type === 'context') {
      normalized.push(operations[index]);
      index += 1;
      continue;
    }
    const changed: PrimitiveDiff[] = [];
    while (index < operations.length && operations[index].type !== 'context') {
      changed.push(operations[index]);
      index += 1;
    }
    normalized.push(...changed.filter((line) => line.type === 'remove'));
    normalized.push(...changed.filter((line) => line.type === 'add'));
  }
  return normalized;
}

function numberLines(operations: readonly PrimitiveDiff[]): DiffLine[] {
  let leftLine = 1;
  let rightLine = 1;
  return operations.map((operation) => {
    if (operation.type === 'context') {
      const line: DiffLine = { type: 'context', left: leftLine, right: rightLine, text: operation.text };
      leftLine += 1;
      rightLine += 1;
      return line;
    }
    if (operation.type === 'remove') {
      const line: DiffLine = { type: 'remove', left: leftLine, text: operation.text };
      leftLine += 1;
      return line;
    }
    const line: DiffLine = { type: 'add', right: rightLine, text: operation.text };
    rightLine += 1;
    return line;
  });
}

function buildHunks(lines: readonly DiffLine[], contextLines: number): DiffHunk[] {
  const changed = lines.flatMap((line, index) => line.type === 'context' ? [] : [index]);
  if (changed.length === 0) return [];

  const context = Math.max(0, Math.trunc(Number.isFinite(contextLines) ? contextLines : 3));
  const groups: Array<{ first: number; last: number }> = [];
  for (const index of changed) {
    const previous = groups.at(-1);
    if (!previous || index - previous.last - 1 > context * 2) groups.push({ first: index, last: index });
    else previous.last = index;
  }

  return groups.map(({ first, last }) => {
    const start = Math.max(0, first - context);
    const end = Math.min(lines.length, last + context + 1);
    const slice = lines.slice(start, end);
    const before = lines.slice(0, start);
    return {
      oldStart: 1 + before.filter((line) => line.type !== 'add').length,
      oldLines: slice.filter((line) => line.type !== 'add').length,
      newStart: 1 + before.filter((line) => line.type !== 'remove').length,
      newLines: slice.filter((line) => line.type !== 'remove').length,
      lines: slice,
    };
  });
}

export function diffLines(leftSource: string, rightSource: string, contextLines = 3): DiffHunk[] {
  const left = splitLines(leftSource);
  const right = splitLines(rightSource);
  return buildHunks(numberLines(normalizeChangeOrder(shortestEditScript(left, right))), contextLines);
}
