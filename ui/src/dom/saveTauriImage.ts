// =============================================================================
// dom/saveTauriImage.ts — Tauri native save-dialog bridge for PNG blobs
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

// The host shows a native save dialog and writes the file asynchronously,
// emitting chartPngSaveResult {ok,requestId} for every outcome (write
// success, write failure, or cancelled dialog). Await it so the resolved
// boolean reflects the actual outcome, and never time out: the dialog may
// stay open arbitrarily long, and a fallback timer would report a false
// failure the instant the user returns to pick a destination.
export async function saveBlobViaTauriHost(blob: Blob, fileName: string): Promise<boolean> {
  try {
    const dataUrl = await blobToDataUrl(blob);
    const requestId = `save-image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return await new Promise<boolean>((resolve) => {
      const unsubscribe = (window as any).PlatformBridge.onMessage((msg: any) => {
        if (msg?.command !== 'chartPngSaveResult' || msg.requestId !== requestId) return;
        unsubscribe();
        resolve(Boolean(msg.ok));
      });
      try {
        (window as any).PlatformBridge.postMessage({
          command: 'saveChartPng',
          fileName,
          dataUrl,
          requestId,
        });
      } catch (err) {
        unsubscribe();
        console.warn('Tauri saveChartPng postMessage failed:', err);
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}
