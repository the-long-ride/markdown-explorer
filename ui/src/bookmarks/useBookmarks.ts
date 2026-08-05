import { useSyncExternalStore } from 'react';
import { bookmarkStore } from './bookmarkStore.ts';

export function useBookmarks() {
  return useSyncExternalStore(
    bookmarkStore.subscribe,
    bookmarkStore.getSnapshot,
    bookmarkStore.getSnapshot,
  );
}
