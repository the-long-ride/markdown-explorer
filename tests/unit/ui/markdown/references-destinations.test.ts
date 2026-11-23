import { describe, expect, it } from 'vitest';
import { extractDocumentReferences } from '../../../../ui/src/markdown/references';

describe('extractDocumentReferences destinations and tags', () => {
  it('normalizes angle destinations, fragments and html attributes', () => {
    const source = [
      '[Spaced](<docs/my file.md#Intro%20Part>) ![img](<a.png> "t")',
      '[bad](x.md#%E0%A4%A) `[code](skip.md)`',
      "<a href='single.md'>s</a> <img src=\"pic.png\"> <a href=\"\">e</a>",
      '[[Wiki#Head|Alias]] ![[embed.png]] [[]]',
      '#tag #tag \\#escaped (#nested/child) `#code`',
      '```\n[fenced](no.md) #fencetag\n```',
    ].join('\n');
    const result = extractDocumentReferences(source);
    const targets = result.references.map((r) => r.target);
    expect(targets).toContain('docs/my file.md');
    expect(result.references.find((r) => r.target === 'docs/my file.md')?.fragment).toBe('Intro Part');
    expect(result.references.find((r) => r.target === 'x.md')?.fragment).toBe('%E0%A4%A');
    expect(targets).toContain('single.md');
    expect(targets).toContain('pic.png');
    expect(targets).not.toContain('skip.md');
    expect(targets).not.toContain('no.md');
    expect(result.tags).toEqual(['tag', 'nested/child']);
    const starts = result.references.map((r) => r.sourceStart);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});
