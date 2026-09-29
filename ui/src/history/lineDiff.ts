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

export interface DetailedLineDiff {
  readonly hunks: DiffHunk[];
  /** The sources differ too much to diff line by line; `hunks` is a whole-block replacement. */
  readonly tooDifferent: boolean;
}

type PrimitiveDiff =
  | { type: 'context'; text: string }
  | { type: 'remove'; text: string }
  | { type: 'add'; text: string };

/** Edit distance above which the sources are reported as too different to diff line by line. */
const MAX_EDIT_DISTANCE = 5_000;
/** Upper bound on diagonal steps across the whole diff, so pathological inputs cannot stall the main thread. */
const MAX_WORK = 30_000_000;

interface MyersContext {
  readonly left: readonly string[];
  readonly right: readonly string[];
  readonly a: Int32Array;
  readonly b: Int32Array;
  readonly out: PrimitiveDiff[];
  work: number;
}

type Bisection = { readonly x: number; readonly y: number } | 'replace' | 'budget';

function splitLines(source: string): string[] {
  if (source === '') return [];
  return source.replace(/\r\n?/g, '\n').split('\n');
}

/** Maps equal lines to equal integers so the Myers loops compare numbers, not strings. */
function internLines(left: readonly string[], right: readonly string[]): { a: Int32Array; b: Int32Array } {
  const ids = new Map<string, number>();
  const intern = (lines: readonly string[]) => {
    const result = new Int32Array(lines.length);
    lines.forEach((line, index) => {
      let id = ids.get(line);
      if (id === undefined) {
        id = ids.size;
        ids.set(line, id);
      }
      result[index] = id;
    });
    return result;
  };
  return { a: intern(left), b: intern(right) };
}

function pushRemoves(context: MyersContext, from: number, to: number) {
  for (let index = from; index < to; index += 1) context.out.push({ type: 'remove', text: context.left[index] });
}

function pushAdds(context: MyersContext, from: number, to: number) {
  for (let index = from; index < to; index += 1) context.out.push({ type: 'add', text: context.right[index] });
}

/**
 * Linear-space Myers: finds the middle snake of `a[aLo, aHi)` versus `b[bLo, bHi)` by running
 * the forward and reverse searches until they overlap. Both ranges are non-empty and their
 * first and last lines differ. Frontiers are compact `Int32Array`s indexed by diagonal.
 */
function bisect(context: MyersContext, aLo: number, aHi: number, bLo: number, bHi: number, maxD: number): Bisection {
  const { a, b } = context;
  const leftLength = aHi - aLo;
  const rightLength = bHi - bLo;
  const maxSteps = Math.ceil((leftLength + rightLength) / 2);
  const offset = maxSteps;
  const size = 2 * maxSteps + 2;
  const forward = new Int32Array(size).fill(-1);
  const reverse = new Int32Array(size).fill(-1);
  forward[offset + 1] = 0;
  reverse[offset + 1] = 0;
  const delta = leftLength - rightLength;
  const checkForward = delta % 2 !== 0;
  let forwardStart = 0;
  let forwardEnd = 0;
  let reverseStart = 0;
  let reverseEnd = 0;

  for (let d = 0; d < maxSteps; d += 1) {
    if (2 * d > maxD) return 'budget';
    for (let k = -d + forwardStart; k <= d - forwardEnd; k += 2) {
      const index = offset + k;
      let x = k === -d || (k !== d && forward[index - 1] < forward[index + 1]) ? forward[index + 1] : forward[index - 1] + 1;
      let y = x - k;
      const snakeStart = x;
      while (x < leftLength && y < rightLength && a[aLo + x] === b[bLo + y]) {
        x += 1;
        y += 1;
      }
      context.work += 1 + x - snakeStart;
      forward[index] = x;
      if (x > leftLength) forwardEnd += 2;
      else if (y > rightLength) forwardStart += 2;
      else if (checkForward) {
        const reverseIndex = offset + delta - k;
        if (reverseIndex >= 0 && reverseIndex < size && reverse[reverseIndex] !== -1 && x >= leftLength - reverse[reverseIndex]) {
          return { x: aLo + x, y: bLo + y };
        }
      }
    }
    for (let k = -d + reverseStart; k <= d - reverseEnd; k += 2) {
      const index = offset + k;
      let x = k === -d || (k !== d && reverse[index - 1] < reverse[index + 1]) ? reverse[index + 1] : reverse[index - 1] + 1;
      let y = x - k;
      const snakeStart = x;
      while (x < leftLength && y < rightLength && a[aHi - x - 1] === b[bHi - y - 1]) {
        x += 1;
        y += 1;
      }
      context.work += 1 + x - snakeStart;
      reverse[index] = x;
      if (x > leftLength) reverseEnd += 2;
      else if (y > rightLength) reverseStart += 2;
      else if (!checkForward) {
        const forwardIndex = offset + delta - k;
        if (forwardIndex >= 0 && forwardIndex < size && forward[forwardIndex] !== -1) {
          const forwardX = forward[forwardIndex];
          if (forwardX >= leftLength - x) return { x: aLo + forwardX, y: bLo + forwardX - (forwardIndex - offset) };
        }
      }
    }
    if (context.work > MAX_WORK) return 'budget';
  }
  // The searches never met: the ranges share no line at all.
  return 'replace';
}

/** Appends the edit script for `a[aLo, aHi)` versus `b[bLo, bHi)`; returns false when a budget is exceeded. */
function diffRange(context: MyersContext, aLo: number, aHi: number, bLo: number, bHi: number, maxD: number): boolean {
  const { a, b, out, left } = context;
  while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) {
    out.push({ type: 'context', text: left[aLo] });
    aLo += 1;
    bLo += 1;
  }
  let suffix = 0;
  while (aLo < aHi - suffix && bLo < bHi - suffix && a[aHi - 1 - suffix] === b[bHi - 1 - suffix]) suffix += 1;
  const aEnd = aHi - suffix;
  const bEnd = bHi - suffix;

  if (aLo === aEnd) pushAdds(context, bLo, bEnd);
  else if (bLo === bEnd) pushRemoves(context, aLo, aEnd);
  else {
    const split = bisect(context, aLo, aEnd, bLo, bEnd, maxD);
    if (split === 'budget') return false;
    const degenerate = split !== 'replace' && ((split.x === aLo && split.y === bLo) || (split.x === aEnd && split.y === bEnd));
    if (split === 'replace' || degenerate) {
      pushRemoves(context, aLo, aEnd);
      pushAdds(context, bLo, bEnd);
    } else if (!diffRange(context, aLo, split.x, bLo, split.y, Number.POSITIVE_INFINITY)
      || !diffRange(context, split.x, aEnd, split.y, bEnd, Number.POSITIVE_INFINITY)) {
      return false;
    }
  }

  for (let index = aEnd; index < aHi; index += 1) out.push({ type: 'context', text: left[index] });
  return true;
}

function shortestEditScript(left: readonly string[], right: readonly string[]): { operations: PrimitiveDiff[]; tooDifferent: boolean } {
  const { a, b } = internLines(left, right);
  const context: MyersContext = { left, right, a, b, out: [], work: 0 };
  if (diffRange(context, 0, left.length, 0, right.length, MAX_EDIT_DISTANCE)) return { operations: context.out, tooDifferent: false };
  const operations: PrimitiveDiff[] = [];
  const fallback: MyersContext = { ...context, out: operations };
  pushRemoves(fallback, 0, left.length);
  pushAdds(fallback, 0, right.length);
  return { operations, tooDifferent: true };
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
    for (const line of changed) if (line.type === 'remove') normalized.push(line);
    for (const line of changed) if (line.type === 'add') normalized.push(line);
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
  const context = Math.max(0, Math.trunc(Number.isFinite(contextLines) ? contextLines : 3));
  const groups: Array<{ first: number; last: number }> = [];
  lines.forEach((line, index) => {
    if (line.type === 'context') return;
    const previous = groups[groups.length - 1];
    if (!previous || index - previous.last - 1 > context * 2) groups.push({ first: index, last: index });
    else previous.last = index;
  });

  // Groups are ordered, so old/new line counts before each hunk are accumulated in one pass.
  let cursor = 0;
  let oldBefore = 0;
  let newBefore = 0;
  return groups.map(({ first, last }) => {
    const start = Math.max(0, first - context);
    const end = Math.min(lines.length, last + context + 1);
    for (; cursor < start; cursor += 1) {
      if (lines[cursor].type !== 'add') oldBefore += 1;
      if (lines[cursor].type !== 'remove') newBefore += 1;
    }
    const slice = lines.slice(start, end);
    let oldLines = 0;
    let newLines = 0;
    for (const line of slice) {
      if (line.type !== 'add') oldLines += 1;
      if (line.type !== 'remove') newLines += 1;
    }
    return { oldStart: 1 + oldBefore, oldLines, newStart: 1 + newBefore, newLines, lines: slice };
  });
}

/** Line diff plus whether it fell back to a whole-block replacement because the sources differ too much. */
export function diffLinesDetailed(leftSource: string, rightSource: string, contextLines = 3): DetailedLineDiff {
  const left = splitLines(leftSource);
  const right = splitLines(rightSource);
  const { operations, tooDifferent } = shortestEditScript(left, right);
  return { hunks: buildHunks(numberLines(normalizeChangeOrder(operations)), contextLines), tooDifferent };
}

export function diffLines(leftSource: string, rightSource: string, contextLines = 3): DiffHunk[] {
  return diffLinesDetailed(leftSource, rightSource, contextLines).hunks;
}
