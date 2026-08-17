import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type CopyImage = typeof import('../../../ui/src/dom/copyImage');

async function importCopyImage(): Promise<CopyImage> {
  vi.resetModules();
  return import('../../../ui/src/dom/copyImage');
}

// Minimal fake PlatformBridge for the Tauri save-chart-png flow: records the
// posted message and lets the test dispatch chartPngSaveResult back through
// the registered onMessage listener.
function installTauriBridge() {
  const listeners = new Set<(msg: any) => void>();
  const posted: any[] = [];
  const bridge = {
    postMessage(msg: any) { posted.push(msg); },
    onMessage(handler: (msg: any) => void) {
      listeners.add(handler);
      return () => { listeners.delete(handler); };
    },
  };
  (window as any).__TAURI__ = { event: {} };
  (window as any).PlatformBridge = bridge;
  const dispatch = (msg: any) => { listeners.forEach((cb) => cb(msg)); };
  return {
    bridge,
    posted,
    dispatch,
    remove() {
      delete (window as any).__TAURI__;
      delete (window as any).PlatformBridge;
    },
  };
}

describe('saveBlobAsFile Tauri result handling', () => {
  let env: ReturnType<typeof installTauriBridge>;

  beforeEach(() => {
    vi.useFakeTimers();
    env = installTauriBridge();
  });
  afterEach(() => {
    vi.useRealTimers();
    env.remove();
  });

  // Settle microtasks (FileReader read + onMessage subscription) without
  // firing the 60s fallback timeout that saveBlobAsFile arms as a safety net.
  const settleMicrotasks = () => vi.advanceTimersByTimeAsync(50);

  test('resolves true only after the host reports a successful write', async () => {
    const { saveBlobAsFile } = await importCopyImage();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

    const pending = saveBlobAsFile(blob, 'diagram.png');
    await settleMicrotasks();

    expect(env.posted).toHaveLength(1);
    expect(env.posted[0].command).toBe('saveChartPng');
    expect(env.posted[0].fileName).toBe('diagram.png');
    expect(typeof env.posted[0].requestId).toBe('string');
    expect(env.posted[0].requestId.length).toBeGreaterThan(0);

    // Before the host outcome arrives, the function must still be pending —
    // the old (buggy) code resolved true here immediately.
    const probe = { resolved: false, value: undefined as boolean | undefined };
    pending.then((v) => { probe.resolved = true; probe.value = v; });
    await Promise.resolve();
    await Promise.resolve();
    expect(probe.resolved).toBe(false);

    env.dispatch({ command: 'chartPngSaveResult', ok: true, requestId: env.posted[0].requestId, path: '/tmp/x.png' });

    await expect(pending).resolves.toBe(true);
  });

  test('resolves false when the user cancels the native dialog (no earlier true)', async () => {
    const { saveBlobAsFile } = await importCopyImage();
    const blob = new Blob([new Uint8Array([9])], { type: 'image/png' });

    const pending = saveBlobAsFile(blob, 'image.png');
    await settleMicrotasks();
    const { requestId } = env.posted[0];

    // Host emits ok:false on cancel (only when requestId is present).
    env.dispatch({ command: 'chartPngSaveResult', ok: false, requestId });

    await expect(pending).resolves.toBe(false);
  });

  test('resolves false when the filesystem write fails', async () => {
    const { saveBlobAsFile } = await importCopyImage();
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });

    const pending = saveBlobAsFile(blob, 'image.png');
    await settleMicrotasks();
    const { requestId } = env.posted[0];

    env.dispatch({ command: 'chartPngSaveResult', ok: false, requestId, error: 'EACCES' });

    await expect(pending).resolves.toBe(false);
  });

  test('ignores mismatched requestId results', async () => {
    const { saveBlobAsFile } = await importCopyImage();
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });

    const pending = saveBlobAsFile(blob, 'image.png');
    await settleMicrotasks();
    const { requestId } = env.posted[0];

    // A stray/older result with a different requestId must not settle this save.
    env.dispatch({ command: 'chartPngSaveResult', ok: true, requestId: 'wrong-id' });

    const probe = { resolved: false, value: undefined as boolean | undefined };
    pending.then((v) => { probe.resolved = true; probe.value = v; });
    await Promise.resolve();
    await Promise.resolve();
    expect(probe.resolved).toBe(false);

    env.dispatch({ command: 'chartPngSaveResult', ok: true, requestId });
    await expect(pending).resolves.toBe(true);
  });

  test('sizes a fallback timeout so a missing host response does not hang', async () => {
    const { saveBlobAsFile } = await importCopyImage();
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });

    const pending = saveBlobAsFile(blob, 'image.png');
    await settleMicrotasks();

    // No host dispatch: the 60s fallback timeout must resolve false.
    await vi.advanceTimersByTimeAsync(60000);
    await expect(pending).resolves.toBe(false);
  });

  test('non-Tauri path falls back to anchor download and resolves true', async () => {
    env.remove(); // Drop the Tauri bridge so isTauriRuntime() is false.
    const { saveBlobAsFile } = await importCopyImage();
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });

    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') (el as any).click = click;
      return el;
    });

    const result = await saveBlobAsFile(blob, 'diagram.png');
    expect(result).toBe(true);
    expect(click).toHaveBeenCalledOnce();
  });
});
