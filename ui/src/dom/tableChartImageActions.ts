import { canvasToPngBlob, writeBlobToClipboard } from './copyImage';
import { getTableUiLabels } from './tableUiLabels';

type CanvasSource = HTMLCanvasElement | (() => HTMLCanvasElement | null);

const COPY_ICON = '<svg class="mdn-chart-copy-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const SAVE_ICON = '<svg class="mdn-chart-save-icon" viewBox="0 0 512 462.54" aria-hidden="true"><path fill-rule="nonzero" d="M49.68 0h337.29c13.65 0 26.06 5.64 35.03 14.61l.83.91c8.53 8.94 13.81 21.05 13.81 34.17V192.3c-13.83-3.96-28.43-6.1-43.53-6.1-7.25 0-14.38.5-21.37 1.45l38.17-35.52V49.69c0-5.95-2.36-11.49-6.2-15.62l-.6-.56c-4.16-4.16-9.89-6.79-16.14-6.79H49.68c-6.05 0-11.55 2.35-15.62 6.14l-.58.62c-4.16 4.16-6.76 9.91-6.76 16.21v177.93c29.58-26.67 76.93-63.95 106.82-89.08 4.88-4.22 12.14-4.13 16.93-.04.97.81 1.69 1.79 2.5 2.75l69.64 105.62 24.89-75.76c1.99-10.58 14.49-14.09 22.06-7.06l45.01 43.1c-7.78 4.48-15.12 9.62-21.99 15.32l-23.17-22.24-25.4 78.78c-1.6 11.15-15.44 15.38-22.92 6.78l-80.27-118.34-114.1 95.68v79.68c0 6.26 2.63 11.99 6.79 16.15 4.19 4.2 9.96 6.82 16.17 6.82h187.54c1.29 9.18 3.37 18.11 6.18 26.72H49.68c-13.58 0-26.04-5.62-35.07-14.64C5.64 368.88 0 356.46 0 342.81V49.69c0-13.67 5.59-26.11 14.58-35.11l.92-.83C24.45 5.25 36.49 0 49.68 0zM393.1 395.73l52.14-62.76h-32.37v-41.41h-39.53v41.41h-32.37l52.13 62.76zm.01-170.98c32.83 0 62.56 13.31 84.06 34.82 21.52 21.52 34.83 51.24 34.83 84.07 0 32.83-13.31 62.57-34.82 84.07-21.51 21.52-51.24 34.83-84.07 34.83-32.82 0-62.55-13.31-84.07-34.83-21.51-21.5-34.82-51.24-34.82-84.07 0-32.8 13.31-62.5 34.82-84.02 21.57-21.56 51.27-34.87 84.07-34.87zm67.83 51.05c-17.34-17.34-41.34-28.09-67.83-28.09-26.5 0-50.5 10.73-67.86 28.07-17.34 17.35-28.07 41.36-28.07 67.86 0 26.49 10.75 50.5 28.09 67.84 17.36 17.36 41.36 28.1 67.84 28.1 26.49 0 50.49-10.74 67.84-28.1 17.35-17.34 28.09-41.35 28.09-67.84 0-26.48-10.74-50.48-28.1-67.84zM267.9 61.14c11.04 0 21.06 4.48 28.31 11.73s11.73 17.26 11.73 28.31c0 11.03-4.48 21.06-11.73 28.31s-17.27 11.73-28.31 11.73c-11.05 0-21.06-4.48-28.31-11.73s-11.73-17.28-11.73-28.31c0-11.05 4.48-21.06 11.73-28.31s17.26-11.73 28.31-11.73zm12.22 27.82a17.281 17.281 0 0 0-12.22-5.05c-4.77 0-9.1 1.94-12.22 5.05a17.272 17.272 0 0 0-5.04 12.22c0 4.77 1.93 9.1 5.04 12.22 3.12 3.11 7.45 5.05 12.22 5.05 4.77 0 9.1-1.94 12.22-5.05 3.11-3.12 5.05-7.45 5.05-12.22 0-4.77-1.94-9.1-5.05-12.22z"/></svg>';

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'chart';
}

function resolveCanvas(source: CanvasSource): HTMLCanvasElement | null {
  return typeof source === 'function' ? source() : source;
}

export function closeChartContextMenu() {
  document.querySelector('.mdn-chart-context-menu')?.remove();
}

function isTauriRuntime(): boolean {
  const runtimeWindow = window as any;
  return typeof runtimeWindow.__TAURI__ !== 'undefined' || typeof runtimeWindow.__TAURI_INTERNALS__ !== 'undefined';
}

async function saveCanvasPng(canvas: HTMLCanvasElement, tableId: string, viewType: string) {
  const fileName = `${safeFilePart(tableId)}-${safeFilePart(viewType)}.png`;
  if (isTauriRuntime() && (window as any).PlatformBridge?.postMessage) {
    (window as any).PlatformBridge.postMessage({
      command: 'saveChartPng',
      fileName,
      dataUrl: canvas.toDataURL('image/png'),
    });
    return;
  }

  const blob = await canvasToPngBlob(canvas);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function showChartContextMenu(source: CanvasSource, tableId: string, viewType: string, event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  closeChartContextMenu();
  const labels = getTableUiLabels(tableId);
  const menu = document.createElement('div');
  menu.className = 'mdn-link-context-menu mdn-chart-context-menu';
  menu.setAttribute('role', 'menu');

  const addAction = (label: string, icon: string, action: () => Promise<void>) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.className = 'mdn-chart-context-menu__item';
    const iconWrap = document.createElement('span');
    iconWrap.className = 'mdn-chart-context-menu__icon';
    iconWrap.innerHTML = icon;
    const text = document.createElement('span');
    text.textContent = label;
    button.append(iconWrap, text);
    button.addEventListener('click', () => {
      closeChartContextMenu();
      void action();
    });
    menu.appendChild(button);
  };

  addAction(labels.copyChartImage, COPY_ICON, async () => {
    const canvas = resolveCanvas(source);
    if (!canvas) return;
    const blob = await canvasToPngBlob(canvas);
    if (blob) await writeBlobToClipboard(blob);
  });
  addAction(labels.saveChartPng, SAVE_ICON, async () => {
    const canvas = resolveCanvas(source);
    if (canvas) await saveCanvasPng(canvas, tableId, viewType);
  });
  document.body.appendChild(menu);

  const menuWidth = menu.offsetWidth || 210;
  const menuHeight = menu.offsetHeight || 76;
  menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8))}px`;

  const close = (pointerEvent: PointerEvent) => {
    if (!menu.contains(pointerEvent.target as Node)) closeChartContextMenu();
    document.removeEventListener('pointerdown', close, true);
  };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}
