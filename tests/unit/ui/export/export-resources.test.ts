import { describe, expect, it, vi } from 'vitest';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import { readWorkspaceExportResource } from '../../../../ui/src/export/exportResources';

function bridgeHarness() {
  const handlers = new Set<(message: any) => void>();
  const posted: any[] = [];
  const bridge: PlatformBridge = {
    postMessage: (message) => { posted.push(message); },
    onMessage: (handler) => {
      handlers.add(handler as (message: any) => void);
      return () => handlers.delete(handler as (message: any) => void);
    },
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  };
  return {
    bridge,
    posted,
    emit(message: any) {
      for (const handler of [...handlers]) handler(message);
    },
  };
}

describe('readWorkspaceExportResource', () => {
  it('posts document-relative context and decodes base64 bytes', async () => {
    const harness = bridgeHarness();
    const pending = readWorkspaceExportResource(harness.bridge, '../assets/logo.png', {
      documentPath: '/workspace/docs/readme.md',
      timeoutMs: 1000,
    });
    const request = harness.posted[0];

    expect(request).toMatchObject({
      command: 'readWorkspaceExportResource',
      resourcePath: '../assets/logo.png',
      documentPath: '/workspace/docs/readme.md',
    });

    harness.emit({
      command: 'workspaceExportResourceResult',
      requestId: 'not-this-request',
      ok: true,
      relativePath: 'assets/wrong.png',
      mimeType: 'image/png',
      dataBase64: 'AA==',
    });
    harness.emit({
      command: 'workspaceExportResourceResult',
      requestId: request.requestId,
      ok: true,
      relativePath: 'assets/logo.png',
      mimeType: 'image/png',
      dataBase64: 'AQID/w==',
    });

    const result = await pending;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected resource read to succeed');
    expect(result.relativePath).toBe('assets/logo.png');
    expect(result.mimeType).toBe('image/png');
    expect([...result.bytes]).toEqual([1, 2, 3, 255]);
  });

  it('returns the host failure reason without throwing', async () => {
    const harness = bridgeHarness();
    const pending = readWorkspaceExportResource(harness.bridge, 'missing.png', { timeoutMs: 1000 });
    const request = harness.posted[0];
    harness.emit({
      command: 'workspaceExportResourceResult',
      requestId: request.requestId,
      ok: false,
      reason: 'missing',
    });
    await expect(pending).resolves.toEqual({ ok: false, reason: 'missing' });
  });

  it('returns timeout as a structured read failure', async () => {
    vi.useFakeTimers();
    try {
      const harness = bridgeHarness();
      const pending = readWorkspaceExportResource(harness.bridge, 'slow.bin', { timeoutMs: 25 });
      await vi.advanceTimersByTimeAsync(25);
      await expect(pending).resolves.toEqual({ ok: false, reason: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });
});
