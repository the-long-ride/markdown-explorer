import { describe, expect, it } from 'vitest';
import { parseWikiLink, resolveWikiLink } from '../../../../ui/src/markdown/wikiLinks';

const docs = [
  { path: 'notes/Alpha.md', title: 'Alpha Title', aliases: ['First'], anchors: ['intro'] },
  { path: 'guide/readme.mdx', aliases: [] },
  { path: 'guide/index.md', aliases: [] },
  { path: 'other/README.md', aliases: [] },
  { path: 'misc/.hidden', aliases: [] },
  { path: 'data/table.csv', aliases: [] },
];
const ctx = { sourceDocumentPath: 'notes/Alpha.md', documents: docs };
const resolve = (raw: string) => resolveWikiLink(parseWikiLink(raw), ctx);

describe('wiki link resolution', () => {
  it('parses escapes and rejects non-wiki syntax', () => {
    const token = parseWikiLink('[[a\\|b\\#c\\\\d\\x|Label]]') as any;
    expect(token.target).toContain('a|b#c');
    expect((parseWikiLink('[a]') as any).ok).toBe(false);
    expect((parseWikiLink('![[img.png]]') as any).kind).toBe('embed');
  });

  it('resolves by stem, title, alias, directory index and path', () => {
    expect(resolve('[[alpha]]').status).toBe('resolved');
    expect(resolve('[[Alpha Title]]').status).toBe('resolved');
    expect(resolve('[[first]]').status).toBe('resolved');
    expect(resolve('[[guide]]').status).toBeTruthy();
    expect(resolve('[[other]]').status).toBe('resolved');
    expect(resolve('[[../data/table.csv]]').status).toBeTruthy();
    expect(resolve('[[/notes/Alpha]]').status).toBeTruthy();
    expect(resolve('[[./missing/./x]]').status).toBe('missing');
    expect(resolve('[[data/table]]').status).toBeTruthy();
    expect(resolve('[[nothing]]').status).toBe('missing');
    expect(resolve('[[#intro]]').status).toBeTruthy();
    expect(resolveWikiLink(parseWikiLink('[[#x]]'), { sourceDocumentPath: 'none.md', documents: [] }).status).toBeTruthy();
    expect(resolveWikiLink(parseWikiLink('bad'), ctx).status).toBe('missing');
  });
});
