import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollToActiveElement } from '../../../../ui/src/utils/searchJumpDom';

afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

function rect(top: number, bottom: number, size = 10) {
  return { top, bottom, width: size, height: size, left: 0, right: size, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

function setup(withContainer: boolean, markRect: DOMRect) {
  document.body.innerHTML = withContainer ? '<div class="content__scroll"><p><mark id="m">x</mark></p></div>' : '<p><mark id="m">x</mark></p>';
  const mark = document.getElementById('m') as HTMLElement;
  const scroll = vi.fn();
  mark.scrollIntoView = scroll;
  mark.getBoundingClientRect = () => markRect;
  const container = document.querySelector('.content__scroll') as HTMLElement | null;
  if (container) container.getBoundingClientRect = () => rect(0, 500, 500);
  return { mark, scroll };
}

describe('scrollToActiveElement visibility retries', () => {
  it('re-scrolls hidden, zero-sized or uncontained marks and skips visible or detached ones', () => {
    vi.useFakeTimers();
    const visible = setup(true, rect(100, 120));
    scrollToActiveElement(visible.mark, false);
    vi.advanceTimersByTime(700);
    expect(visible.scroll).toHaveBeenCalledTimes(1);

    const offscreen = setup(true, rect(900, 920));
    scrollToActiveElement(offscreen.mark, false);
    vi.advanceTimersByTime(700);
    expect(offscreen.scroll).toHaveBeenCalledTimes(3);

    const zero = setup(true, rect(0, 0, 0));
    scrollToActiveElement(zero.mark, false);
    vi.advanceTimersByTime(700);
    expect(zero.scroll).toHaveBeenCalledTimes(3);

    const loose = setup(false, rect(100, 120));
    scrollToActiveElement(loose.mark, true);
    vi.advanceTimersByTime(700);
    expect(loose.scroll.mock.calls.length).toBeGreaterThanOrEqual(3);

    const detached = setup(true, rect(900, 920));
    scrollToActiveElement(detached.mark, false);
    detached.mark.remove();
    vi.advanceTimersByTime(700);
    expect(detached.scroll).toHaveBeenCalledTimes(1);
  });
});
