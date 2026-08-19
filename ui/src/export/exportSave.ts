import type { PlatformBridge } from '../platform/bridge';
import type { AppRuntime } from '../types/settings';

const DEFAULT_SAVE_TIMEOUT_MS = 30_000;

export interface ExportArtifact {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ExportSaveResult {
  ok: boolean;
  cancelled?: boolean;
  path?: string;
  error?: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const batchSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + batchSize));
  }
  return globalThis.btoa(binary);
}

function saveWithBrowserDownload(artifact: ExportArtifact): ExportSaveResult {
  const blob = new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
  return { ok: true, path: artifact.fileName };
}

export function saveExportArtifact(
  bridge: PlatformBridge,
  runtime: AppRuntime,
  artifact: ExportArtifact,
  timeoutMs = DEFAULT_SAVE_TIMEOUT_MS,
): Promise<ExportSaveResult> {
  if (runtime === 'chrome') {
    try {
      return Promise.resolve(saveWithBrowserDownload(artifact));
    } catch (error) {
      return Promise.resolve({ ok: false, error: error instanceof Error ? error.message : 'Browser download failed' });
    }
  }

  const requestId = `export-save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ExportSaveResult) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'exportFileSaveResult' || message.requestId !== requestId) return;
      finish({
        ok: Boolean(message.ok),
        ...(message.cancelled ? { cancelled: true } : {}),
        ...(message.path ? { path: message.path } : {}),
        ...(message.error ? { error: message.error } : {}),
      });
    });
    const timer = globalThis.setTimeout(
      () => finish({ ok: false, error: 'Export save timed out' }),
      timeoutMs,
    );

    try {
      bridge.postMessage({
        command: 'saveExportFile',
        requestId,
        fileName: artifact.fileName,
        mimeType: artifact.mimeType,
        dataBase64: bytesToBase64(artifact.bytes),
      });
    } catch (error) {
      finish({ ok: false, error: error instanceof Error ? error.message : 'Unable to request export save' });
    }
  });
}
