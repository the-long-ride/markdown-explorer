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
// emitting chartPngSaveResult {ok,requestId}. Await it so a cancelled dialog
// or filesystem failure resolves false here (avoiding a premature success
// notice) and the host outcome is reported exactly once. A 60s fallback
// timeout resolves false if the host never responds, so the caller never hangs.
export async function saveBlobViaTauriHost(blob: Blob, fileName: string): Promise<boolean> {
  try {
    const dataUrl = await blobToDataUrl(blob);
    const requestId = `save-image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const unsubscribe = (window as any).PlatformBridge.onMessage((msg: any) => {
        if (msg?.command !== 'chartPngSaveResult' || msg.requestId !== requestId) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(Boolean(msg.ok));
      });
      const timer = window.setTimeout(() => {
        if (settled) return;
        unsubscribe();
        resolve(false);
      }, 60000);
      try {
        (window as any).PlatformBridge.postMessage({
          command: 'saveChartPng',
          fileName,
          dataUrl,
          requestId,
        });
      } catch (err) {
        clearTimeout(timer);
        unsubscribe();
        console.warn('Tauri saveChartPng postMessage failed:', err);
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}
