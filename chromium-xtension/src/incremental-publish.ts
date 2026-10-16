import type { FolderNode } from '../../ui/src/types';

export function nextIncrementalPublishCount(
  lastPublishedCount: number,
  baseBatchSize = 32,
  maxBatchSize = 1024,
): number {
  const last = Math.max(0, Number(lastPublishedCount) || 0);
  const base = Math.max(1, Number(baseBatchSize) || 1);
  const max = Math.max(base, Number(maxBatchSize) || base);

  if (last < base) return base;

  const growthSteps = Math.max(0, Math.floor(Math.log2(last / base)));
  const batchSize = Math.min(max, base * (2 ** growthSteps));
  return last + batchSize;
}

/** True when any descendant folder has no files and no subfolders. */
export function treeHasEmptyFolder(node: FolderNode | null | undefined): boolean {
  return node?.children?.some((child) => (child.children.length === 0 && child.files.length === 0)
    || treeHasEmptyFolder(child)) ?? false;
}
