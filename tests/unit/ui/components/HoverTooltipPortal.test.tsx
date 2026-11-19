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
});
