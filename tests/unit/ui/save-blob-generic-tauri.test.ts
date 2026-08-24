import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

async function importCopyImage() {
  vi.resetModules();
  return import('../../../ui/src/dom/copyImage');
}

function installTauriBridge() {
  const listeners = new Set<(msg: any) => void>();
  const posted: any[] = [];
  (window as any).__TAURI__ = { event: {} };
  (window as any).PlatformBridge = {
    postMessage(msg: any) { posted.push(msg); },
    onMessage(handler: (msg: any) => void) {
      listeners.add(handler);
      return () => { listeners.delete(handler); };
    },
  };
  return {
    posted,
    dispatch(msg: any) { listeners.forEach((handler) => handler(msg)); },
    remove() {
      delete (window as any).__TAURI__;
      delete (window as any).PlatformBridge;
    },
  };
}

describe('generic Tauri file export', () => {
  let env: ReturnType<typeof installTauriBridge>;

  beforeEach(() => {
    vi.useFakeTimers();
    env = installTauriBridge();
  });

  afterEach(() => {
    vi.useRealTimers();
    env.remove();
  });

  test('routes HTML through the generic file-save bridge instead of the PNG-only bridge', async () => {
    const { saveBlobAsFile } = await importCopyImage();
    const pending = saveBlobAsFile(new Blob(['<h1>Export</h1>'], { type: 'text/html;charset=utf-8' }), 'export.html');
    await vi.advanceTimersByTimeAsync(50);

    expect(env.posted).toHaveLength(1);
    expect(env.posted[0].command).toBe('saveExportFile');
    expect(env.posted[0].fileName).toBe('export.html');
    expect(env.posted[0].dataUrl).toMatch(/^data:text\/html/);

    env.dispatch({ command: 'exportFileSaveResult', requestId: env.posted[0].requestId, ok: true, path: 'C:/tmp/export.html' });
    await expect(pending).resolves.toBe(true);
  });

  test('generic save resolves false on host failure instead of remaining pending forever', async () => {
    const { saveBlobAsFile } = await importCopyImage();
    const pending = saveBlobAsFile(new Blob(['zip'], { type: 'application/zip' }), 'site.zip');
    await vi.advanceTimersByTimeAsync(50);

    expect(env.posted[0].command).toBe('saveExportFile');
    env.dispatch({ command: 'exportFileSaveResult', requestId: env.posted[0].requestId, ok: false, error: 'write failed' });
    await expect(pending).resolves.toBe(false);
  });
});
