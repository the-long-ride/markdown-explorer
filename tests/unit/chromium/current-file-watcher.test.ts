import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CurrentFileWatcher,
  signaturesDiffer,
  startCurrentFileWatcher,
  stopCurrentFileWatcher,
  CURRENT_FILE_WATCH_INTERVAL_MS,
  type FileSignature,
} from '../../../chromium-xtension/src/current-file-watcher';

function makeSig(lastModified: number, size: number): FileSignature {
  return { lastModified, size };
}

describe('signaturesDiffer', () => {
  it('detects file removal and recreation', () => {
    expect(signaturesDiffer(null, makeSig(1, 1))).toBe(true);
    expect(signaturesDiffer(makeSig(1, 1), null)).toBe(true);
    expect(signaturesDiffer(null, null)).toBe(false);
  });

  it('returns false when both signatures match', () => {
    expect(signaturesDiffer(makeSig(100, 50), makeSig(100, 50))).toBe(false);
  });

  it('returns true when lastModified differs', () => {
    expect(signaturesDiffer(makeSig(100, 50), makeSig(200, 50))).toBe(true);
  });

  it('returns true when size differs', () => {
    expect(signaturesDiffer(makeSig(100, 50), makeSig(100, 60))).toBe(true);
  });
});

describe('CurrentFileWatcher', () => {
  let timerCallback: (() => void) | null;
  let intervalMs: number;
  let clearedTimers: number[];
  const dirHandle = {} as FileSystemDirectoryHandle;

  beforeEach(() => {
    timerCallback = null;
    intervalMs = -1;
    clearedTimers = [];
  });

  function makeWatcher(readFileSignature: (p: string) => Promise<FileSignature | null>) {
    return new CurrentFileWatcher({
      dirHandle,
      intervalMs: 50,
      setInterval: (cb, ms) => {
        timerCallback = cb;
        intervalMs = ms;
        return 7;
      },
      clearInterval: (id) => { clearedTimers.push(id as number); },
      readFileSignature: async (_h, p) => readFileSignature(p),
    });
  }

  it('start records initial signature and polls via setInterval', async () => {
    const sigs = [makeSig(100, 50), makeSig(100, 50)];
    let idx = 0;
    const watcher = makeWatcher(async () => sigs[Math.min(idx++, sigs.length - 1)]);
    const onChanged = vi.fn();
    await watcher.start('note.md', onChanged);
    expect(intervalMs).toBe(50);
    expect(onChanged).not.toHaveBeenCalled();
    timerCallback?.();
    await vi.waitFor(() => expect(onChanged).not.toHaveBeenCalled());
    watcher.stop();
    expect(clearedTimers).toContain(7);
  });

  it('tick emits onChanged when lastModified changes', async () => {
    const sigs = [makeSig(100, 50), makeSig(200, 50)];
    let idx = 0;
    const watcher = makeWatcher(async () => sigs[Math.min(idx++, sigs.length - 1)]);
    const onChanged = vi.fn();
    await watcher.start('note.md', onChanged);
    timerCallback?.();
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledWith('note.md'));
    watcher.stop();
  });

  it('tick emits onChanged when size changes', async () => {
    const sigs = [makeSig(100, 50), makeSig(100, 60)];
    let idx = 0;
    const watcher = makeWatcher(async () => sigs[Math.min(idx++, sigs.length - 1)]);
    const onChanged = vi.fn();
    await watcher.start('note.md', onChanged);
    timerCallback?.();
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledWith('note.md'));
    watcher.stop();
  });

  it('stop clears timer and resets signature', async () => {
    const watcher = makeWatcher(async () => makeSig(100, 50));
    await watcher.start('note.md', vi.fn());
    watcher.stop();
    expect(clearedTimers).toContain(7);
  });

  it('start stops previous watcher before starting new', async () => {
    const watcher = makeWatcher(async () => makeSig(100, 50));
    await watcher.start('a.md', vi.fn());
    const firstTimer = timerCallback;
    await watcher.start('b.md', vi.fn());
    expect(clearedTimers.length).toBeGreaterThanOrEqual(1);
    expect(timerCallback).toBeTruthy();
    expect(timerCallback).not.toBe(firstTimer);
    watcher.stop();
  });

  it('stop during start await prevents timer installation (gen guard)', async () => {
    let resolveSig: (v: FileSignature | null) => void = () => {};
    const pendingSig = new Promise<FileSignature | null>((resolve) => {
      resolveSig = resolve;
    });
    const watcher = makeWatcher(async () => pendingSig);
    const onChanged = vi.fn();
    const startPromise = watcher.start('note.md', onChanged);
    watcher.stop();
    resolveSig(makeSig(100, 50));
    await startPromise;
    expect(timerCallback).toBeNull();
    expect(intervalMs).toBe(-1);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('gen guard: stale start does not overwrite fresh start timer', async () => {
    let resolveFirst: (v: FileSignature | null) => void = () => {};
    const firstSig = new Promise<FileSignature | null>((resolve) => {
      resolveFirst = resolve;
    });
    let readCalls = 0;
    const watcher = new CurrentFileWatcher({
      dirHandle,
      intervalMs: 50,
      setInterval: (cb, ms) => {
        timerCallback = cb;
        intervalMs = ms;
        return readCalls;
      },
      clearInterval: (id) => { clearedTimers.push(id as number); },
      readFileSignature: async (_h, _p) => {
        readCalls++;
        return readCalls === 1 ? firstSig : makeSig(200, 60);
      },
    });
    const staleStart = watcher.start('note.md', vi.fn());
    await watcher.start('note.md', vi.fn());
    const freshTimer = timerCallback;
    resolveFirst(makeSig(100, 50));
    await staleStart;
    expect(timerCallback).toBe(freshTimer);
    watcher.stop();
  });
});

describe('startCurrentFileWatcher / stopCurrentFileWatcher', () => {
  it('no-op when dirHandle or relativePath is null', () => {
    stopCurrentFileWatcher();
    startCurrentFileWatcher(null, 'note.md', vi.fn());
    startCurrentFileWatcher({} as FileSystemDirectoryHandle, null, vi.fn());
    stopCurrentFileWatcher();
  });

  it('uses configured interval constant', () => {
    expect(CURRENT_FILE_WATCH_INTERVAL_MS).toBe(3000);
  });

  it('stopCurrentFileWatcher is idempotent', () => {
    expect(() => stopCurrentFileWatcher()).not.toThrow();
  });
});
