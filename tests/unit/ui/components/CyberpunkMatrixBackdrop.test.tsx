import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CyberpunkMatrixBackdrop } from '../../../../ui/src/components/shared/CyberpunkMatrixBackdrop';

let mockThemeStyle = 'cyberpunk';

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      theme: 'dark',
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
});
