import { expect, test, vi } from 'vitest';
import { WORKSPACE_SCAN_BATCH_SIZE, WORKSPACE_SCAN_REVEAL_DELAY_MS } from '../../../vscode/src/constants/workspace';
import { nextIncrementalPublishCount } from '../../../vscode/src/core/incrementalPublish';
import { scanWorkspaceIncrementally } from '../../../vscode/src/core/incrementalScan';
import { WorkspaceScanner } from '../../../vscode/src/core/scanner';
import type { MdFile, ScanResult } from '../../../vscode/src/types';

function startScan() {
  vi.useFakeTimers();
  const pending = Promise.withResolvers<ScanResult>();
  let progress: (count: number) => void;
  let reportFile: (file: MdFile, count: number) => void;
  vi.spyOn(WorkspaceScanner, 'scan').mockImplementation((_convert, onProgress, onFile) => {
    progress = onProgress!;
    reportFile = onFile!;
    return pending.promise;
  });
  const onProgress = vi.fn();
  const onReveal = vi.fn();
  const onChanged = vi.fn();
  const isCurrent = vi.fn(() => true);
  const result = scanWorkspaceIncrementally({ documentConversionEnabled: true, isCurrent, onProgress, onReveal, onChanged });
  const flat: MdFile[] = [];
  return {
    result, onProgress, onReveal, onChanged, isCurrent,
    discover(path: string) {
      const file = WorkspaceScanner.buildFileEntry(`/ws/${path}`, '/ws');
      flat.push(file);
      progress(flat.length);
      reportFile(file, flat.length);
    },
    finish() {
      const snapshot = { flat, tree: WorkspaceScanner.buildTree(flat) };
      pending.resolve(snapshot);
      return snapshot;
    },
  };
}

test('publishes the first late file, a sorted batch, then the final remainder', async () => {
  const scan = startScan();
  await vi.advanceTimersByTimeAsync(WORKSPACE_SCAN_REVEAL_DELAY_MS);
  expect(scan.onReveal).not.toHaveBeenCalled();

  scan.discover('z.md');
  expect(scan.onReveal).toHaveBeenCalledWith(expect.objectContaining({
    fileList: [expect.objectContaining({ relativePath: 'z.md' })],
  }));
  for (let index = 1; index < WORKSPACE_SCAN_BATCH_SIZE; index++) scan.discover(`${index}.md`);
  expect(scan.onProgress).toHaveBeenLastCalledWith(WORKSPACE_SCAN_BATCH_SIZE);
  expect(scan.onChanged).toHaveBeenCalledTimes(1);
  expect(scan.onChanged.mock.lastCall?.[0].fileList).toHaveLength(WORKSPACE_SCAN_BATCH_SIZE);
  expect(scan.onChanged.mock.lastCall?.[0].fileList[0].relativePath).toBe('1.md');

  scan.discover('last.md');
  const final = scan.finish();
  await expect(scan.result).resolves.toBe(final);
  expect(scan.onChanged).toHaveBeenCalledTimes(2);
  expect(scan.onChanged).toHaveBeenLastCalledWith({ fileList: final.flat, tree: final.tree });
});

test('returns a fast scan before the reveal timer and suppresses all callbacks for a superseded scan', async () => {
  const fast = startScan();
  fast.discover('fast.md');
  const final = fast.finish();
  await expect(fast.result).resolves.toBe(final);
  expect(fast.onReveal).toHaveBeenCalledWith({ fileList: final.flat, tree: final.tree });
  expect(vi.getTimerCount()).toBe(0);

  const stale = startScan();
  stale.isCurrent.mockReturnValue(false);
  stale.discover('stale.md');
  await vi.advanceTimersByTimeAsync(WORKSPACE_SCAN_REVEAL_DELAY_MS);
  stale.finish();
  await expect(stale.result).resolves.toBeNull();
  expect(stale.onProgress).not.toHaveBeenCalled();
  expect(stale.onReveal).not.toHaveBeenCalled();
  expect(stale.onChanged).not.toHaveBeenCalled();
});

test('grows the publishing interval geometrically up to the supplied maximum', () => {
  expect(nextIncrementalPublishCount(-1)).toBe(32);
  expect(nextIncrementalPublishCount(32)).toBe(64);
  expect(nextIncrementalPublishCount(64)).toBe(128);
  expect(nextIncrementalPublishCount(2048)).toBe(3072);
  expect(nextIncrementalPublishCount(32, 16, 8)).toBe(48);
  expect(nextIncrementalPublishCount(NaN, NaN, NaN)).toBe(1);
});
