import { describe, expect, it } from 'vitest';
import { getBookmarkWorkspaceKey, getOccurrenceIndex, resolveBookmarkTarget } from '../../../../ui/src/bookmarks/bookmarkModel';

const legacy = (extra: Record<string, unknown>) => ({ targetKind: 'text', renderedText: 'foo', selectedText: 'foo', matchOrdinal: 0, matchIndex: 0, prefix: '', suffix: '', ...extra }) as any;

describe('resolveBookmarkTarget legacy and occurrence paths', () => {
  it('resolves by occurrence for context-free or object targets', () => {
    const doc = 'foo bar foo baz foo';
    expect(resolveBookmarkTarget(legacy({ matchOrdinal: 1, matchIndex: 999 }), doc).status).not.toBe('targetChanged');
    expect(resolveBookmarkTarget(legacy({ targetKind: 'image', matchOrdinal: 2, matchIndex: 999, prefix: 'zz', suffix: 'qq' }), doc).status).not.toBe('targetChanged');
    expect(resolveBookmarkTarget(legacy({ matchOrdinal: 9, matchIndex: 999, prefix: 'zz', suffix: 'qq' }), doc).status).toBe('targetChanged');
  });

  it('rejects a single occurrence with mismatched context and missing fragments', () => {
    expect(resolveBookmarkTarget(legacy({ matchIndex: 50, prefix: 'completely different prefix ', suffix: ' other suffix' }), 'xx foo yy').status).toBe('targetChanged');
    expect(resolveBookmarkTarget(legacy({ renderedText: '', selectedText: '' }), 'foo').status).toBe('targetChanged');
    expect(resolveBookmarkTarget(legacy({}), 'nothing here').status).toBe('targetChanged');
  });

  it('falls back to the legacy rendered text when the source anchor fragment is gone', () => {
    const anchor = { start: 0, end: 4, fragment: '**x**', fingerprint: 'nope', prefix: '', suffix: '', occurrence: 0 };
    expect(resolveBookmarkTarget(legacy({ sourceAnchor: anchor, renderedText: 'x' }), 'a x b').status).not.toBe('targetChanged');
    expect(resolveBookmarkTarget(legacy({ sourceAnchor: anchor, renderedText: 'x' }), 'x and x').status).toBe('targetChanged');
  });

  it('derives workspace keys and occurrence indexes', () => {
    expect(getBookmarkWorkspaceKey(undefined, '  Name ')).toBe('Name');
    expect(getBookmarkWorkspaceKey(undefined, undefined as any)).toBe('');
    expect(getOccurrenceIndex('a a a', 'a', 1.7)).toBe(2);
    expect(getOccurrenceIndex('a', '', 0)).toBe(-1);
  });
});
