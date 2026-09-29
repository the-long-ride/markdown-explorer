import { getMermaid } from '../../../lib/renderLibs';
import { resolveThemeMode, type AppThemeMode } from '../../../utils/themeMode.ts';
import { createDeferredMermaidRerender } from './deferredMermaidRerender.ts';
import { resolveMermaidViewport, runInMermaidRenderLane } from './mermaidLazyRendering.ts';
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
  /** Scroll container of this document root; visible diagrams rerender first. */
  scroll?: Element | null;
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

  const queue = createMermaidRerenderQueue<HTMLElement>((node, isCancelled) => runInMermaidRenderLane(async () => {
    if (disposed || isCancelled()) return;
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
      // A disposed lifecycle must release the node so the next root lifecycle's
      // enhancement pass can render it again instead of leaving raw source.
      if (disposed || !isCancelled()) node.removeAttribute('data-mdn-rerender-queued');
    }
  }), undefined, {
    viewport: () => resolveMermaidViewport(options.scroll),
    onComplete: resumeEnhancements,
  });

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
