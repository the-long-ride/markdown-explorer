import type { FolderNode, MdFile } from '../../ui/src/types';
import { BrowserScanner } from './scanner';
import { nextIncrementalPublishCount } from './incremental-publish';

export const WORKSPACE_SCAN_REVEAL_DELAY_MS = 3000;
export const WORKSPACE_SCAN_BATCH_SIZE = 32;

interface Snapshot {
  fileList: MdFile[];
  tree: FolderNode;
}

interface IncrementalScanOptions {
  handle: FileSystemDirectoryHandle;
  isCurrent: () => boolean;
  onProgress: (count: number) => void;
  onReveal: (snapshot: Snapshot) => void | Promise<void>;
  onChanged: (snapshot: Snapshot) => void;
}

export async function scanWorkspaceIncrementally({
  handle,
  isCurrent,
  onProgress,
  onReveal,
  onChanged,
}: IncrementalScanOptions): Promise<{ tree: FolderNode; flat: MdFile[] } | null> {
  const discovered: MdFile[] = [];
  let thresholdElapsed = false;
  let revealStarted = false;
  let revealed = false;
  let lastPublishedCount = 0;
  let revealPromise: Promise<void> | null = null;

  const snapshot = (): Snapshot => {
    const fileList = [...discovered].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return { fileList, tree: BrowserScanner.buildTree(fileList) };
  };
  const publishChanged = () => {
    if (!isCurrent()) return;
    const next = snapshot();
    if (next.fileList.length <= lastPublishedCount) return;
    lastPublishedCount = next.fileList.length;
    onChanged(next);
  };
  const startReveal = () => {
    if (!isCurrent() || revealStarted || discovered.length === 0) return;
    revealStarted = true;
    const initial = snapshot();
    revealPromise = Promise.resolve(onReveal(initial)).then(() => {
      if (!isCurrent()) return;
      revealed = true;
      lastPublishedCount = initial.fileList.length;
      if (discovered.length > lastPublishedCount) publishChanged();
    });
  };

  const scanPromise = BrowserScanner.scan(handle, {
    isCurrent,
    onProgress(count) {
      if (isCurrent()) onProgress(count);
    },
    onFile(file, count) {
      if (!isCurrent()) return;
      discovered.push(file);
      if (thresholdElapsed && !revealStarted) startReveal();
      else if (revealed && count >= nextIncrementalPublishCount(lastPublishedCount, WORKSPACE_SCAN_BATCH_SIZE)) publishChanged();
    },
  });
  const revealTimer = globalThis.setTimeout(() => {
    if (!isCurrent()) return;
    thresholdElapsed = true;
    startReveal();
  }, WORKSPACE_SCAN_REVEAL_DELAY_MS);

  const result = await scanPromise;
  globalThis.clearTimeout(revealTimer);
  if (revealPromise) await revealPromise;
  if (!isCurrent()) return null;
  if (revealed) {
    if (lastPublishedCount !== result.flat.length) onChanged({ fileList: result.flat, tree: result.tree });
  } else {
    await onReveal({ fileList: result.flat, tree: result.tree });
  }
  return result;
}
