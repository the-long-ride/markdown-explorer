export type ChartPngHostSaver = (canvas: HTMLCanvasElement, fileName: string) => boolean;

export function registerNativeChartPngSave(win: any): void {
  if (!win.Table) win.Table = {};
  win.Table.saveChartPngToHost = ((canvas: HTMLCanvasElement, fileName: string) => {
    const isTauri = typeof win.__TAURI__ !== 'undefined' || typeof win.__TAURI_INTERNALS__ !== 'undefined';
    if (!isTauri || !win.PlatformBridge?.postMessage) return false;
    win.PlatformBridge.postMessage({
      command: 'saveChartPng',
      fileName,
      dataUrl: canvas.toDataURL('image/png'),
    });
    return true;
  }) satisfies ChartPngHostSaver;
}
