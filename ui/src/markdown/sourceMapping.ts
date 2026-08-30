import {
  parseFrontmatterDocument,
  scanFrontmatterPreamble,
} from './frontmatter.ts';

export interface BodySourceSegment {
  readonly bodyStart: number;
  readonly sourceStart: number;
  readonly length: number;
}

export { scanFrontmatterPreamble };

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
  const parsed = parseFrontmatterDocument(text);
  return {
    body: parsed.body,
    frontmatter: parsed.flatFrontmatter,
    sourceSegments: parsed.sourceSegments,
  };
}
