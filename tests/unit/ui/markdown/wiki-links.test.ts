import { describe, expect, it } from 'vitest';
import {
  parseWikiLink,
  resolveWikiLink,
  type WikiResolverContext,
} from '../../../../ui/src/markdown/wikiLinks';

const context = (overrides: Partial<WikiResolverContext> = {}): WikiResolverContext => ({
  sourceDocumentPath: 'docs/Start.md',
  documents: [
    { path: 'docs/Start.md', title: 'Start', aliases: ['Home'], anchors: ['start', 'overview'] },
    { path: 'docs/Guide.md', title: 'Guide Title', aliases: ['Install Guide'], anchors: ['install', 'advanced'] },
    { path: 'Reference.md', title: 'Reference', aliases: [] },
    { path: 'handbook/README.md', title: 'Handbook', aliases: [] },
  ],
  ...overrides,
});

describe('parseWikiLink', () => {
  it('parses target, heading fragment, and label', () => {
    expect(parseWikiLink('[[Guide#Install|Setup]]')).toMatchObject({
      kind: 'link',
      raw: '[[Guide#Install|Setup]]',
      target: 'Guide',
      fragment: 'Install',
      label: 'Setup',
      sourceStart: 0,
      sourceEnd: '[[Guide#Install|Setup]]'.length,
    });
  });

  it('honors escaped separators and embed backslashes', () => {
    expect(parseWikiLink('[[a\\#b\\|c]]')).toMatchObject({ target: 'a#b|c' });
    expect(parseWikiLink('![[../media\\image.png]]')).toMatchObject({
      kind: 'embed',
      target: '../media/image.png',
    });
  });

  it('supports current-document heading links and source offsets', () => {
    expect(parseWikiLink('[[#Overview]]', 14)).toMatchObject({
      target: '',
      fragment: 'Overview',
      sourceStart: 14,
      sourceEnd: 14 + '[[#Overview]]'.length,
    });
  });

  it('rejects malformed or empty wiki syntax', () => {
    expect(parseWikiLink('[[Guide')).toMatchObject({ ok: false });
    expect(parseWikiLink('[[]]')).toMatchObject({ ok: false });
    expect(parseWikiLink('![[ ]]')).toMatchObject({ ok: false });
  });
});

describe('resolveWikiLink', () => {
  it('prefers an explicit source-relative path and validates the anchor', () => {
    expect(resolveWikiLink(parseWikiLink('[[./Guide.md#Install]]'), context())).toEqual({
      status: 'resolved',
      documentPath: 'docs/Guide.md',
      canonicalPath: 'docs/Guide.md',
      fragment: 'install',
      caseMismatch: false,
    });
  });

  it('resolves filename stems, titles, and aliases in precedence order', () => {
    expect(resolveWikiLink(parseWikiLink('[[Guide]]'), context())).toMatchObject({
      status: 'resolved', documentPath: 'docs/Guide.md',
    });
    expect(resolveWikiLink(parseWikiLink('[[Guide Title]]'), context())).toMatchObject({
      status: 'resolved', documentPath: 'docs/Guide.md',
    });
    expect(resolveWikiLink(parseWikiLink('[[Install Guide]]'), context())).toMatchObject({
      status: 'resolved', documentPath: 'docs/Guide.md',
    });
  });

  it('keeps .md/.mdx stem collisions explicitly ambiguous', () => {
    const result = resolveWikiLink(parseWikiLink('[[Guide]]'), context({
      documents: [
        { path: 'docs/Guide.md', aliases: [] },
        { path: 'notes/Guide.mdx', aliases: [] },
      ],
    }));
    expect(result).toEqual({
      status: 'ambiguous',
      candidates: ['docs/Guide.md', 'notes/Guide.mdx'],
    });
  });

  it('resolves a directory target only through a unique README/index document', () => {
    expect(resolveWikiLink(parseWikiLink('[[handbook]]'), context())).toMatchObject({
      status: 'resolved', documentPath: 'handbook/README.md',
    });
    expect(resolveWikiLink(parseWikiLink('[[handbook]]'), context({
      documents: [
        { path: 'handbook/README.md', aliases: [] },
        { path: 'handbook/index.mdx', aliases: [] },
      ],
    }))).toEqual({
      status: 'ambiguous',
      candidates: ['handbook/README.md', 'handbook/index.mdx'],
    });
  });

  it('resolves a current-document fragment and reports invalid anchors', () => {
    expect(resolveWikiLink(parseWikiLink('[[#Overview]]'), context())).toEqual({
      status: 'resolved',
      documentPath: 'docs/Start.md',
      canonicalPath: 'docs/Start.md',
      fragment: 'overview',
      caseMismatch: false,
    });
    expect(resolveWikiLink(parseWikiLink('[[Guide#Missing]]'), context())).toEqual({
      status: 'invalid-anchor',
    });
  });

  it('normalizes Unicode/case for matching while reporting case mismatches', () => {
    expect(resolveWikiLink(parseWikiLink('[[guide]]'), context())).toMatchObject({
      status: 'resolved',
      documentPath: 'docs/Guide.md',
      caseMismatch: true,
    });
    const unicode = context({
      documents: [{ path: 'notes/Café.md', title: 'Café', aliases: [] }],
    });
    expect(resolveWikiLink(parseWikiLink('[[Café]]'), unicode)).toMatchObject({
      status: 'resolved', documentPath: 'notes/Café.md',
    });
  });

  it('rejects traversal outside the workspace instead of normalizing it into a match', () => {
    expect(resolveWikiLink(parseWikiLink('[[../../secret.md]]'), context())).toEqual({
      status: 'outside-workspace',
    });
  });
});
