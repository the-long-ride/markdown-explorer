import { describe, expect, it } from 'vitest';
import { parse } from '../../../../ui/src/markdown/parser';

describe('markdown source integrity', () => {
  it('keeps MDX source ranges aligned after imports', () => {
    const source = "import Card from './Card'\n\n# Heading\n\nBody";
    const { tokens } = parse(source, true);
    const heading = tokens.find((token) => token.type === 'heading');
    expect(heading?.sourceStart).toBe(source.indexOf('# Heading'));
    expect(source.slice(heading!.sourceStart, heading!.sourceEnd)).toBe('# Heading');
  });

  it('keeps MDX source ranges aligned after exports', () => {
    const source = 'export const value = 1\n\nParagraph';
    const { tokens } = parse(source, true);
    const paragraph = tokens.find((token) => token.type === 'paragraph');
    expect(source.slice(paragraph!.sourceStart, paragraph!.sourceEnd)).toBe('Paragraph');
  });
});
