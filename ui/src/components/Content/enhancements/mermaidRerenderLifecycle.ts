import { getMermaid } from '../../../lib/renderLibs';
import { resolveThemeMode, type AppThemeMode } from '../../../utils/themeMode.ts';
import { createDeferredMermaidRerender } from './deferredMermaidRerender.ts';
import { createMermaidRerenderQueue } from './mermaidRerenderQueue.ts';
import {
  enhanceMermaid,
  getMermaidRenderNodes,
  invalidateMermaidRendering,
} from './mermaidRendering.ts';

export interface MermaidRerenderLifecycle {
  schedule(): void;
  dispose(): void;
}

interface MermaidRerenderLifecycleOptions {
  theme: string;
  runIdRef: { current: number };
}

export function createMermaidRerenderLifecycle(
  root: ParentNode,
  startEnhancements: () => () => void,
  options: MermaidRerenderLifecycleOptions,
): MermaidRerenderLifecycle {
  let disposed = false;
  let enhancementsPaused = false;
  let stopEnhancements = startEnhancements();

  const resumeEnhancements = () => {
    if (disposed || !enhancementsPaused) return;
    enhancementsPaused = false;
    stopEnhancements = startEnhancements();
  };

  const queue = createMermaidRerenderQueue<HTMLElement>(async (node, isCancelled) => {
    node.setAttribute('data-mdn-rerender-queued', 'true');
    invalidateMermaidRendering(node);
    try {
      await enhanceMermaid(root, {
        getLibrary: getMermaid,
        isDark: resolveThemeMode(options.theme as AppThemeMode) === 'dark',
        isCancelled: () => disposed || isCancelled(),
        runIdRef: options.runIdRef,
        nodes: [node],
      });
    } finally {
      if (!isCancelled() && !disposed) node.removeAttribute('data-mdn-rerender-queued');
    }
  }, undefined, { onComplete: resumeEnhancements });

  const deferred = createDeferredMermaidRerender(() => {
    if (disposed) return;
    if (!enhancementsPaused) {
      stopEnhancements();
      enhancementsPaused = true;
    }
    queue.start(getMermaidRenderNodes(root));
  });

  return {
    schedule() {
      if (disposed) return;
      queue.cancel();
      deferred.schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      deferred.cancel();
      queue.cancel();
      stopEnhancements();
    },
  };
}
