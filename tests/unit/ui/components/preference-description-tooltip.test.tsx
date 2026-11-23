import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PreferenceDescriptionTooltip } from '../../../../ui/src/components/Settings/PreferenceDescriptionTooltip';

describe('PreferenceDescriptionTooltip positioning and bounds flip', () => {
  it('waits for an anchor outside the settings modal to acquire a layout box', () => {
    const anchor = document.createElement('button');
    const props = { id: 'description', description: 'Help', visible: true };
    const observe = vi.fn();
    const disconnect = vi.fn();
    let resize: ResizeObserverCallback;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    try {
      const { rerender } = render(<PreferenceDescriptionTooltip {...props} anchor={null} />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      rerender(<PreferenceDescriptionTooltip {...props} anchor={anchor} />);
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).not.toHaveClass('is-visible');
      expect(observe).toHaveBeenCalledWith(anchor);
      expect(observe).toHaveBeenCalledWith(tooltip);
      anchor.getBoundingClientRect = () => new DOMRect(1, 200, 40, 24);
      act(() => resize!([], {} as ResizeObserver));
      expect(tooltip).toHaveClass('is-visible');
      expect(tooltip.style.getPropertyValue('--preference-tooltip-left')).toBe('12px');
      rerender(<PreferenceDescriptionTooltip {...props} anchor={anchor} visible={false} />);
      expect(disconnect).toHaveBeenCalledOnce();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('renders above anchor when space allows', () => {
    const modal = document.createElement('div');
    modal.className = 'settings-card--settings';
    modal.getBoundingClientRect = () => ({ top: 100, bottom: 600, left: 100, right: 900, width: 800, height: 500, x: 100, y: 100, toJSON: () => {} });
    document.body.appendChild(modal);

    const anchor = document.createElement('div');
    anchor.getBoundingClientRect = () => ({ top: 300, bottom: 350, left: 150, right: 400, width: 250, height: 50, x: 150, y: 300, toJSON: () => {} });
    modal.appendChild(anchor);

    render(
      <PreferenceDescriptionTooltip
        id="test-tooltip"
        description="Tooltip test content"
        anchor={anchor}
        visible={true}
      />
    );

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.getAttribute('data-placement')).toBe('top');

    document.body.removeChild(modal);
  });

  it('flips to bottom when placing above would exceed settings modal top boundary', () => {
    const modal = document.createElement('div');
    modal.className = 'settings-card--settings';
    modal.getBoundingClientRect = () => ({ top: 100, bottom: 600, left: 100, right: 900, width: 800, height: 500, x: 100, y: 100, toJSON: () => {} });
    document.body.appendChild(modal);

    const anchor = document.createElement('div');
    // Anchor is near the top edge of the settings modal (top: 110px vs modal top: 100px)
    anchor.getBoundingClientRect = () => ({ top: 110, bottom: 160, left: 150, right: 400, width: 250, height: 50, x: 150, y: 110, toJSON: () => {} });
    modal.appendChild(anchor);

    render(
      <PreferenceDescriptionTooltip
        id="test-tooltip-bottom"
        description="Tooltip test content near top edge"
        anchor={anchor}
        visible={true}
      />
    );

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.getAttribute('data-placement')).toBe('bottom');

    document.body.removeChild(modal);
  });
});
