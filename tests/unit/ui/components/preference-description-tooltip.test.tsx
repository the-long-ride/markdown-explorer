import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PreferenceDescriptionTooltip } from '../../../../ui/src/components/Settings/PreferenceDescriptionTooltip';

describe('PreferenceDescriptionTooltip positioning and bounds flip', () => {
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
