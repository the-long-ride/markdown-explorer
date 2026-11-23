import React, { Profiler } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HoverTooltipPortal } from '../../../../ui/src/components/shared/HoverTooltipPortal';

describe('HoverTooltipPortal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows tooltip on hover after delay and avoids redundant re-renders when dismissing while closed', () => {
    const onRender = vi.fn();
    render(
      <>
        <button type="button" data-hover-tooltip="Workspace action">
          Action
        </button>
        <Profiler id="hover-tooltip" onRender={onRender}>
          <HoverTooltipPortal />
        </Profiler>
      </>,
    );

    expect(onRender).toHaveBeenCalledTimes(1);

    // Scroll / pointerdown / keydown while no tooltip is open should NOT trigger re-renders
    fireEvent.scroll(window);
    fireEvent.pointerDown(document);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onRender).toHaveBeenCalledTimes(1);

    const button = screen.getByRole('button', { name: 'Action' });
    fireEvent.mouseOver(button);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByRole('tooltip')).toHaveTextContent('Workspace action');
    const rendersWhenOpen = onRender.mock.calls.length;
    expect(rendersWhenOpen).toBeGreaterThan(1);

    // Dismissing once hides tooltip; subsequent scroll while closed triggers zero extra renders
    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    const rendersAfterHide = onRender.mock.calls.length;

    fireEvent.scroll(window);
    fireEvent.scroll(window);
    expect(onRender).toHaveBeenCalledTimes(rendersAfterHide);
  });

  it.each([
    [undefined, 40, 100, '68px', '100px'],
    [undefined, 440, 100, '332px', '100px'],
    [undefined, 270, 100, '270px', '128px'],
    ['right', 540, 100, '432px', '100px'],
    ['left', 30, 100, '58px', '100px'],
    ['above', 270, 100, '270px', '72px'],
    ['top', 270, 2, '270px', '30px'],
    ['bottom', 270, 375, '270px', '347px'],
    ['bottom', -10, 0, '8px', '28px'],
  ] as const)('positions a %s tooltip for a target at %d,%d, flipping or clamping to fit', (position, x, y, left, top) => {
    vi.stubGlobal('innerWidth', 600);
    vi.stubGlobal('innerHeight', 400);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'tooltip' ? new DOMRect(0, 0, 100, 20) : new DOMRect(x, y, 20, 20);
    });
    render(<>
      <button data-hover-tooltip="Workspace action" data-hover-tooltip-pos={position}>Action</button>
      <HoverTooltipPortal />
    </>);
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Action' }));
    act(() => vi.advanceTimersByTime(320));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.style.getPropertyValue('--hover-tooltip-left')).toBe(left);
    expect(tooltip.style.getPropertyValue('--hover-tooltip-top')).toBe(top);
    expect(tooltip.style.getPropertyValue('--hover-tooltip-visibility')).toBe('visible');
  });

  it('preserves hover inside one target, shortens the delay between visible tooltips, and cancels pending timers', () => {
    const { unmount } = render(<>
      <button data-hover-tooltip="First tooltip"><span>First action</span></button>
      <button data-hover-tooltip="Second tooltip">Second action</button>
      <button data-hover-tooltip=" ">Blank action</button>
      <button>Plain action</button>
      <HoverTooltipPortal />
    </>);
    const first = screen.getByRole('button', { name: 'First action' });
    const nested = screen.getByText('First action');
    const second = screen.getByRole('button', { name: 'Second action' });
    fireEvent.mouseOver(first);
    act(() => vi.advanceTimersByTime(200));
    fireEvent.mouseOut(first, { relatedTarget: nested });
    fireEvent.mouseOver(nested);
    act(() => vi.advanceTimersByTime(120));
    expect(screen.getByRole('tooltip')).toHaveTextContent('First tooltip');
    fireEvent.mouseOver(second);
    act(() => vi.advanceTimersByTime(59));
    expect(screen.getByRole('tooltip')).toHaveTextContent('First tooltip');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Second tooltip');
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Plain action' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Blank action' }));
    act(() => vi.advanceTimersByTime(320));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseOver(first);
    fireEvent.blur(window);
    act(() => vi.advanceTimersByTime(320));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseOver(first);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
