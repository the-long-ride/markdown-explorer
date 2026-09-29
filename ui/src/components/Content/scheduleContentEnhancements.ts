import { runContentEnhancements } from './runContentEnhancements';
import { createContentEnhancementScheduler } from './contentEnhancementScheduler';

// Fired (bubbling) on the document body whenever an enhancement pass settles,
// so hosts can re-apply layout-sensitive state such as a restored scroll.
export const ENHANCEMENTS_SETTLED_EVENT = 'mdn:enhancements-settled';

interface ScheduleArgs {
  body: HTMLElement;
  state: { theme: string };
  scrollRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  mermaidRunIdRef: React.MutableRefObject<number>;
}

const PENDING_ENHANCEMENT_SELECTOR = [
  'pre code:not(.is-custom-highlighted):not([data-mdn-highlighted]):not([data-mdn-render-error])',
  '.mdn-math[data-math]:not(.is-rendered):not([data-mdn-render-error])',
  '.mermaid:not([data-mdn-rendered]):not([data-mdn-render-error]):not([data-mdn-rerender-queued])',
  '.mdn-table:not([data-mdn-enhanced]):not([data-mdn-render-error])',
].join(',');

function resolveDarkTheme(theme: string): boolean {
  return theme === 'dark' || (
    theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function hasPendingContentEnhancements(body: ParentNode): boolean {
  return body.querySelector(PENDING_ENHANCEMENT_SELECTOR) !== null;
}

export function scheduleContentEnhancements({
  body,
  state,
  scrollRef,
  handleScroll,
  mermaidRunIdRef,
}: ScheduleArgs) {
  let cancelled = false;
  const scheduler = createContentEnhancementScheduler({
    body,
    hasPending: () => hasPendingContentEnhancements(body),
    run: () => runContentEnhancements({
      body,
      isDark: resolveDarkTheme(state.theme),
      isCancelled: () => cancelled,
      mermaidRunIdRef,
      scroll: scrollRef.current,
    }),
    onSettled: () => {
      handleScroll();
      body.dispatchEvent(new CustomEvent(ENHANCEMENTS_SETTLED_EVENT, { bubbles: true }));
    },
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    createObserver: (callback) => new MutationObserver(callback),
    setDelay: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearDelay: (handle) => window.clearTimeout(handle),
  });

  return () => {
    cancelled = true;
    mermaidRunIdRef.current += 1;
    scheduler.dispose();
  };
}
