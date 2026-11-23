import { describe, expect, it } from 'vitest';
import { normalizeBookmarkRecord } from '../../../../ui/src/bookmarks/bookmarkModel';

const base = { id: 'b1', name: 'N', workspaceKey: 'w', filePath: 'a.md', createdAt: 1, updatedAt: 2 };

describe('normalizeBookmarkRecord partial records', () => {
  it('fills missing anchor fields and identity values from fallbacks', () => {
    const record = normalizeBookmarkRecord({
      ...base, selectedText: 'hello', targetKind: 'image',
      sourceAnchor: { fragment: 'hello', start: 3 },
      objectIdentity: { url: ' https://x.dev/a.png ' },
    }) as any;
    expect(record.renderedText).toBe('hello');
    expect(record.sourceAnchor).toMatchObject({ start: 3, end: 8, fragment: 'hello', prefix: '', suffix: '' });
    expect(record.sourceAnchor.fingerprint).toBeTruthy();
    expect(record.objectIdentity).toEqual({ url: 'https://x.dev/a.png', mathSource: undefined, mermaidSource: undefined, label: undefined, alt: undefined });
    expect(record.workspaceName).toBe('');
    expect(record.workspacePath).toBeUndefined();
  });

  it('rejects anchors without a fragment and drops empty identities', () => {
    expect(normalizeBookmarkRecord({ ...base, renderedText: 'x', sourceAnchor: { start: 1 } })).toBeNull();
    const record = normalizeBookmarkRecord({ ...base, renderedText: 'x', objectIdentity: {}, targetKind: 'bogus' }) as any;
    expect(record.objectIdentity).toBeUndefined();
    expect(record.targetKind).toBe('text');
    expect(normalizeBookmarkRecord({ ...base, createdAt: -1, renderedText: 'x' })).toBeNull();
  });
});
