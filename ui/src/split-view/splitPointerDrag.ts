import { normalizePathKey } from '../contexts/appStateModel';
import type { PaneId } from './paneState';

// Split-view drags run on pointer events instead of HTML5 drag and drop.
// Tauri keeps its native file-drop handler enabled (to open files dragged in
// from the OS), and on Windows that disables HTML5 drag events inside the
// webview entirely. Pointer events behave the same in every host.

export type SplitDragPayload =
  | { kind: 'split-tab'; sourcePaneId: PaneId; filePath: string }
  | { kind: 'document'; filePath: string }
  | { kind: 'split-header'; paneId: PaneId };

export type SplitDropTarget =
  | { paneId: PaneId; zone: 'tab'; index: number; side: 'before' | 'after' }
  | { paneId: PaneId; zone: 'strip' }
  | { paneId: PaneId; zone: 'pane' };

export type SplitDropHandler = (payload: SplitDragPayload, target: SplitDropTarget) => void;

export interface PointerDragOptions {
  label: string;
  source?: HTMLElement | null;
}

const DRAG_THRESHOLD_PX = 5;
const PANE_SELECTOR = '.split-document-pane[data-pane-id]';
const TAB_SELECTOR = '.split-document-pane__tab-wrap';
const STRIP_SELECTOR = '.split-document-pane__tabs';
const MARKER_CLASSES = ['is-drop-before', 'is-drop-after', 'is-tab-drop-target', 'is-file-drag-target', 'is-pane-swap-target'];

let dropHandler: SplitDropHandler | null = null;
let activeCleanup: (() => void) | null = null;

export function setSplitDropHandler(handler: SplitDropHandler): () => void {
  dropHandler = handler;
  return () => {
    if (dropHandler === handler) dropHandler = null;
  };
}

export function isSplitPointerDragActive(): boolean {
  return document.body.classList.contains('is-split-dragging');
}

function paneIdOf(pane: HTMLElement): PaneId | null {
  const id = pane.dataset.paneId;
  return id === 'primary' || id === 'secondary' ? id : null;
}

export function resolveSplitDropTarget(x: number, y: number): SplitDropTarget | null {
  const hit = document.elementFromPoint(x, y);
  const pane = hit?.closest<HTMLElement>(PANE_SELECTOR);
  const paneId = pane ? paneIdOf(pane) : null;
  if (!pane || !paneId) return null;
  const tab = hit!.closest<HTMLElement>(TAB_SELECTOR);
  if (tab && pane.contains(tab)) {
    const index = Array.from(pane.querySelectorAll(TAB_SELECTOR)).indexOf(tab);
    const rect = tab.getBoundingClientRect();
    const side = rect.width > 0 && x > rect.left + rect.width / 2 ? 'after' : 'before';
    return { paneId, zone: 'tab', index, side };
  }
  if (hit!.closest(STRIP_SELECTOR)) return { paneId, zone: 'strip' };
  return { paneId, zone: 'pane' };
}

// Gap position in the target strip -> index in that list without the dragged path.
export function resolveTabDropIndex(paths: readonly string[], index: number, side: 'before' | 'after', filePath: string): number {
  const gap = side === 'after' ? index + 1 : index;
  const existing = paths.findIndex((path) => normalizePathKey(path) === normalizePathKey(filePath));
  return existing >= 0 && existing < gap ? gap - 1 : gap;
}

function clearMarkers(): void {
  for (const className of MARKER_CLASSES) {
    document.querySelectorAll(`.${className}`).forEach((node) => node.classList.remove(className));
  }
}

function showMarker(payload: SplitDragPayload, target: SplitDropTarget | null): void {
  clearMarkers();
  if (!target) return;
  const pane = document.querySelector<HTMLElement>(`.split-document-pane[data-pane-id="${target.paneId}"]`);
  if (!pane) return;
  if (payload.kind === 'split-header') {
    if (target.paneId !== payload.paneId) pane.classList.add('is-pane-swap-target');
    return;
  }
  if (target.zone === 'tab') {
    pane.querySelectorAll(TAB_SELECTOR)[target.index]?.classList.add(`is-drop-${target.side}`);
  } else if (target.zone === 'strip') {
    pane.querySelector(STRIP_SELECTOR)?.classList.add('is-tab-drop-target');
  } else {
    pane.classList.add('is-file-drag-target');
  }
}

function suppressNextClick(): void {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
}

// Arms a drag from a primary-button pointerdown. The drag only starts once the
// pointer travels past a small threshold, so plain clicks keep working.
export function beginSplitPointerDrag(
  event: { button: number; clientX: number; clientY: number; pointerId?: number },
  payload: SplitDragPayload,
  options: PointerDragOptions,
): void {
  if (event.button !== 0) return;
  activeCleanup?.();
  const startX = event.clientX;
  const startY = event.clientY;
  let started = false;
  let ghost: HTMLElement | null = null;
  let target: SplitDropTarget | null = null;

  const start = () => {
    started = true;
    window.getSelection()?.removeAllRanges();
    document.body.classList.add('is-split-dragging');
    options.source?.classList.add('is-dragging');
    ghost = document.createElement('div');
    // Same floating label as the main document tab strip (.tab-drag-ghost).
    ghost.className = 'tab-drag-ghost';
    ghost.style.display = 'flex';
    ghost.textContent = options.label;
    document.body.appendChild(ghost);
  };

  const onMove = (move: PointerEvent) => {
    if (!started) {
      if (Math.hypot(move.clientX - startX, move.clientY - startY) < DRAG_THRESHOLD_PX) return;
      start();
    }
    move.preventDefault();
    if (ghost) ghost.style.transform = `translate3d(${move.clientX + 10}px, ${move.clientY + 10}px, 0)`;
    target = resolveSplitDropTarget(move.clientX, move.clientY);
    showMarker(payload, target);
  };

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', cleanup, true);
    window.removeEventListener('keydown', onKey, true);
    clearMarkers();
    ghost?.remove();
    options.source?.classList.remove('is-dragging');
    document.body.classList.remove('is-split-dragging');
    if (activeCleanup === cleanup) activeCleanup = null;
  };

  const onUp = (up: PointerEvent) => {
    const wasStarted = started;
    const dropTarget = wasStarted ? resolveSplitDropTarget(up.clientX, up.clientY) ?? target : null;
    cleanup();
    if (!wasStarted) return;
    suppressNextClick();
    if (dropTarget) dropHandler?.(payload, dropTarget);
  };

  const onKey = (key: KeyboardEvent) => {
    if (key.key === 'Escape') cleanup();
  };

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', cleanup, true);
  window.addEventListener('keydown', onKey, true);
  activeCleanup = cleanup;
}
