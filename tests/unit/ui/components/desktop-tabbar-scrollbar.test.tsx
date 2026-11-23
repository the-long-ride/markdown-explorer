import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTabBarScrollbar } from '../../../../ui/src/components/Desktop/useTabBarScrollbar';

const tabs = [{ id: 'one' }, { id: 'two' }];

function Scrollbar({ active = 'one', track = true }: { active?: string; track?: boolean }) {
  const {
    tabsScrollRef, scrollbarTrackRef, scrollbarMetrics, isScrollbarDragging,
    updateScrollbarMetrics, beginScrollbarDrag, handleScrollbarTrackPointerDown,
  } = useTabBarScrollbar(active, tabs);
  return <>
    <div ref={tabsScrollRef} data-testid="viewport" onScroll={updateScrollbarMetrics} />
    {track && <div ref={scrollbarTrackRef} data-testid="track" onPointerDown={handleScrollbarTrackPointerDown}>
      <div data-testid="thumb" onPointerDown={beginScrollbarDrag} />
    </div>}
    <output aria-label="Metrics">{JSON.stringify({ ...scrollbarMetrics, isScrollbarDragging })}</output>
  </>;
}

function fixture() {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', undefined);
  const view = render(<Scrollbar />);
  const viewport = screen.getByTestId('viewport');
  const track = screen.getByTestId('track');
  let scrollWidth = 800;
  let trackWidth = 180;
  Object.defineProperties(viewport, {
    clientWidth: { value: 200 },
    scrollWidth: { get: () => scrollWidth },
  });
  Object.defineProperty(track, 'clientWidth', { get: () => trackWidth });
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 0, 180, 10));
  function metrics() { return JSON.parse(screen.getByLabelText('Metrics').textContent ?? '{}'); }
  const resize = () => fireEvent.resize(window);
  return { ...view, viewport, track, metrics, resize, setContentWidth: (width: number) => { scrollWidth = width; }, setTrackWidth: (width: number) => { trackWidth = width; } };
}

function pointer(target: EventTarget, type: string, clientX: number) {
  return fireEvent(target, new MouseEvent(type, { bubbles: true, cancelable: true, clientX }));
}

describe('desktop tab bar scrollbar', () => {
  it('measures overflow, updates on scroll, and hides when tabs fit', () => {
    const { metrics, viewport, setContentWidth, resize, rerender } = fixture();
    act(() => vi.runOnlyPendingTimers());
    expect(metrics()).toMatchObject({ visible: true, thumbWidth: 45, thumbLeft: 0 });
    viewport.scrollLeft = 300;
    fireEvent.scroll(viewport);
    expect(metrics().thumbLeft).toBe(67.5);
    fireEvent.scroll(viewport);
    expect(metrics().thumbLeft).toBe(67.5);
    setContentWidth(200);
    resize();
    expect(metrics()).toMatchObject({ visible: false, thumbWidth: 0, thumbLeft: 0 });
    resize();
    setContentWidth(800);
    rerender(<Scrollbar active="two" track={false} />);
    act(() => vi.runOnlyPendingTimers());
    expect(metrics().thumbWidth).toBe(48);
  });

  it('jumps to a clicked track position and clamps subsequent drags until release', () => {
    const { metrics, viewport, track, resize } = fixture();
    const thumb = screen.getByTestId('thumb');
    expect(pointer(thumb, 'pointerdown', 35)).toBe(true);
    resize();
    expect(pointer(track, 'pointerdown', 110)).toBe(false);
    expect(viewport.scrollLeft).toBe(300);
    expect(metrics().isScrollbarDragging).toBe(true);
    pointer(window, 'pointermove', 500);
    expect(viewport.scrollLeft).toBe(600);
    pointer(window, 'pointermove', -100);
    expect(viewport.scrollLeft).toBe(0);
    pointer(window, 'pointerup', -100);
    expect(metrics().isScrollbarDragging).toBe(false);
    pointer(window, 'pointermove', 500);
    expect(viewport.scrollLeft).toBe(0);
    expect(pointer(thumb, 'pointerdown', 35)).toBe(false);
    pointer(window, 'pointermove', 102.5);
    expect(viewport.scrollLeft).toBeCloseTo(300, 0);
    pointer(window, 'pointercancel', 102.5);
    expect(metrics().isScrollbarDragging).toBe(false);
  });

  it('does not drag when the thumb fills the track or content stopped overflowing', () => {
    const { metrics, track, resize, setContentWidth, setTrackWidth } = fixture();
    const thumb = screen.getByTestId('thumb');
    setTrackWidth(40);
    resize();
    expect(metrics().thumbWidth).toBe(40);
    expect(pointer(track, 'pointerdown', 35)).toBe(true);
    expect(pointer(thumb, 'pointerdown', 35)).toBe(true);
    setTrackWidth(180);
    setContentWidth(200);
    expect(pointer(track, 'pointerdown', 35)).toBe(true);
    expect(pointer(thumb, 'pointerdown', 35)).toBe(true);
    expect(metrics().isScrollbarDragging).toBe(false);
  });
});
