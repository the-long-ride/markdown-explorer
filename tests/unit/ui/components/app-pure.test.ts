import { describe, it, expect } from 'vitest';

function detectPlatform(
  windowRef: Record<string, unknown> | null,
  desktopViewMode?: string,
) {
  const w = windowRef ?? {};
  const isElectron = typeof (w as any).electronAPI !== 'undefined';
  const isChrome = typeof (w as any).__chromeExtBus !== 'undefined';
  const isDesktop = isElectron;
  const isDesktopLike = isDesktop || isChrome;
  const isTabView = isDesktop && desktopViewMode === 'tabs';
  return { isElectron, isChrome, isDesktop, isDesktopLike, isTabView };
}

function readSidebarWidthFromStorage(
  getItem: (key: string) => string | null,
): number | null {
  const stored = getItem('markdown-explorer-sidebar-width');
  if (stored) {
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

describe('App pure logic', () => {
  describe('platform detection', () => {
    it('detects Electron when electronAPI is defined', () => {
      const result = detectPlatform({ electronAPI: {} });
      expect(result.isElectron).toBe(true);
      expect(result.isDesktop).toBe(true);
    });

    it('does not detect Electron when electronAPI is absent', () => {
      const result = detectPlatform({});
      expect(result.isElectron).toBe(false);
      expect(result.isDesktop).toBe(false);
    });

    it('detects Chrome extension when __chromeExtBus is defined', () => {
      const result = detectPlatform({ __chromeExtBus: {} });
      expect(result.isChrome).toBe(true);
    });

    it('does not detect Chrome extension when __chromeExtBus is absent', () => {
      const result = detectPlatform({});
      expect(result.isChrome).toBe(false);
    });

    it('isDesktopLike is true for Electron', () => {
      const result = detectPlatform({ electronAPI: {} });
      expect(result.isDesktopLike).toBe(true);
    });

    it('isDesktopLike is true for Chrome extension', () => {
      const result = detectPlatform({ __chromeExtBus: {} });
      expect(result.isDesktopLike).toBe(true);
    });

    it('isDesktopLike is true for both Electron and Chrome', () => {
      const result = detectPlatform({ electronAPI: {}, __chromeExtBus: {} });
      expect(result.isDesktopLike).toBe(true);
    });

    it('isDesktopLike is false for web', () => {
      const result = detectPlatform({});
      expect(result.isDesktopLike).toBe(false);
    });

    it('isDesktopLike is false for null window', () => {
      const result = detectPlatform(null);
      expect(result.isDesktopLike).toBe(false);
    });

    it('isTabView requires both isDesktop and tab mode', () => {
      const result = detectPlatform({ electronAPI: {} }, 'tabs');
      expect(result.isTabView).toBe(true);
    });

    it('isTabView is false when desktop but not tab mode', () => {
      const result = detectPlatform({ electronAPI: {} }, 'sidebar');
      expect(result.isTabView).toBe(false);
    });

    it('isTabView is false when Chrome extension (not desktop) even in tab mode', () => {
      const result = detectPlatform({ __chromeExtBus: {} }, 'tabs');
      expect(result.isTabView).toBe(false);
    });

    it('isTabView is false when not desktop with undefined view mode', () => {
      const result = detectPlatform({}, undefined);
      expect(result.isTabView).toBe(false);
    });

    it('electronAPI set to undefined is not detected', () => {
      const result = detectPlatform({ electronAPI: undefined });
      expect(result.isElectron).toBe(false);
    });

    it('__chromeExtBus set to undefined is not detected', () => {
      const result = detectPlatform({ __chromeExtBus: undefined });
      expect(result.isChrome).toBe(false);
    });
  });

  describe('sidebar width from localStorage', () => {
    it('returns numeric value when key exists', () => {
      const result = readSidebarWidthFromStorage(() => '320');
      expect(result).toBe(320);
    });

    it('returns null when key does not exist', () => {
      const result = readSidebarWidthFromStorage(() => null);
      expect(result).toBeNull();
    });

    it('returns null when stored value is non-numeric', () => {
      const result = readSidebarWidthFromStorage(() => 'abc');
      expect(result).toBeNull();
    });

    it('returns numeric value for string with decimal', () => {
      const result = readSidebarWidthFromStorage(() => '245.5');
      expect(result).toBe(245.5);
    });

    it('returns null for empty string (falsy)', () => {
      const result = readSidebarWidthFromStorage(() => '');
      expect(result).toBeNull();
    });

    it('returns null for NaN string', () => {
      const result = readSidebarWidthFromStorage(() => 'NaN');
      expect(result).toBeNull();
    });

    it('returns null for Infinity string', () => {
      const result = readSidebarWidthFromStorage(() => 'Infinity');
      expect(result).toBeNull();
    });

    it('returns 0 for "0"', () => {
      const result = readSidebarWidthFromStorage(() => '0');
      expect(result).toBe(0);
    });

    it('returns negative number for negative string', () => {
      const result = readSidebarWidthFromStorage(() => '-100');
      expect(result).toBe(-100);
    });
  });
});
