export interface MermaidViewport {
  top: number;
  bottom: number;
  nearDistance: number;
}

export interface MermaidQueueScheduler {
  requestIdle(callback: () => void, options?: { timeout: number }): number;
  cancelIdle(handle: number): void;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
}

export interface MermaidRerenderQueue<T> {
  start(nodes: readonly T[]): void;
  cancel(): void;
}

interface QueueOptions {
  viewport?: () => MermaidViewport;
  idleTimeoutMs?: number;
  onComplete?: () => void;
}

const DEFAULT_IDLE_TIMEOUT_MS = 600;

function priorityForRect(rect: { top: number; bottom: number }, viewport: MermaidViewport): number {
  if (rect.bottom >= viewport.top && rect.top <= viewport.bottom) return 0;
  const nearTop = viewport.top - viewport.nearDistance;
  const nearBottom = viewport.bottom + viewport.nearDistance;
  if (rect.bottom >= nearTop && rect.top <= nearBottom) return 1;
  return 2;
}

export function orderMermaidNodesForRerender<T extends { getBoundingClientRect(): { top: number; bottom: number } }>(
  nodes: readonly T[],
  viewport: MermaidViewport,
): T[] {
  return nodes
    .map((node, index) => ({ node, index, priority: priorityForRect(node.getBoundingClientRect(), viewport) }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ node }) => node);
}

function browserScheduler(): MermaidQueueScheduler {
  const win = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  return {
    requestIdle(callback, options) {
      if (typeof win.requestIdleCallback === 'function') return win.requestIdleCallback(callback, options);
      return win.setTimeout(callback, 0);
    },
    cancelIdle(handle) {
      if (typeof win.cancelIdleCallback === 'function') win.cancelIdleCallback(handle);
      else win.clearTimeout(handle);
    },
    requestFrame: (callback) => win.requestAnimationFrame(callback),
    cancelFrame: (handle) => win.cancelAnimationFrame(handle),
  };
}

function browserViewport(): MermaidViewport {
  const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
  return { top: 0, bottom: height, nearDistance: height };
}

export function createMermaidRerenderQueue<T extends { getBoundingClientRect(): { top: number; bottom: number } }>(
  renderNode: (node: T, isCancelled: () => boolean) => Promise<void>,
  scheduler: MermaidQueueScheduler = browserScheduler(),
  options: QueueOptions = {},
): MermaidRerenderQueue<T> {
  let generation = 0;
  let idleHandle: number | null = null;
  let frameHandle: number | null = null;

  const clearScheduled = () => {
    if (idleHandle !== null) scheduler.cancelIdle(idleHandle);
    if (frameHandle !== null) scheduler.cancelFrame(frameHandle);
    idleHandle = null;
    frameHandle = null;
  };

  const cancel = () => {
    generation += 1;
    clearScheduled();
  };

  const start = (nodes: readonly T[]) => {
    cancel();
    const currentGeneration = generation;
    const viewport = (options.viewport ?? browserViewport)();
    const ordered = orderMermaidNodesForRerender(nodes, viewport);
    let index = 0;

    const isCancelled = () => currentGeneration !== generation;
    const scheduleNext = () => {
      if (isCancelled()) return;
      if (index >= ordered.length) {
        options.onComplete?.();
        return;
      }
      idleHandle = scheduler.requestIdle(() => {
        idleHandle = null;
        if (isCancelled()) return;
        frameHandle = scheduler.requestFrame(() => {
          frameHandle = null;
          if (isCancelled()) return;
          const node = ordered[index++];
          void renderNode(node, isCancelled).then(() => {
            if (!isCancelled()) scheduleNext();
          });
        });
      }, { timeout: options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS });
    };

    scheduleNext();
  };

  return { start, cancel };
}
