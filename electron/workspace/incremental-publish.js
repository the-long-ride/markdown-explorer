function nextIncrementalPublishCount(
  lastPublishedCount,
  baseBatchSize = 32,
  maxBatchSize = 1024,
) {
  const last = Math.max(0, Number(lastPublishedCount) || 0);
  const base = Math.max(1, Number(baseBatchSize) || 1);
  const max = Math.max(base, Number(maxBatchSize) || base);

  if (last < base) return base;

  const growthSteps = Math.max(0, Math.floor(Math.log2(last / base)));
  const batchSize = Math.min(max, base * (2 ** growthSteps));
  return last + batchSize;
}

// True when any folder in the tree has no files and no subfolders on disk.
function treeHasEmptyFolder(node) {
  const children = node?.children ?? [];
  return children.some((child) => (child.children.length === 0 && child.files.length === 0)
    || treeHasEmptyFolder(child));
}

module.exports = { nextIncrementalPublishCount, treeHasEmptyFolder };
