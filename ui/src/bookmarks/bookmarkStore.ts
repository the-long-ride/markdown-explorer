import { normalizeBookmarkDocument, normalizeBookmarkRecord } from './bookmarkModel.ts';
import { BOOKMARK_DOCUMENT_VERSION, type BookmarkDocument, type BookmarkRecord } from './types.ts';

export const BOOKMARKS_STORAGE_KEY = 'markdown-explorer-bookmarks-v1';

export interface BookmarkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BookmarkStore {
  getSnapshot(): BookmarkDocument;
  subscribe(listener: () => void): () => void;
  add(record: BookmarkRecord): BookmarkRecord;
  rename(id: string, name: string, updatedAt?: number): boolean;
  remove(id: string): boolean;
  removeMany(ids: readonly string[]): boolean;
}

function readDocument(storage: BookmarkStorage): BookmarkDocument {
  try {
    const raw = storage.getItem(BOOKMARKS_STORAGE_KEY);
    return raw ? normalizeBookmarkDocument(JSON.parse(raw)) : { version: BOOKMARK_DOCUMENT_VERSION, items: [] };
  } catch {
    return { version: BOOKMARK_DOCUMENT_VERSION, items: [] };
  }
}

export function createBookmarkStore(storage: BookmarkStorage): BookmarkStore {
  let snapshot = readDocument(storage);
  const listeners = new Set<() => void>();
  const persist = (items: readonly BookmarkRecord[]) => {
    const nextSnapshot: BookmarkDocument = { version: BOOKMARK_DOCUMENT_VERSION, items: [...items] };
    const serialized = JSON.stringify(nextSnapshot);
    storage.setItem(BOOKMARKS_STORAGE_KEY, serialized);
    if (storage.getItem(BOOKMARKS_STORAGE_KEY) !== serialized) {
      throw new Error('bookmark-persist-failed');
    }
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(record) {
      const normalized = normalizeBookmarkRecord(record);
      if (!normalized) throw new Error('invalid-bookmark');
      persist([normalized, ...snapshot.items.filter((item) => item.id !== normalized.id)]);
      return normalized;
    },
    rename(id, name, updatedAt = Date.now()) {
      const normalizedName = name.trim();
      if (!normalizedName) return false;
      let changed = false;
      const items = snapshot.items.map((item) => {
        if (item.id !== id) return item;
        changed = true;
        return { ...item, name: normalizedName, updatedAt };
      });
      if (changed) persist(items);
      return changed;
    },
    remove(id) {
      const items = snapshot.items.filter((item) => item.id !== id);
      if (items.length === snapshot.items.length) return false;
      persist(items);
      return true;
    },
    removeMany(ids) {
      const selected = new Set(ids);
      if (selected.size === 0) return false;
      const items = snapshot.items.filter((item) => !selected.has(item.id));
      if (items.length === snapshot.items.length) return false;
      persist(items);
      return true;
    },
  };
}

const memoryValues = new Map<string, string>();
const fallbackStorage: BookmarkStorage = {
  getItem: (key) => memoryValues.get(key) ?? null,
  setItem: (key, value) => { memoryValues.set(key, value); },
};

function resolveDefaultStorage(): BookmarkStorage {
  try {
    if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage;
  } catch {}
  return fallbackStorage;
}

export const bookmarkStore = createBookmarkStore(resolveDefaultStorage());
