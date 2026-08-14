export interface DeferredMermaidScheduler {
  setDelay(callback: () => void, delayMs: number): number;
  clearDelay(handle: number): void;
  requestIdle?: (callback: () => void, options: { timeout: number }) => number;
  cancelIdle?: (handle: number) => void;
}

export interface DeferredMermaidRerender {
  schedule(): void;
  cancel(): void;
}

const DEFAULT_DEBOUNCE_MS = 160;
const DEFAULT_IDLE_TIMEOUT_MS = 600;

function browserScheduler(): DeferredMermaidScheduler {
  const win = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  return {
    setDelay: (callback, delayMs) => win.setTimeout(callback, delayMs),
    clearDelay: (handle) => win.clearTimeout(handle),
    requestIdle: typeof win.requestIdleCallback === 'function'
      ? (callback, options) => win.requestIdleCallback!(callback, options)
      : undefined,
    cancelIdle: typeof win.cancelIdleCallback === 'function'
      ? (handle) => win.cancelIdleCallback!(handle)
      : undefined,
  };
}

export function createDeferredMermaidRerender(
  rerender: () => void,
  scheduler: DeferredMermaidScheduler = browserScheduler(),
  debounceMs = DEFAULT_DEBOUNCE_MS,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
): DeferredMermaidRerender {
  let generation = 0;
  let delayHandle: number | null = null;
  let idleHandle: number | null = null;

  const clearPending = () => {
    if (delayHandle !== null) {
      scheduler.clearDelay(delayHandle);
      delayHandle = null;
    }
    if (idleHandle !== null) {
      scheduler.cancelIdle?.(idleHandle);
      idleHandle = null;
    }
  };

  const cancel = () => {
    generation += 1;
    clearPending();
  };

  const schedule = () => {
    cancel();
    const scheduledGeneration = generation;
    delayHandle = scheduler.setDelay(() => {
      delayHandle = null;
      if (scheduledGeneration !== generation) return;

      const run = () => {
        idleHandle = null;
        if (scheduledGeneration !== generation) return;
        rerender();
      };
      if (scheduler.requestIdle) {
        idleHandle = scheduler.requestIdle(run, { timeout: idleTimeoutMs });
      } else {
        run();
      }
    }, Math.max(0, debounceMs));
  };

  return { schedule, cancel };
}
