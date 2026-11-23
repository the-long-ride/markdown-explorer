import { describe, expect, it, vi } from 'vitest';
import {
  captureBookmarkSelection,
  createObjectBookmarkRecord,
  createTextBookmarkRecord,
  filterAndSortBookmarks,
  normalizeBookmarkDocument,
  normalizeBookmarkRecord,
  resolveBookmarkTarget,
} from '../../../../ui/src/bookmarks/bookmarkModel';

const base = { id: 'b1', name: 'Mark', workspaceKey: '/w', workspaceName: 'W', filePath: 'a.md', createdAt: 1, updatedAt: 2 };

describe('bookmark normalization', () => {
  it('normalizes legacy records without anchors and rejects incomplete ones', () => {
    const legacy = normalizeBookmarkRecord({ ...base, selectedText: 'hello', matchIndex: 4.7, matchOrdinal: 'x', targetKind: 'bogus', workspacePath: '  ' });
    expect(legacy).toMatchObject({ targetKind: 'text', workspacePath: undefined, matchIndex: 4, matchOrdinal: 0, sourceAnchor: { fragment: 'hello', start: 4, end: 9 } });
    expect(normalizeBookmarkRecord(null)).toBeNull();
    expect(normalizeBookmarkRecord('x')).toBeNull();
    expect(normalizeBookmarkRecord({ ...base, renderedText: 'x', sourceAnchor: { fragment: '' } })).toBeNull();
    expect(normalizeBookmarkRecord({ ...base, renderedText: 'x', sourceAnchor: { fragment: 'ab', start: 5, end: 5 } })).toBeNull();
    expect(normalizeBookmarkRecord({ ...base, createdAt: -1, renderedText: 'x' })).toBeNull();
    expect(normalizeBookmarkRecord({ ...base, renderedText: '' })).toBeNull();
  });

  it('keeps explicit anchors and object identities', () => {
    const record = normalizeBookmarkRecord({
      ...base,
      renderedText: 'E = mc^2',
      targetKind: 'math',
      sourceAnchor: { fragment: '$E=mc^2$', start: 3, occurrence: 2, fingerprint: ' ', prefix: 'p', suffix: 's' },
      objectIdentity: { mathSource: ' E=mc^2 ', url: '', label: null },
    });
    expect(record?.sourceAnchor).toMatchObject({ start: 3, end: 11, occurrence: 2, prefix: 'p', suffix: 's' });
    expect(record?.sourceAnchor.fingerprint).toMatch(/^fnv1a-/);
    expect(record?.objectIdentity).toEqual({ mathSource: 'E=mc^2', mermaidSource: undefined, url: undefined, label: undefined, alt: undefined });
    expect(normalizeBookmarkRecord({ ...base, renderedText: 'x', selectedText: 'x', objectIdentity: { url: ' ' } })?.objectIdentity).toBeUndefined();
    expect(normalizeBookmarkRecord({ ...base, renderedText: 'x', selectedText: 'x', objectIdentity: 'nope' })?.objectIdentity).toBeUndefined();
  });

  it('normalizes documents, dropping bad versions, invalid and duplicate items', () => {
    expect(normalizeBookmarkDocument(null).items).toEqual([]);
    expect(normalizeBookmarkDocument({ version: 99, items: [] }).items).toEqual([]);
    expect(normalizeBookmarkDocument({ version: 1, items: 'x' }).items).toEqual([]);
    const doc = normalizeBookmarkDocument({ version: 1, items: [{ ...base, selectedText: 'a' }, { ...base, selectedText: 'b' }, {}] });
    expect(doc.items).toHaveLength(1);
  });
});

describe('bookmark capture and resolution', () => {
  const source = 'alpha beta gamma beta delta';

  it('captures selections with invalid offsets as null', () => {
    expect(captureBookmarkSelection(source, '  ', 0)).toBeNull();
    expect(createTextBookmarkRecord({ name: 'n', workspaceName: 'W', filePath: 'a.md', source, sourceStart: Number.NaN, sourceEnd: 3, renderedText: 'x' })).toBeNull();
    expect(createTextBookmarkRecord({ name: 'n', workspaceName: 'W', filePath: 'a.md', source: 'a   b', sourceStart: 1, sourceEnd: 4, renderedText: 'x' })).toBeNull();
  });

  it('falls back to a timestamp id without crypto.randomUUID', () => {
    const randomUUID = globalThis.crypto.randomUUID;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(undefined as any);
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined });
    try {
      const record = createTextBookmarkRecord({ name: 'n', workspaceName: 'W', filePath: 'a.md', source, sourceStart: 6, sourceEnd: 10, renderedText: 'beta', now: 5 });
      expect(record?.id).toMatch(/^bookmark-/);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: randomUUID });
    }
  });

  it('resolves moved, ambiguous and changed targets', () => {
    const record = createTextBookmarkRecord({ name: 'n', workspaceName: 'W', filePath: 'a.md', source, sourceStart: 17, sourceEnd: 21, renderedText: 'beta' })!;
    expect(resolveBookmarkTarget(record, source).status).toBe('resolved');
    expect(resolveBookmarkTarget(record, `prefix ${source}`).status).toBe('resolved');
    expect(resolveBookmarkTarget(record, 'beta beta beta').status).toBeTruthy();
    expect(resolveBookmarkTarget(record, 'nothing here').status).toBe('targetChanged');
    expect(resolveBookmarkTarget(record, 'other beta words').status).toBeTruthy();
    expect(resolveBookmarkTarget({ ...record, sourceAnchor: undefined, renderedText: '' } as any, source).status).toBeTruthy();
    expect(resolveBookmarkTarget({ ...record, sourceAnchor: { ...record.sourceAnchor, fragment: '' } } as any, source).status).toBe('targetChanged');

    const code = createObjectBookmarkRecord({ name: 'c', workspaceName: 'W', filePath: 'a.md', source: 'x `a` y `a`', sourceStart: 8, sourceEnd: 11, renderedText: 'a', targetKind: 'code' } as any)!;
    expect(resolveBookmarkTarget(code, 'z `a` q `a`').status).toBeTruthy();
    expect(resolveBookmarkTarget({ ...code, sourceAnchor: { ...code.sourceAnchor, prefix: '', suffix: '' } }, 'z `a` q `a` `a`').status).toBe('resolved');

    const legacy = { ...record, renderedText: 'gamma', selectedText: 'gamma', matchOrdinal: 0, sourceAnchor: { ...record.sourceAnchor, fragment: 'missing' } };
    expect(resolveBookmarkTarget(legacy as any, source).status).toBe('resolved');
  });

  it('filters by rendered text and sorts', () => {
    const items = [
      { ...base, id: '1', name: 'B', renderedText: 'zeta', selectedText: 'zeta', updatedAt: 1 },
      { ...base, id: '2', name: 'A', renderedText: '', selectedText: 'alpha', updatedAt: 3 },
    ] as any;
    expect(filterAndSortBookmarks(items, 'ALPHA', 'name-asc').map((i: any) => i.id)).toEqual(['2']);
    expect(filterAndSortBookmarks(items, '', 'created-desc')).toHaveLength(2);
  });
});
