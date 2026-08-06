export interface BodySourceSegment {
  readonly bodyStart: number;
  readonly sourceStart: number;
  readonly length: number;
}

function fullSourceSegment(text: string): BodySourceSegment[] {
  return [{ bodyStart: 0, sourceStart: 0, length: text.length }];
}

export function scanFrontmatterPreamble(text: string): number {
  let index = 0;
  const skipBlankLines = () => {
    while (index < text.length) {
      const match = /^[ \t]*(?:\n|$)/.exec(text.slice(index));
      if (!match || match[0] === '') break;
      index += match[0].length;
      if (!match[0].endsWith('\n')) break;
    }
  };
  skipBlankLines();
  while (text.startsWith('<!--', index)) {
    const closingIndex = text.indexOf('-->', index + 4);
    if (closingIndex === -1) return -1;
    index = closingIndex + 3;
    if (text[index] === '\r' && text[index + 1] === '\n') index += 2;
    else if (text[index] === '\n' || text[index] === '\r') index += 1;
    skipBlankLines();
  }
  return index;
}

export function mapBodyOffsetToSource(offset: number, segments: readonly BodySourceSegment[]): number {
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const segmentEnd = segment.bodyStart + segment.length;
    if (offset >= segment.bodyStart && (offset < segmentEnd || (index === segments.length - 1 && offset === segmentEnd))) {
      return segment.sourceStart + (offset - segment.bodyStart);
    }
  }
  const last = segments[segments.length - 1];
  return last ? last.sourceStart + last.length : offset;
}

export function extractFrontmatter(text: string): {
  body: string;
  frontmatter: Record<string, string>;
  sourceSegments: BodySourceSegment[];
} {
  const frontmatterStart = scanFrontmatterPreamble(text);
  if (frontmatterStart < 0) return { body: text, frontmatter: {}, sourceSegments: fullSourceSegment(text) };
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text.slice(frontmatterStart));
  if (!match) return { body: text, frontmatter: {}, sourceSegments: fullSourceSegment(text) };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    frontmatter[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  const preservedPreamble = text.slice(0, frontmatterStart);
  const bodyAfterFrontmatter = text.slice(frontmatterStart + match[0].length);
  return {
    body: `${preservedPreamble}${bodyAfterFrontmatter}`,
    frontmatter,
    sourceSegments: [
      { bodyStart: 0, sourceStart: 0, length: preservedPreamble.length },
      { bodyStart: preservedPreamble.length, sourceStart: frontmatterStart + match[0].length, length: bodyAfterFrontmatter.length },
    ].filter((segment) => segment.length > 0),
  };
}
