import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import { saveExportArtifact } from '../../../../ui/src/export/exportSave';

function bridgeHarness() {
  const handlers = new Set<(message: any) => void>();
  const posted: any[] = [];
  const bridge: PlatformBridge = {
    postMessage: (message) => posted.push(message),
    onMessage: (handler) => {
      handlers.add(handler as (message: any) => void);
      return () => handlers.delete(handler as (message: any) => void);
    },
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  };
  return {
    bridge, posted,
    emit(message: any) { for (const handler of [...handlers]) handler(message); },
  };
}

const artifact = {
  fileName: 'docs.zip',
  mimeType: 'application/zip',
  bytes: new Uint8Array([1, 2, 3, 255]),
};

afterEach(() => vi.restoreAllMocks());

describe('saveExportArtifact', () => {
  it.each(['desktop', 'tauri', 'vscode'] as const)('uses the generic host save protocol for %s', async (runtime) => {
    const harness = bridgeHarness();
    const pending = saveExportArtifact(harness.bridge, runtime, artifact, 1000);
    const request = harness.posted[0];

    expect(request).toMatchObject({
      command: 'saveExportFile',
      fileName: 'docs.zip',
      mimeType: 'application/zip',
      dataBase64: 'AQID/w==',
    });
    expect(typeof request.requestId).toBe('string');

    harness.emit({ command: 'exportFileSaveResult', requestId: 'other', ok: true, path: '/wrong' });
    harness.emit({
      command: 'exportFileSaveResult', requestId: request.requestId,
      ok: true, path: '/exports/docs.zip',
    });
    await expect(pending).resolves.toEqual({ ok: true, path: '/exports/docs.zip' });
  });

  it('preserves cancellation and host errors', async () => {
    const cancelled = bridgeHarness();
    const cancelPending = saveExportArtifact(cancelled.bridge, 'tauri', artifact, 1000);
    cancelled.emit({
      command: 'exportFileSaveResult', requestId: cancelled.posted[0].requestId,
      ok: false, cancelled: true,
    });
    await expect(cancelPending).resolves.toEqual({ ok: false, cancelled: true });

    const failed = bridgeHarness();
    const failPending = saveExportArtifact(failed.bridge, 'desktop', artifact, 1000);
    failed.emit({
      command: 'exportFileSaveResult', requestId: failed.posted[0].requestId,
      ok: false, error: 'disk full',
    });
    await expect(failPending).resolves.toEqual({ ok: false, error: 'disk full' });
  });

  it('uses an object URL download for Chromium without posting to the host bridge', async () => {
    const harness = bridgeHarness();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await expect(saveExportArtifact(harness.bridge, 'chrome', artifact, 1000))
      .resolves.toEqual({ ok: true, path: 'docs.zip' });

    expect(harness.posted).toHaveLength(0);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
  });
});
