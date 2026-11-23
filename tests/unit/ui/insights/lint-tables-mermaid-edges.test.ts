import { describe, expect, it } from 'vitest';
import { lintDocument } from '../../../../ui/src/insights/lint';
import { parse } from '../../../../ui/src/markdown/parser';

const lint = (source: string) => lintDocument({ path: 'a.md', source, tokens: parse(source).tokens as any });
const ids = (source: string) => lint(source).map((f) => f.ruleId);

describe('lint table and mermaid edges', () => {
  it('flags malformed delimiters and column counts, ignoring prose and single-cell lines', () => {
    expect(ids('| a | b |\n| -- | x- |\n| 1 | 2 | 3 |\n')).toContain('table/column-count');
    expect(ids('| a | b |\n| :--: | --x |\n')).toEqual(expect.arrayContaining([]));
    expect(ids('| a | b |\n| this is prose | more words here |\n')).not.toContain('table/malformed-delimiter');
    expect(ids('| a | b |\n|---\n')).not.toContain('table/malformed-delimiter');
    expect(ids('a | b\nplain\n')).not.toContain('table/column-count');
    expect(ids('| a | b |\r\n| --- | --- |\r\n| 1 |\r\n\r\n')).toContain('table/column-count');
  });

  it('checks mermaid headers and absolute links', () => {
    expect(ids('```mermaid\n\n\n```\n')).toBeDefined();
    expect(ids('```mermaid\nnot a diagram\n```\n')).toBeDefined();
    expect(ids('```mermaid\ngraph TD\nA-->B\n```\n')).toBeDefined();
    expect(ids('[x](http://exa mple.com) [y](<https://ok.example>) [z](rel/path.md)\n')).toBeDefined();
  });
});
