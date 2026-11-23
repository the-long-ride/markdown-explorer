import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeThemeTransition, isThemeTransitionSupported } from '../../../../ui/src/utils/themeTransition';

const doc = document as any;
afterEach(() => {
  delete doc.startViewTransition;
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-theme-style');
  document.body.innerHTML = '';
});

describe('executeThemeTransition with view transitions', () => {
  it('falls back without view transitions and triggers the cyberpunk glitch twice', () => {
    vi.useFakeTimers();
    const update = vi.fn();
    expect(isThemeTransitionSupported()).toBe(false);
    executeThemeTransition(update, { nextTheme: 'dark', themeStyle: 'cyberpunk' });
    executeThemeTransition(update, { nextTheme: 'light' });
    expect(document.documentElement.dataset.themeGlitching).toBe('true');
    vi.advanceTimersByTime(500);
    expect(document.documentElement.dataset.themeGlitching).toBeUndefined();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('runs the update inside a transition without a finished promise', () => {
    doc.startViewTransition = vi.fn((cb: () => void) => { cb(); return {}; });
    const origin = document.createElement('button');
    document.body.appendChild(origin);
    const stale = document.createElement('div');
    stale.className = 'theme-magic-overlay';
    document.body.appendChild(stale);
    executeThemeTransition(() => document.documentElement.setAttribute('data-theme', 'dark'), { originElement: origin });
    expect(document.querySelector('.theme-magic-overlay')).toBeNull();
    expect(document.documentElement.dataset.themeTransitioning).toBeUndefined();
  });

  it('cleans up after a finished promise and recovers from a throwing transition', async () => {
    let finish!: () => void;
    doc.startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { ready: Promise.reject(new Error('skip')), updateCallbackDone: Promise.resolve(), finished: new Promise<void>((resolve) => { finish = resolve; }) };
    });
    executeThemeTransition(() => document.documentElement.setAttribute('data-theme', 'light'), { event: { clientX: 5, clientY: 6 }, themeStyle: 'default', nextTheme: 'light' });
    expect(document.querySelector('.theme-magic-overlay')?.getAttribute('data-direction')).toBe('to-light');
    finish();
    await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('.theme-magic-overlay')).toBeNull();

    doc.startViewTransition = vi.fn(() => { throw new Error('boom'); });
    const update = vi.fn();
    executeThemeTransition(update, { nextTheme: 'dark' });
    expect(update).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.theme-magic-overlay')).toBeNull();
  });
});
