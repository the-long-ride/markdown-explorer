import { describe, expect, it, vi } from 'vitest';
import {
  BOOKMARKS_STORAGE_KEY,
  createBookmarkStore,
  type BookmarkStorage,
} from '../../../../ui/src/bookmarks/bookmarkStore';
import type { BookmarkRecord } from '../../../../ui/src/bookmarks/types';

class MockStorage implements BookmarkStorage {
  map = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) return; // does not persist, causing verification check to fail
    this.map.set(key, value);
  }
}

const sampleRecord: BookmarkRecord = {
  id: 'bm-1',
  name: 'First Bookmark',
  workspaceKey: '/w1',
  workspaceName: 'Workspace 1',
  filePath: 'doc.md',
  targetKind: 'text',
  sourceAnchor: {
    start: 0,
    end: 5,
    fragment: 'Hello',
    fingerprint: 'fnv1a-12345678',
    occurrence: 0,
    prefix: '',
    suffix: '',
  },
  renderedText: 'Hello',
  selectedText: 'Hello',
  matchOrdinal: 0,
  matchIndex: 0,
  prefix: '',
  suffix: '',
  createdAt: 100,
  updatedAt: 100,
};

describe('bookmarkStore', () => {
  it('initializes empty when storage is empty', () => {
    const storage = new MockStorage();
    const store = createBookmarkStore(storage);
    expect(store.getSnapshot()).toEqual({ version: 2, items: [] });
  });

  it('handles corrupt JSON in storage gracefully', () => {
    const storage = new MockStorage();
    storage.map.set(BOOKMARKS_STORAGE_KEY, '{invalid json');
    const store = createBookmarkStore(storage);
    expect(store.getSnapshot()).toEqual({ version: 2, items: [] });
  });

  it('adds and subscribes to bookmark mutations', () => {
    const storage = new MockStorage();
    const store = createBookmarkStore(storage);
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    const added = store.add(sampleRecord);
    expect(added.id).toBe('bm-1');
    expect(store.getSnapshot().items).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsub();
    store.add({ ...sampleRecord, id: 'bm-2', name: 'Second' });
    expect(store.getSnapshot().items).toHaveLength(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('throws error when adding invalid bookmark', () => {
    const storage = new MockStorage();
    const store = createBookmarkStore(storage);
    expect(() => store.add({} as any)).toThrow('invalid-bookmark');
  });

  it('renames existing bookmark and updates timestamp', () => {
    const storage = new MockStorage();
    const store = createBookmarkStore(storage);
    store.add(sampleRecord);

    const success = store.rename('bm-1', '  Updated Name  ', 500);
    expect(success).toBe(true);
    const item = store.getSnapshot().items[0];
    expect(item.name).toBe('Updated Name');
    expect(item.updatedAt).toBe(500);

    // Nonexistent ID or whitespace name returns false
    expect(store.rename('missing', 'Valid Name')).toBe(false);
    expect(store.rename('bm-1', '   ')).toBe(false);
  });

  it('removes a single bookmark by id', () => {
    const storage = new MockStorage();
    const store = createBookmarkStore(storage);
    store.add(sampleRecord);
    store.add({ ...sampleRecord, id: 'bm-2', name: 'Two' });

    expect(store.remove('bm-1')).toBe(true);
    expect(store.getSnapshot().items.map(i => i.id)).toEqual(['bm-2']);

    // Removing already removed item returns false
    expect(store.remove('bm-1')).toBe(false);
  });

  it('removes multiple bookmarks with removeMany', () => {
    const storage = new MockStorage();
    const store = createBookmarkStore(storage);
    store.add(sampleRecord);
    store.add({ ...sampleRecord, id: 'bm-2', name: 'Two' });
    store.add({ ...sampleRecord, id: 'bm-3', name: 'Three' });

    expect(store.removeMany(['bm-1', 'bm-2'])).toBe(true);
    expect(store.getSnapshot().items.map(i => i.id)).toEqual(['bm-3']);

    // Empty list or non-matching IDs return false
    expect(store.removeMany([])).toBe(false);
    expect(store.removeMany(['nonexistent'])).toBe(false);
  });

  it('throws error when storage persistence verification fails', () => {
    const storage = new MockStorage();
    storage.failWrites = true;
    const store = createBookmarkStore(storage);
    expect(() => store.add(sampleRecord)).toThrow('bookmark-persist-failed');
  });
});
