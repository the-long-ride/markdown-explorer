import { createObjectBookmarkRecord, createTextBookmarkRecord } from './bookmarkModel.ts';
import { bookmarkStore, type BookmarkStore } from './bookmarkStore.ts';
import type { BookmarkObjectIdentity, BookmarkRecord, BookmarkTargetKind } from './types.ts';

export type BookmarkCommandFailureReason = 'target-unavailable' | 'storage-unavailable';

export interface SaveBookmarkCaptureInput {
  readonly name: string;
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly filePath: string;
  readonly documentText: string;
  readonly targetKind: BookmarkTargetKind;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly renderedText: string;
  readonly objectIdentity?: BookmarkObjectIdentity;
}

export type SaveBookmarkCaptureResult =
  | { readonly ok: true; readonly record: BookmarkRecord }
  | { readonly ok: false; readonly reason: BookmarkCommandFailureReason };

export type RenameBookmarkResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: BookmarkCommandFailureReason };

export function saveBookmarkCapture(
  input: SaveBookmarkCaptureInput,
  store: BookmarkStore = bookmarkStore,
): SaveBookmarkCaptureResult {
  const common = {
    name: input.name,
    workspaceName: input.workspaceName,
    workspacePath: input.workspacePath,
    filePath: input.filePath,
    source: input.documentText,
    sourceStart: input.sourceStart,
    sourceEnd: input.sourceEnd,
    renderedText: input.renderedText,
  };
  const record = input.targetKind === 'text'
    ? createTextBookmarkRecord(common)
    : createObjectBookmarkRecord({
      ...common,
      targetKind: input.targetKind,
      objectIdentity: input.objectIdentity,
    });
  if (!record) return { ok: false, reason: 'target-unavailable' };

  try {
    const saved = store.add(record);
    const persisted = store.getSnapshot().items.some((item) => item.id === saved.id);
    return persisted
      ? { ok: true, record: saved }
      : { ok: false, reason: 'storage-unavailable' };
  } catch {
    return { ok: false, reason: 'storage-unavailable' };
  }
}

export function renameBookmarkWithVerification(
  id: string,
  name: string,
  store: BookmarkStore = bookmarkStore,
): RenameBookmarkResult {
  const normalizedName = name.trim();
  if (!normalizedName) return { ok: false, reason: 'target-unavailable' };
  try {
    const renamed = store.rename(id, normalizedName);
    const persisted = store.getSnapshot().items.some(
      (item) => item.id === id && item.name === normalizedName,
    );
    return renamed && persisted
      ? { ok: true }
      : { ok: false, reason: 'storage-unavailable' };
  } catch {
    return { ok: false, reason: 'storage-unavailable' };
  }
}
