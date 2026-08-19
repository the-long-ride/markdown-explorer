// =============================================================================
// dom/saveTauriImage.ts — Tauri native save-dialog bridge for blobs
// =============================================================================

function isTauriRuntime(): boolean {
  const runtimeWindow = typeof window !== 'undefined' ? (window as any) : {};
  return typeof runtimeWindow.__TAURI__ !== 'undefined' || typeof runtimeWindow.__TAURI_INTERNALS__ !== 'undefined';
}

export function tauriSaveAvailable(): boolean {
  return isTauriRuntime() && Boolean((window as any).PlatformBridge?.postMessage);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function saveDataUrlViaTauriHost(
  dataUrl: string,
  fileName: string,
  command: 'saveChartPng' | 'saveExportFile',
  resultCommand: 'chartPngSaveResult' | 'exportFileSaveResult',
): Promise<boolean> {
  const requestId = `save-file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise<boolean>((resolve) => {
    const unsubscribe = (window as any).PlatformBridge.onMessage((msg: any) => {
      if (msg?.command !== resultCommand || msg.requestId !== requestId) return;
      unsubscribe();
      resolve(Boolean(msg.ok));
    });
    try {
      (window as any).PlatformBridge.postMessage({
        command,
        fileName,
        dataUrl,
        requestId,
      });
    } catch (err) {
      unsubscribe();
      console.warn(`Tauri ${command} postMessage failed:`, err);
      resolve(false);
    }
  });
}

// PNG saves keep the existing image-specific host path. Other blobs use the
// generic file-save command so HTML/ZIP exports do not get rejected by the
// PNG decoder and leave the caller waiting forever.
export async function saveBlobViaTauriHost(blob: Blob, fileName: string): Promise<boolean> {
  try {
    const dataUrl = await blobToDataUrl(blob);
    const isPng = /^image\/png(?:;|$)/i.test(blob.type) && /\.png$/i.test(fileName);
    if (isPng) {
      return await saveDataUrlViaTauriHost(dataUrl, fileName, 'saveChartPng', 'chartPngSaveResult');
    }
    return await saveDataUrlViaTauriHost(dataUrl, fileName, 'saveExportFile', 'exportFileSaveResult');
  } catch {
    return false;
  }
}
