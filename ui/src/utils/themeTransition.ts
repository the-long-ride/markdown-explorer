import { flushSync } from 'react-dom';

export interface ThemeTransitionOptions {
  originElement?: HTMLElement | null;
  event?: { clientX?: number; clientY?: number } | null;
  themeStyle?: string;
  nextTheme?: string;
}

let activeTransitionId = 0;
let glitchTimerId: ReturnType<typeof setTimeout> | null = null;

export function isThemeTransitionSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function' &&
    !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
  );
}

export function executeThemeTransition(
  updateThemeState: () => void,
  options?: ThemeTransitionOptions,
): void {
  const root = typeof document !== 'undefined' ? document.documentElement : null;

  const triggerGlitchEffect = () => {
    if (!root) return;
    const activeStyle = options?.themeStyle || root.getAttribute('data-theme-style') || 'default';
    if (
      activeStyle === 'cyberpunk' &&
      !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
    ) {
      if (glitchTimerId) {
        clearTimeout(glitchTimerId);
        glitchTimerId = null;
      }
      root.dataset.themeGlitching = 'true';
      glitchTimerId = setTimeout(() => {
        if (root) delete root.dataset.themeGlitching;
        glitchTimerId = null;
      }, 450);
    }
  };

  if (!isThemeTransitionSupported() || !root) {
    updateThemeState();
    if (root) {
      if (options?.nextTheme) root.setAttribute('data-theme', options.nextTheme);
      if (options?.themeStyle) root.setAttribute('data-theme-style', options.themeStyle);
      triggerGlitchEffect();
    }
    return;
  }

  const width = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const height = typeof window !== 'undefined' ? window.innerHeight : 800;

  let x = width / 2;
  let y = 24;

  const eventX = options?.event?.clientX;
  const eventY = options?.event?.clientY;
  const hasEventCoords =
    typeof eventX === 'number' &&
    typeof eventY === 'number' &&
    Number.isFinite(eventX) &&
    Number.isFinite(eventY) &&
    !(eventX === 0 && eventY === 0);

  if (hasEventCoords) {
    x = eventX!;
    y = eventY!;
  } else if (options?.originElement && typeof options.originElement.getBoundingClientRect === 'function') {
    const rect = options.originElement.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
  }

  const endRadius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const themeStyle = options?.themeStyle || root.getAttribute('data-theme-style') || 'default';
  const transitionId = ++activeTransitionId;

  // Determine transition direction (to-dark vs to-light)
  const prevAttr = root.getAttribute('data-theme');
  const wasDark = prevAttr
    ? prevAttr === 'dark'
    : Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);

  let nextEffectiveDark: boolean;
  if (options?.nextTheme === 'dark') {
    nextEffectiveDark = true;
  } else if (options?.nextTheme === 'light') {
    nextEffectiveDark = false;
  } else if (options?.nextTheme === 'auto') {
    nextEffectiveDark = Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
  } else {
    nextEffectiveDark = !wasDark;
  }

  const initialDirection: 'to-dark' | 'to-light' = nextEffectiveDark ? 'to-dark' : 'to-light';

  // Freeze underlying CSS transitions during the View Transition
  root.dataset.themeTransitioning = 'true';
  root.dataset.transitionTheme = themeStyle;
  root.dataset.transitionDirection = initialDirection;
  root.style.setProperty('--transition-origin-x', `${Math.round(x)}px`);
  root.style.setProperty('--transition-origin-y', `${Math.round(y)}px`);
  root.style.setProperty('--transition-radius', `${Math.ceil(endRadius)}px`);

  // Clean any stale overlays before starting
  if (typeof document !== 'undefined' && document.body) {
    document.querySelectorAll('.theme-magic-overlay').forEach((el) => el.remove());
  }

  let overlay: HTMLDivElement | null = null;

  const cleanup = () => {
    if (overlay && overlay.parentNode) {
      overlay.remove();
      overlay = null;
    }
    if (activeTransitionId === transitionId) {
      delete root.dataset.themeTransitioning;
      delete root.dataset.transitionTheme;
      delete root.dataset.transitionDirection;
      root.style.removeProperty('--transition-origin-x');
      root.style.removeProperty('--transition-origin-y');
      root.style.removeProperty('--transition-radius');
    }
  };

  const applyUpdate = () => {
    if (typeof document !== 'undefined' && document.body) {
      overlay = document.createElement('div');
      overlay.className = 'theme-magic-overlay';
      overlay.setAttribute('data-theme-style', themeStyle);
      overlay.setAttribute('data-direction', initialDirection);
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = '<div class="theme-magic-overlay__ring"></div><div class="theme-magic-overlay__beam"></div>';
      document.body.appendChild(overlay);
    }

    const performDomUpdate = () => {
      updateThemeState();
      if (options?.nextTheme) root.setAttribute('data-theme', options.nextTheme);
      if (options?.themeStyle) root.setAttribute('data-theme-style', options.themeStyle);
      const postAttr = root.getAttribute('data-theme');
      if (postAttr === 'dark' || postAttr === 'light') {
        const finalDirection: 'to-dark' | 'to-light' = postAttr === 'dark' ? 'to-dark' : 'to-light';
        root.dataset.transitionDirection = finalDirection;
        if (overlay) {
          overlay.setAttribute('data-direction', finalDirection);
        }
      }
    };

    try {
      flushSync(performDomUpdate);
    } catch {
      performDomUpdate();
    }
  };

  try {
    const docWithTransition = document as Document & {
      startViewTransition: (callback: () => void | Promise<void>) => {
        ready?: Promise<void>;
        finished?: Promise<void>;
        updateCallbackDone?: Promise<void>;
      };
    };
    const transition = docWithTransition.startViewTransition(applyUpdate);
    // Attach rejection handlers to prevent unhandled rejection when an in-flight transition is aborted/skipped.
    transition?.ready?.catch?.(() => {});
    transition?.updateCallbackDone?.catch?.(() => {});
    const onFinished = () => {
      cleanup();
      triggerGlitchEffect();
    };
    if (transition && typeof transition.finished?.then === 'function') {
      transition.finished.then(onFinished, onFinished);
    } else {
      onFinished();
    }
  } catch {
    applyUpdate();
    cleanup();
    triggerGlitchEffect();
  }
}
