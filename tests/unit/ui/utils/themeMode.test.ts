import { describe, it, expect, beforeEach } from 'vitest';
import { resolveThemeMode } from '../../../../ui/src/utils/themeMode';

/**
 * jsdom does not implement `window.matchMedia`. Install a minimal stub whose
 * `matches` reflects a closure-captured flag so tests can flip the
 * `prefers-color-scheme` response between tests.
 */
let matchDark = true;

interface StubMediaQueryList {
  matches: boolean;
  media: string;
  onchange: null;
  addEventListener: () => void;
  removeEventListener: () => void;
  addListener: () => void;
  removeListener: () => void;
  dispatchEvent: () => boolean;
}

function installMatchMediaStub() {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string): StubMediaQueryList => ({
      matches: /dark/.test(q) && matchDark,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
}

describe('resolveThemeMode', () => {
  beforeEach(() => {
    matchDark = true;
    installMatchMediaStub();
  });

  it('returns light for explicit light', () => {
    expect(resolveThemeMode('light')).toBe('light');
  });

  it('returns dark for explicit dark', () => {
    expect(resolveThemeMode('dark')).toBe('dark');
  });

  it('resolves auto to dark when prefers-color-scheme is dark', () => {
    matchDark = true;
    expect(resolveThemeMode('auto')).toBe('dark');
  });

  it('resolves auto to light when prefers-color-scheme is not dark', () => {
    matchDark = false;
    expect(resolveThemeMode('auto')).toBe('light');
  });
});
