import { describe, expect, it } from 'vitest';
import { renameBookmarkWithVerification, saveBookmarkCapture } from '../../../../ui/src/bookmarks/bookmarkCommands';

function fakeStore(mode: 'ok' | 'drop' | 'throw' = 'ok') {
  let items: any[] = [];
  return {
    add: (r: any) => { if (mode === 'throw') throw new Error('x'); if (mode === 'ok') items.push(r); return r; },
    rename: (id: string, name: string) => {
      if (mode === 'throw') throw new Error('x');
      const item = items.find((i) => i.id === id);
      if (!item) return false;
      if (mode === 'ok') items = items.map((i) => (i.id === id ? { ...i, name } : i));
      return true;
    },
    getSnapshot: () => ({ items }),
    seed: (r: any) => items.push(r),
  } as any;
}

const source = '# Title\n\nSome text here and ![alt](a.png)\n';
const base = { name: 'B', workspaceName: 'W', filePath: '/w/a.md', documentText: source };

describe('bookmark commands', () => {
  it('saves text and object bookmarks and reports storage failures', () => {
    const store = fakeStore();
    const start = source.indexOf('Some');
    const text = saveBookmarkCapture({ ...base, targetKind: 'text', sourceStart: start, sourceEnd: start + 9, renderedText: 'Some text' }, store);
    expect(text.ok).toBe(true);
    const imgStart = source.indexOf('![');
    const obj = saveBookmarkCapture({ ...base, targetKind: 'image', sourceStart: imgStart, sourceEnd: imgStart + 12, renderedText: 'alt', objectIdentity: { alt: 'alt', url: 'a.png' } }, store);
    expect(obj).toBeDefined();
    expect(saveBookmarkCapture({ ...base, targetKind: 'text', sourceStart: start, sourceEnd: start + 9, renderedText: 'Some text' }, fakeStore('drop'))).toEqual({ ok: false, reason: 'storage-unavailable' });
    expect(saveBookmarkCapture({ ...base, targetKind: 'text', sourceStart: start, sourceEnd: start + 9, renderedText: 'Some text' }, fakeStore('throw'))).toEqual({ ok: false, reason: 'storage-unavailable' });
    expect(saveBookmarkCapture({ ...base, targetKind: 'text', sourceStart: 5, sourceEnd: 2, renderedText: '' }, store)).toEqual({ ok: false, reason: 'target-unavailable' });
  });

  it('verifies renames', () => {
    const store = fakeStore();
    store.seed({ id: '1', name: 'old' });
    expect(renameBookmarkWithVerification('1', '  ', store)).toEqual({ ok: false, reason: 'target-unavailable' });
    expect(renameBookmarkWithVerification('1', ' new ', store)).toEqual({ ok: true });
    expect(renameBookmarkWithVerification('missing', 'n', store).ok).toBe(false);
    const drop = fakeStore('drop'); drop.seed({ id: '1', name: 'old' });
    expect(renameBookmarkWithVerification('1', 'n', drop).ok).toBe(false);
    expect(renameBookmarkWithVerification('1', 'n', fakeStore('throw'))).toEqual({ ok: false, reason: 'storage-unavailable' });
  });
});
