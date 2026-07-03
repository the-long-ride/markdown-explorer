import { describe, it, expect } from 'vitest';

const SCROLLBAR_TRACK_INLINE_INSET = 16;

function calcScrollbarMetrics(params: {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
  trackWidth: number | null;
}) {
  const { scrollWidth, clientWidth, scrollLeft } = params;
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  if (maxScrollLeft <= 1) {
    return { visible: false, thumbLeft: 0, thumbWidth: 0 };
  }
  const trackWidth =
    params.trackWidth ?? Math.max(0, clientWidth - SCROLLBAR_TRACK_INLINE_INSET);
  const thumbWidth = Math.min(
    trackWidth,
    Math.max(44, (clientWidth / scrollWidth) * trackWidth),
  );
  const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
  const thumbLeft = maxThumbLeft === 0 ? 0 : (scrollLeft / maxScrollLeft) * maxThumbLeft;
  return { visible: true, thumbLeft, thumbWidth };
}

interface Tab {
  filePath: string;
  fileName: string;
  isHome?: boolean;
}

function closeTab(tabs: Tab[], filePath: string): Tab[] {
  return tabs.filter((t) => t.filePath !== filePath);
}

function closeTabsToRight(tabs: Tab[], filePath: string): Tab[] {
  const idx = tabs.findIndex((t) => t.filePath === filePath);
  if (idx === -1) return tabs;
  return tabs.slice(0, idx + 1);
}

function closeOtherTabs(tabs: Tab[], filePath: string): Tab[] {
  return tabs.filter(
    (t) => t.filePath === filePath || t.isHome,
  );
}

function closeAllTabs(_tabs: Tab[]): Tab[] {
  return [];
}

describe('ContentTabs pure logic', () => {
  describe('scrollbar metrics', () => {
    it('is invisible when content fits (scrollWidth <= clientWidth)', () => {
      const m = calcScrollbarMetrics({
        scrollWidth: 500,
        clientWidth: 500,
        scrollLeft: 0,
        trackWidth: null,
      });
      expect(m.visible).toBe(false);
      expect(m.thumbLeft).toBe(0);
      expect(m.thumbWidth).toBe(0);
    });

    it('is invisible when maxScrollLeft is 1', () => {
      const m = calcScrollbarMetrics({
        scrollWidth: 601,
        clientWidth: 600,
        scrollLeft: 0,
        trackWidth: null,
      });
      expect(m.visible).toBe(false);
    });

    it('becomes visible when content overflows', () => {
      const m = calcScrollbarMetrics({
        scrollWidth: 1000,
        clientWidth: 500,
        scrollLeft: 0,
        trackWidth: null,
      });
      expect(m.visible).toBe(true);
    });

    it('computes thumbWidth as (clientWidth / scrollWidth) * trackWidth', () => {
      const trackWidth = 484;
      const m = calcScrollbarMetrics({
        scrollWidth: 1000,
        clientWidth: 500,
        scrollLeft: 0,
        trackWidth,
      });
      expect(m.thumbWidth).toBe((500 / 1000) * trackWidth);
    });

    it('clamps thumbWidth to minimum 44', () => {
      const m = calcScrollbarMetrics({
        scrollWidth: 10000,
        clientWidth: 100,
        scrollLeft: 0,
        trackWidth: 500,
      });
      expect(m.thumbWidth).toBe(44);
    });

    it('clamps thumbWidth to maximum trackWidth', () => {
      const trackWidth = 200;
      const m = calcScrollbarMetrics({
        scrollWidth: 520,
        clientWidth: 500,
        scrollLeft: 0,
        trackWidth,
      });
      expect(m.visible).toBe(true);
      expect(m.thumbWidth).toBeLessThanOrEqual(200);
    });

    it('computes thumbLeft from scrollLeft ratio', () => {
      const m = calcScrollbarMetrics({
        scrollWidth: 1000,
        clientWidth: 500,
        scrollLeft: 250,
        trackWidth: 484,
      });
      const maxScrollLeft = 1000 - 500;
      const maxThumbLeft = 484 - m.thumbWidth;
      const expected = (250 / maxScrollLeft) * maxThumbLeft;
      expect(m.thumbLeft).toBeCloseTo(expected, 5);
    });

    it('thumbLeft is 0 when at scroll start', () => {
      const m = calcScrollbarMetrics({
        scrollWidth: 1000,
        clientWidth: 500,
        scrollLeft: 0,
        trackWidth: 484,
      });
      expect(m.thumbLeft).toBe(0);
    });

    it('thumbLeft is maxThumbLeft when scrolled to end', () => {
      const m = calcScrollbarMetrics({
        scrollWidth: 1000,
        clientWidth: 500,
        scrollLeft: 500,
        trackWidth: 484,
      });
      const maxThumbLeft = 484 - m.thumbWidth;
      expect(m.thumbLeft).toBeCloseTo(maxThumbLeft, 5);
    });

    it('uses clientWidth - SCROLLBAR_TRACK_INLINE_INSET when trackWidth is null', () => {
      const m = calcScrollbarMetrics({
        scrollWidth: 1000,
        clientWidth: 500,
        scrollLeft: 0,
        trackWidth: null,
      });
      const expectedTrackWidth = 500 - SCROLLBAR_TRACK_INLINE_INSET;
      expect(m.thumbWidth).toBe((500 / 1000) * expectedTrackWidth);
    });

    it('thumbLeft is 0 when maxThumbLeft is 0 (thumb fills track)', () => {
      const m = calcScrollbarMetrics({
        scrollWidth: 502,
        clientWidth: 500,
        scrollLeft: 2,
        trackWidth: 44,
      });
      expect(m.thumbWidth).toBe(44);
      expect(m.thumbLeft).toBe(0);
    });
  });

  describe('closeTab', () => {
    const tabs: Tab[] = [
      { filePath: '/a.md', fileName: 'a.md' },
      { filePath: '/b.md', fileName: 'b.md' },
      { filePath: '/c.md', fileName: 'c.md' },
    ];

    it('removes the specified tab', () => {
      expect(closeTab(tabs, '/b.md')).toHaveLength(2);
    });

    it('keeps other tabs in order', () => {
      const result = closeTab(tabs, '/b.md');
      expect(result.map((t) => t.filePath)).toEqual(['/a.md', '/c.md']);
    });

    it('returns all tabs when filePath not found', () => {
      expect(closeTab(tabs, '/z.md')).toEqual(tabs);
    });

    it('removes first tab', () => {
      expect(closeTab(tabs, '/a.md')[0].filePath).toBe('/b.md');
    });

    it('removes last tab', () => {
      const result = closeTab(tabs, '/c.md');
      expect(result[result.length - 1].filePath).toBe('/b.md');
    });
  });

  describe('closeTabsToRight', () => {
    const tabs: Tab[] = [
      { filePath: '/a.md', fileName: 'a.md' },
      { filePath: '/b.md', fileName: 'b.md' },
      { filePath: '/c.md', fileName: 'c.md' },
      { filePath: '/d.md', fileName: 'd.md' },
    ];

    it('keeps tabs up to and including target', () => {
      const result = closeTabsToRight(tabs, '/b.md');
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.filePath)).toEqual(['/a.md', '/b.md']);
    });

    it('keeps all tabs if target is last', () => {
      const result = closeTabsToRight(tabs, '/d.md');
      expect(result).toHaveLength(4);
    });

    it('keeps only first if target is first', () => {
      const result = closeTabsToRight(tabs, '/a.md');
      expect(result).toHaveLength(1);
    });

    it('returns all tabs when target not found', () => {
      const result = closeTabsToRight(tabs, '/z.md');
      expect(result).toEqual(tabs);
    });
  });

  describe('closeOtherTabs', () => {
    it('keeps target and home-style tabs', () => {
      const tabs: Tab[] = [
        { filePath: '/home', fileName: 'Home', isHome: true },
        { filePath: '/a.md', fileName: 'a.md' },
        { filePath: '/b.md', fileName: 'b.md' },
      ];
      const result = closeOtherTabs(tabs, '/b.md');
      expect(result.map((t) => t.filePath)).toEqual(['/home', '/b.md']);
    });

    it('keeps only target when no home tabs exist', () => {
      const tabs: Tab[] = [
        { filePath: '/a.md', fileName: 'a.md' },
        { filePath: '/b.md', fileName: 'b.md' },
      ];
      const result = closeOtherTabs(tabs, '/a.md');
      expect(result.map((t) => t.filePath)).toEqual(['/a.md']);
    });

    it('keeps target when it is the only tab', () => {
      const tabs: Tab[] = [{ filePath: '/a.md', fileName: 'a.md' }];
      const result = closeOtherTabs(tabs, '/a.md');
      expect(result).toHaveLength(1);
    });

    it('keeps multiple home-style tabs', () => {
      const tabs: Tab[] = [
        { filePath: '/home1', fileName: 'Home1', isHome: true },
        { filePath: '/home2', fileName: 'Home2', isHome: true },
        { filePath: '/a.md', fileName: 'a.md' },
        { filePath: '/b.md', fileName: 'b.md' },
      ];
      const result = closeOtherTabs(tabs, '/a.md');
      expect(result.map((t) => t.filePath)).toEqual(['/home1', '/home2', '/a.md']);
    });
  });

  describe('closeAllTabs', () => {
    it('returns empty array', () => {
      const tabs: Tab[] = [
        { filePath: '/a.md', fileName: 'a.md' },
        { filePath: '/b.md', fileName: 'b.md' },
      ];
      expect(closeAllTabs(tabs)).toEqual([]);
    });

    it('returns empty for already-empty array', () => {
      expect(closeAllTabs([])).toEqual([]);
    });
  });
});
