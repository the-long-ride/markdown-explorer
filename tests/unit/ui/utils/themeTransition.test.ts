import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeThemeTransition, isThemeTransitionSupported } from '../../../../ui/src/utils/themeTransition';

describe('themeTransition', () => {
  const originalStartViewTransition = (document as any).startViewTransition;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    delete document.documentElement.dataset.themeTransitioning;
    delete document.documentElement.dataset.transitionTheme;
    delete document.documentElement.dataset.transitionDirection;
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-style');
    document.documentElement.style.removeProperty('--transition-origin-x');
    document.documentElement.style.removeProperty('--transition-origin-y');
    document.documentElement.style.removeProperty('--transition-radius');
    document.body.innerHTML = '';
    delete (document as any).startViewTransition;
  });

  afterEach(() => {
    if (originalStartViewTransition) {
      (document as any).startViewTransition = originalStartViewTransition;
    } else {
      delete (document as any).startViewTransition;
    }
    window.matchMedia = originalMatchMedia;
  });

  it('runs updateThemeState synchronously when startViewTransition is unsupported', () => {
    const updateThemeState = vi.fn();
    executeThemeTransition(updateThemeState, { nextTheme: 'dark', themeStyle: 'cyberpunk' });

    expect(updateThemeState).toHaveBeenCalledTimes(1);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme-style')).toBe('cyberpunk');
    expect(document.documentElement.dataset.themeTransitioning).toBeUndefined();
    expect(document.documentElement.dataset.transitionTheme).toBeUndefined();
    expect(document.documentElement.dataset.transitionDirection).toBeUndefined();
    expect(document.querySelector('.theme-magic-overlay')).toBeNull();
  });

  it('runs updateThemeState synchronously when prefers-reduced-motion is active', () => {
    const updateThemeState = vi.fn();
    (document as any).startViewTransition = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(isThemeTransitionSupported()).toBe(false);
    executeThemeTransition(updateThemeState, { nextTheme: 'light', themeStyle: 'default' });
    expect(updateThemeState).toHaveBeenCalledTimes(1);
    expect((document as any).startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.themeTransitioning).toBeUndefined();
    expect(document.querySelector('.theme-magic-overlay')).toBeNull();
  });

  it('sets freeze state, direction, and coordinates during View Transition and cleans up after finished', async () => {
    const updateThemeState = vi.fn();
    let transitionCallback: (() => void) | undefined;
    let finishResolve: () => void = () => {};
    const finishedPromise = new Promise<void>((resolve) => {
      finishResolve = resolve;
    });

    (document as any).startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
      transitionCallback = cb;
      return { finished: finishedPromise };
    });

    window.matchMedia = vi.fn().mockReturnValue({ matches: false } as any);
    document.documentElement.setAttribute('data-theme', 'dark');

    executeThemeTransition(updateThemeState, {
      event: { clientX: 120, clientY: 80 },
      themeStyle: 'tokyo-night',
      nextTheme: 'light',
    });

    expect((document as any).startViewTransition).toHaveBeenCalledTimes(1);
    // Freeze state and initial direction set BEFORE callback
    expect(document.documentElement.dataset.themeTransitioning).toBe('true');
    expect(document.documentElement.dataset.transitionTheme).toBe('tokyo-night');
    expect(document.documentElement.dataset.transitionDirection).toBe('to-light');
    expect(document.documentElement.style.getPropertyValue('--transition-origin-x')).toBe('120px');
    expect(document.documentElement.style.getPropertyValue('--transition-origin-y')).toBe('80px');
    expect(document.documentElement.style.getPropertyValue('--transition-radius')).toBeTruthy();

    // Trigger transition update callback
    transitionCallback?.();
    expect(updateThemeState).toHaveBeenCalledTimes(1);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme-style')).toBe('tokyo-night');

    // Overlay is injected into document.body during update
    const overlay = document.querySelector('.theme-magic-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('data-theme-style')).toBe('tokyo-night');
    expect(overlay?.getAttribute('data-direction')).toBe('to-light');
    expect(overlay?.querySelector('.theme-magic-overlay__ring')).not.toBeNull();
    expect(overlay?.querySelector('.theme-magic-overlay__beam')).not.toBeNull();

    // Settle transition
    finishResolve();
    await finishedPromise;
    await Promise.resolve();

    // Everything cleaned up
    expect(document.documentElement.dataset.themeTransitioning).toBeUndefined();
    expect(document.documentElement.dataset.transitionTheme).toBeUndefined();
    expect(document.documentElement.dataset.transitionDirection).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--transition-origin-x')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--transition-origin-y')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--transition-radius')).toBe('');
    expect(document.querySelector('.theme-magic-overlay')).toBeNull();
  });

  it('determines to-dark direction when switching from light to dark', () => {
    let transitionCallback: (() => void) | undefined;
    (document as any).startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
      transitionCallback = cb;
      return { finished: Promise.resolve() };
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false } as any);
    document.documentElement.setAttribute('data-theme', 'light');

    executeThemeTransition(vi.fn(), {
      nextTheme: 'dark',
      themeStyle: 'cyberpunk',
    });

    expect(document.documentElement.dataset.transitionDirection).toBe('to-dark');
    transitionCallback?.();
    const overlay = document.querySelector('.theme-magic-overlay');
    expect(overlay?.getAttribute('data-direction')).toBe('to-dark');
    expect(overlay?.getAttribute('data-theme-style')).toBe('cyberpunk');
  });

  it('determines direction for nextTheme: auto using matchMedia', () => {
    (document as any).startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
    }));

    executeThemeTransition(vi.fn(), { nextTheme: 'auto', themeStyle: 'default' });
    expect(document.documentElement.dataset.transitionDirection).toBe('to-dark');
  });

  it('uses originElement bounding rect center when event is absent or 0,0', () => {
    const updateThemeState = vi.fn();
    (document as any).startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false } as any);

    const button = document.createElement('button');
    button.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      width: 40,
      height: 20,
      right: 140,
      bottom: 70,
      x: 100,
      y: 50,
      toJSON: () => {},
    });

    executeThemeTransition(updateThemeState, {
      originElement: button,
      event: { clientX: 0, clientY: 0 },
      themeStyle: 'neon-voltage',
    });

    expect(document.documentElement.style.getPropertyValue('--transition-origin-x')).toBe('120px');
    expect(document.documentElement.style.getPropertyValue('--transition-origin-y')).toBe('60px');
  });

  it('handles startViewTransition throw gracefully and cleans up', () => {
    const updateThemeState = vi.fn();
    (document as any).startViewTransition = vi.fn().mockImplementation(() => {
      throw new Error('startViewTransition failed');
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false } as any);

    expect(() => {
      executeThemeTransition(updateThemeState, { nextTheme: 'dark', themeStyle: 'vercel' });
    }).not.toThrow();

    expect(updateThemeState).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.themeTransitioning).toBeUndefined();
    expect(document.documentElement.dataset.transitionTheme).toBeUndefined();
    expect(document.querySelector('.theme-magic-overlay')).toBeNull();
  });

  it('configures overlay and root attributes across all theme presets in both directions', () => {
    const presets = ['default', 'raw-grid', 'bento', 'pet-cat', 'neon-voltage', 'tokyo-night', 'vercel', 'cyberpunk'];
    const directions: Array<{ current: string; next: string; expected: string }> = [
      { current: 'light', next: 'dark', expected: 'to-dark' },
      { current: 'dark', next: 'light', expected: 'to-light' },
    ];

    window.matchMedia = vi.fn().mockReturnValue({ matches: false } as any);

    for (const preset of presets) {
      for (const dir of directions) {
        document.documentElement.setAttribute('data-theme', dir.current);
        let callback: (() => void) | undefined;
        (document as any).startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
          callback = cb;
          return { finished: new Promise(() => {}) }; // hold open
        });

        executeThemeTransition(vi.fn(), {
          nextTheme: dir.next,
          themeStyle: preset,
        });

        expect(document.documentElement.dataset.themeTransitioning).toBe('true');
        expect(document.documentElement.dataset.transitionTheme).toBe(preset);
        expect(document.documentElement.dataset.transitionDirection).toBe(dir.expected);

        callback?.();

        const overlay = document.querySelector('.theme-magic-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay?.getAttribute('data-theme-style')).toBe(preset);
        expect(overlay?.getAttribute('data-direction')).toBe(dir.expected);
        expect(overlay?.querySelector('.theme-magic-overlay__beam')).not.toBeNull();
        expect(overlay?.querySelector('.theme-magic-overlay__ring')).not.toBeNull();

        // clean up for next iteration
        overlay?.remove();
        delete document.documentElement.dataset.themeTransitioning;
        delete document.documentElement.dataset.transitionTheme;
        delete document.documentElement.dataset.transitionDirection;
      }
    }
  });

  it('catches AbortError rejections on ready and updateCallbackDone when transition is skipped', async () => {
    const updateThemeState = vi.fn();
    const abortError = new DOMException('Transition was skipped. New ViewTransition started', 'AbortError');
    const readyPromise = Promise.reject(abortError);
    const finishedPromise = Promise.reject(abortError);
    const updateDonePromise = Promise.reject(abortError);

    (document as any).startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
      cb();
      return {
        ready: readyPromise,
        finished: finishedPromise,
        updateCallbackDone: updateDonePromise,
      };
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false } as any);

    expect(() => {
      executeThemeTransition(updateThemeState, { nextTheme: 'dark', themeStyle: 'default' });
    }).not.toThrow();

    await Promise.allSettled([readyPromise, finishedPromise, updateDonePromise]);
    expect(updateThemeState).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.themeTransitioning).toBeUndefined();
  });

  it('triggers themeGlitching on cyberpunk theme switch and clears it after timer', async () => {
    vi.useFakeTimers();
    try {
      (document as any).startViewTransition = vi.fn().mockImplementation((cb: () => void) => {
        cb();
        return { finished: Promise.resolve() };
      });
      window.matchMedia = vi.fn().mockReturnValue({ matches: false } as any);

      executeThemeTransition(vi.fn(), { nextTheme: 'dark', themeStyle: 'cyberpunk' });
      await Promise.resolve();
      expect(document.documentElement.dataset.themeGlitching).toBe('true');

      vi.advanceTimersByTime(500);
      expect(document.documentElement.dataset.themeGlitching).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
