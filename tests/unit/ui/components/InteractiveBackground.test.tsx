import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractiveBackground } from '../../../../ui/src/components/shared/InteractiveBackground';

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: { themeStyle: 'default' } }),
}));

function createMockCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

describe('InteractiveBackground', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('caches getBoundingClientRect across pointermove and refreshes on resize and scroll', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createMockCtx());
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
    const rectSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 10, top: 20, right: 810, bottom: 620, width: 800, height: 600 } as DOMRect);

    const { unmount } = render(<InteractiveBackground />);
    expect(rectSpy).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50 + i, clientY: 60 + i }));
    }
    expect(rectSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('resize'));
    expect(rectSpy).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event('scroll'));
    expect(rectSpy).toHaveBeenCalledTimes(3);

    unmount();
  });

  it('pauses rAF when document.hidden is true or prefers-reduced-motion: reduce is active', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createMockCtx());
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(11);
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    let reducedMotionHandler: ((event: MediaQueryListEvent) => void) | null = null;
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn((_ev: string, cb: (event: MediaQueryListEvent) => void) => {
          if (query.includes('prefers-reduced-motion')) reducedMotionHandler = cb;
        }),
        removeEventListener: vi.fn(),
      })),
    );

    const { unmount } = render(<InteractiveBackground />);
    expect(rafSpy).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafSpy).toHaveBeenCalledTimes(1);

    reducedMotionHandler?.({ matches: true } as MediaQueryListEvent);
    expect(cafSpy).toHaveBeenCalledWith(11);

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 140 }));
    expect(rafSpy).toHaveBeenCalledTimes(1);

    reducedMotionHandler?.({ matches: false } as MediaQueryListEvent);
    expect(rafSpy).toHaveBeenCalledTimes(2);

    unmount();
  });
});
