import { afterEach, describe, expect, it, vi } from 'vitest';

const scan = vi.fn();
const buildTree = vi.fn((files: any[]) => ({ name: 'root', path: '', children: [], files }));

vi.mock('../../../chromium-xtension/src/scanner', () => ({
  BrowserScanner: { scan, buildTree },
}));

const {
  scanWorkspaceIncrementally,
  WORKSPACE_SCAN_BATCH_SIZE,
  WORKSPACE_SCAN_REVEAL_DELAY_MS,
} = await import('../../../chromium-xtension/src/incremental-workspace-scan');

function makeFile(index: number) {
  return {
    fsPath: `f${index}.md`, relativePath: `f${index}.md`, parts: [`f${index}.md`],
    fileName: `f${index}.md`, title: `File ${index}`, extension: '.md', documentKind: 'markdown',
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('scanWorkspaceIncrementally', () => {
  it('waits for real files, reveals the first partial set, then refreshes at 32', async () => {
    vi.useFakeTimers();
    let resolveScan!: (result: any) => void;
    let callbacks!: { onFile(file: any, count: number): void; onProgress(count: number): void };
    scan.mockImplementationOnce((_handle: any, options: typeof callbacks) => {
      callbacks = options;
      return new Promise(resolve => { resolveScan = resolve; });
    });
    const reveals: any[] = [];
    const changes: any[] = [];

    const pending = scanWorkspaceIncrementally({
      handle: {} as FileSystemDirectoryHandle,
      isCurrent: () => true,
      onProgress: vi.fn(),
      onReveal: snapshot => { reveals.push(snapshot); },
      onChanged: snapshot => { changes.push(snapshot); },
    });
    await vi.advanceTimersByTimeAsync(WORKSPACE_SCAN_REVEAL_DELAY_MS);
    expect(reveals).toHaveLength(0);

    const files = Array.from({ length: WORKSPACE_SCAN_BATCH_SIZE }, (_, index) => makeFile(index));
    callbacks.onFile(files[0], 1);
    await Promise.resolve();
    expect(reveals[0].fileList).toHaveLength(1);

    for (let index = 1; index < files.length; index += 1) callbacks.onFile(files[index], index + 1);
    expect(changes.at(-1).fileList).toHaveLength(WORKSPACE_SCAN_BATCH_SIZE);

    resolveScan({ tree: buildTree(files), flat: files });
    await pending;
  });

  it('publishes a completed empty scan without revealing an early empty shell', async () => {
    vi.useFakeTimers();
    scan.mockResolvedValueOnce({ tree: buildTree([]), flat: [] });
    const reveals: any[] = [];

    await scanWorkspaceIncrementally({
      handle: {} as FileSystemDirectoryHandle,
      isCurrent: () => true,
      onProgress: vi.fn(),
      onReveal: snapshot => { reveals.push(snapshot); },
      onChanged: vi.fn(),
    });

    expect(reveals).toHaveLength(1);
    expect(reveals[0].fileList).toEqual([]);
  });
});
