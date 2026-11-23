import { describe, expect, it } from 'vitest';
import { resolveSnapshotDocumentFilePath, resolveSnapshotLinkTarget, stripSnapshotInlineNavHandlers } from '../../../../ui/src/history/snapshotLinkResolution';

const files = [{ path: 'docs/Guide.md' }, { path: 'notes/deep/Topic.mdx' }, { path: 'README.md' }] as any;

describe('snapshot link resolution edge cases', () => {
  it('builds document paths and strips inline nav handlers', () => {
    expect(resolveSnapshotDocumentFilePath(undefined, '/a//b/')).toBe('a/b');
    expect(resolveSnapshotDocumentFilePath('/w/', '')).toBe('/w');
    expect(resolveSnapshotDocumentFilePath('/w', 'a.md')).toBe('/w/a.md');
    expect(stripSnapshotInlineNavHandlers('')).toBe('');
    expect(stripSnapshotInlineNavHandlers('<a href="x" onclick="Nav.go(\'x\');return false;">x</a>')).toBe('<a href="x">x</a>');
  });

  it('classifies fragments, external, dangerous and empty links', () => {
    expect(resolveSnapshotLinkTarget('', 'a.md', files)).toBeNull();
    expect(resolveSnapshotLinkTarget('javascript:alert(1)', 'a.md', files)).toBeNull();
    expect(resolveSnapshotLinkTarget('#%E0%A4%A', 'a.md', files)).toEqual({ kind: 'fragment', fragment: '%E0%A4%A' });
    expect(resolveSnapshotLinkTarget('#  ', 'a.md', files)).toBeNull();
    expect(resolveSnapshotLinkTarget('//cdn/x', 'a.md', files)).toEqual({ kind: 'external', url: '//cdn/x' });
    expect(resolveSnapshotLinkTarget('?q=1#sec', 'a.md', files)).toEqual({ kind: 'fragment', fragment: 'sec' });
    expect(resolveSnapshotLinkTarget('?q=1', 'a.md', files)).toBeNull();
  });

  it('resolves relative, case-insensitive and wiki basename targets', () => {
    expect(resolveSnapshotLinkTarget('../docs/guide.md#Top', 'notes/a.md', files)).toEqual({ kind: 'snapshot-file', path: 'docs/Guide.md', fragment: 'Top' });
    expect(resolveSnapshotLinkTarget('deep/Topic', 'notes/a.md', files)).toMatchObject({ path: 'notes/deep/Topic.mdx' });
    expect(resolveSnapshotLinkTarget('../../../x.md', 'a.md', files)?.kind).toBe('not-found');
    expect(resolveSnapshotLinkTarget('topic', 'docs/a.md', files, { isWikiLink: true })).toMatchObject({ path: 'notes/deep/Topic.mdx' });
    expect(resolveSnapshotLinkTarget('notes/deep/topic', 'docs/a.md', files, { isWikiLink: true })).toMatchObject({ path: 'notes/deep/Topic.mdx' });
    expect(resolveSnapshotLinkTarget('nothing', 'docs/a.md', files, { isWikiLink: true })).toMatchObject({ kind: 'not-found' });
    expect(resolveSnapshotLinkTarget('./', 'a.md', files)?.kind).toBeTruthy();
  });
});
