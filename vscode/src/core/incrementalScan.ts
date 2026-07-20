import type { FolderNode, MdFile, ScanResult } from '../types';
import { WorkspaceScanner } from './scanner';

export const WORKSPACE_SCAN_REVEAL_DELAY_MS = 3000;
export const WORKSPACE_SCAN_BATCH_SIZE = 32;

interface Snapshot {
  fileList: MdFile[];
  tree: FolderNode;
}

interface IncrementalScanOptions {
  documentConversionEnabled: boolean;
  isCurrent: () => boolean;
  onProgress: (count: number) => void;
  onReveal: (snapshot: Snapshot) => void;
  onChanged: (snapshot: Snapshot) => void;
}

export async function scanWorkspaceIncrementally({
  documentConversionEnabled,
  isCurrent,
  onProgress,
  onReveal,
  onChanged,
}: IncrementalScanOptions): Promise<ScanResult | null> {
  const discovered: MdFile[] = [];
  let thresholdElapsed = false;
  let revealed = false;
  let lastPublishedCount = 0;
  const snapshot = (): Snapshot => {
    const fileList = [...discovered].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return { fileList, tree: WorkspaceScanner.buildTree(fileList) };
  };
  const publishReveal = () => {
    if (!isCurrent() || revealed || discovered.length === 0) return;
    revealed = true;
    const next = snapshot();
    lastPublishedCount = next.fileList.length;
    onReveal(next);
  };
  const publishChanged = () => {
    if (!isCurrent()) return;
    const next = snapshot();
    lastPublishedCount = next.fileList.length;
    onChanged(next);
  };

  const scanPromise = WorkspaceScanner.scan(
    documentConversionEnabled,
    count => { if (isCurrent()) onProgress(count); },
    (file, count) => {
      if (!isCurrent()) return;
      discovered.push(file);
      if (thresholdElapsed && !revealed) publishReveal();
      else if (revealed && count % WORKSPACE_SCAN_BATCH_SIZE === 0) publishChanged();
    },
  );
  const revealTimer = setTimeout(() => {
    if (!isCurrent()) return;
    thresholdElapsed = true;
    publishReveal();
  }, WORKSPACE_SCAN_REVEAL_DELAY_MS);

  const result = await scanPromise;
  clearTimeout(revealTimer);
  if (!isCurrent()) return null;
  if (revealed) {
    if (lastPublishedCount !== result.flat.length) {
      onChanged({ fileList: result.flat, tree: result.tree });
    }
  } else {
    onReveal({ fileList: result.flat, tree: result.tree });
  }
  return result;
}
