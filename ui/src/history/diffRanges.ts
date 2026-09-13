import type { DiffHunk } from './lineDiff';

export interface CharacterRange {
  readonly start: number;
  readonly end: number;
}

function lineOffsets(source: string): CharacterRange[] {
  if (source === '') return [];
  const offsets: CharacterRange[] = [];
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character !== '\n' && character !== '\r') continue;
    offsets.push({ start, end: index });
    if (character === '\r' && source[index + 1] === '\n') index += 1;
    start = index + 1;
  }
  offsets.push({ start, end: source.length });
  return offsets;
}

export function changedCharacterRanges(
  source: string,
  hunks: readonly DiffHunk[],
  side: 'left' | 'right',
): readonly CharacterRange[] {
  const changedLines = new Set<number>();
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (side === 'left' && line.type === 'remove') changedLines.add(line.left);
      if (side === 'right' && line.type === 'add') changedLines.add(line.right);
    }
  }
  const sorted = [...changedLines].sort((left, right) => left - right);
  if (sorted.length === 0) return [];

  const offsets = lineOffsets(source);
  const ranges: CharacterRange[] = [];
  let first = sorted[0];
  let last = first;
  const flush = () => {
    const startOffset = offsets[first - 1];
    const endOffset = offsets[last - 1];
    if (startOffset && endOffset) ranges.push({ start: startOffset.start, end: endOffset.end });
  };

  for (const line of sorted.slice(1)) {
    if (line === last + 1) {
      last = line;
      continue;
    }
    flush();
    first = line;
    last = line;
  }
  flush();
  return ranges;
}
