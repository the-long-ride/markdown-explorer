import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CyberpunkMatrixBackdrop } from '../../../../ui/src/components/shared/CyberpunkMatrixBackdrop';

let mockThemeStyle = 'cyberpunk';
let mockTheme = 'dark';

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      theme: mockTheme,
      themeStyle: mockThemeStyle,
    },
  }),
}));

function createMockCtx() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    save: vi.fn(),
    restore: vi.fn(),
    font: '',
    textBaseline: 'top',
    fillStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('CyberpunkMatrixBackdrop', () => {
  beforeEach(() => {
    mockThemeStyle = 'cyberpunk';
    mockTheme = 'dark';
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('returns null and does not schedule rAF when themeStyle is not cyberpunk', () => {
    mockThemeStyle = 'default';
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const { container } = render(<CyberpunkMatrixBackdrop />);
    expect(container.querySelector('canvas')).toBeNull();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('does not start rAF on mount when document.hidden is true and resumes when visible', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createMockCtx());
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const { unmount } = render(<CyberpunkMatrixBackdrop />);
    expect(rafSpy).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(cafSpy).toHaveBeenCalledWith(42);

    unmount();
  });

  it('does not start rAF when prefers-reduced-motion: reduce matches and responds to change events', () => {
    const mockCtx = createMockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx);
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(99);
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    let changeHandler: ((event: MediaQueryListEvent) => void) | null = null;
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn((_ev: string, cb: (event: MediaQueryListEvent) => void) => {
          if (query.includes('prefers-reduced-motion')) changeHandler = cb;
        }),
        removeEventListener: vi.fn(),
      })),
    );

    const { unmount } = render(<CyberpunkMatrixBackdrop />);
    expect(rafSpy).not.toHaveBeenCalled();

    // User turns off reduced motion -> starts loop
    changeHandler?.({ matches: false } as MediaQueryListEvent);
    expect(rafSpy).toHaveBeenCalledTimes(1);

    // User turns on reduced motion -> cancels loop and clears canvas
    changeHandler?.({ matches: true } as MediaQueryListEvent);
    expect(cafSpy).toHaveBeenCalledWith(99);
    expect(mockCtx.clearRect).toHaveBeenCalled();

    unmount();
  });

  it('batches head character shadowBlur instead of toggling shadowBlur per trail character', () => {
    const mockCtx = createMockCtx();
    const shadowBlurAssignments: number[] = [];
    let currentShadowBlur = 0;
    Object.defineProperty(mockCtx, 'shadowBlur', {
      get: () => currentShadowBlur,
      set: (value: number) => {
        currentShadowBlur = value;
        shadowBlurAssignments.push(value);
      },
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx);
    let queuedCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      queuedCallback = cb;
      return 1;
    });

    const { unmount } = render(<CyberpunkMatrixBackdrop />);
    expect(queuedCallback).not.toBeNull();
    queuedCallback?.(performance.now() + 100);

    // Shadow blur should only be enabled/disabled once for the batched head pass (plus max 1 typo)
    expect(shadowBlurAssignments.filter((v) => v > 0).length).toBeLessThanOrEqual(2);
    expect(mockCtx.fillText).toHaveBeenCalled();

    unmount();
  });

  it.each([
    ['dark', 0.25, '#FFFFFF'],
    ['light', 0.60, '#FF0055'],
    ['auto', 0.90, '#FFFFFF'],
  ])('renders %s terminal text and rotates telemetry phases over time', (theme, random, cursorColor) => {
    mockTheme = theme;
    vi.stubGlobal('innerWidth', 840);
    vi.stubGlobal('innerHeight', 320);
    vi.stubGlobal('devicePixelRatio', 3);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' }));
    vi.spyOn(Math, 'random').mockReturnValue(random);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const ctx = createMockCtx();
    const telemetry = new Set<string>();
    const cursorColors = new Set<string>();
    const finishedPhrases = new Set<string>();
    const textAlpha = new Set<number>();
    vi.mocked(ctx.fillText).mockImplementation((text) => {
      if (text === '█') cursorColors.add(String(ctx.fillStyle));
      if (text.startsWith('//') || text.startsWith('BUFFER:') || text.startsWith('LINK:')) telemetry.add(text);
      if (text.startsWith('>')) {
        finishedPhrases.add(text);
        textAlpha.add(ctx.globalAlpha);
      }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    let next: FrameRequestCallback;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { next = callback; return 1; });
    const { container, unmount } = render(<CyberpunkMatrixBackdrop />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas).toHaveAttribute('width', '1680');
    expect(canvas).toHaveAttribute('height', '640');
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    for (let frame = 1; frame <= 185; frame += 1) next!(frame * 45);
    expect(cursorColors).toEqual(new Set([cursorColor]));
    expect([...telemetry]).toEqual(expect.arrayContaining([
      expect.stringMatching(/^\/\/ /), expect.stringMatching(/^BUFFER: 0x/), expect.stringMatching(/^LINK: /),
    ]));
    expect([...finishedPhrases].some((phrase) => phrase.length > 20)).toBe(true);
    expect([...textAlpha].some((alpha) => alpha < 0.5)).toBe(true);
    unmount();
  });

  it('defers painting during transitions and fast frames, then remeasures on resize', () => {
    const ctx = createMockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('innerWidth', 300);
    vi.stubGlobal('innerHeight', 100);
    vi.stubGlobal('devicePixelRatio', 0);
    let next: FrameRequestCallback;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { next = callback; return 42; });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const { container, unmount } = render(<CyberpunkMatrixBackdrop />);
    const canvas = container.querySelector('canvas')!;
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    try {
      document.documentElement.dataset.themeTransitioning = 'true';
      next!(60);
      expect(ctx.clearRect).not.toHaveBeenCalled();
    } finally {
      delete document.documentElement.dataset.themeTransitioning;
    }
    next!(20);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    next!(70);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 300, 100);
    expect(vi.mocked(ctx.fillText).mock.calls.some(([text]) => text.startsWith('//'))).toBe(false);
    vi.stubGlobal('innerWidth', 380);
    window.dispatchEvent(new Event('resize'));
    expect(canvas).toHaveAttribute('width', '380');
    unmount();
    expect(cancel).toHaveBeenCalledWith(42);
  });
});
