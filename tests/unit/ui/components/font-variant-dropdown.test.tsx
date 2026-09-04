import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FontVariantDropdown } from '../../../../ui/src/components/Settings/FontVariantDropdown';
import type { DesktopFontBinding, DesktopFontFamily } from '../../../../ui/src/desktop/fonts/fontModel';

const mockT: any = {
  fontDefault: 'Default',
  fontNormal: 'Normal',
  fontItalic: 'Italic',
  fontVariant: 'Font variant',
};

const sampleFamily: DesktopFontFamily = {
  id: 'roboto',
  family: 'Roboto',
  source: 'system',
  cssFamily: 'Roboto, sans-serif',
  available: true,
  faces: [
    { style: 'normal', minWeight: 400, maxWeight: 400, variable: false },
    { style: 'normal', minWeight: 700, maxWeight: 700, variable: false },
    { style: 'italic', minWeight: 400, maxWeight: 400, variable: false },
  ],
};

const customBinding: DesktopFontBinding = {
  source: 'system',
  family: 'Roboto',
  style: 'normal',
  weight: 400,
};

const defaultBinding: DesktopFontBinding = {
  source: 'default',
  style: 'normal',
  weight: 400,
};

describe('FontVariantDropdown', () => {
  it('renders disabled button when source is default', () => {
    const onChange = vi.fn();
    render(
      <FontVariantDropdown
        family={sampleFamily}
        value={defaultBinding}
        t={mockT}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /font variant/i });
    expect(trigger).toBeDisabled();
    expect(trigger.textContent).toContain('Default · Normal 400');

    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders enabled dropdown and opens menu on click', () => {
    const onChange = vi.fn();
    render(
      <FontVariantDropdown
        family={sampleFamily}
        value={customBinding}
        t={mockT}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /font variant/i });
    expect(trigger).not.toBeDisabled();
    expect(trigger.textContent).toContain('Normal 400');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const menu = screen.getByRole('listbox');
    expect(menu).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Normal 400');
    expect(options[1].textContent).toBe('Normal 700');
    expect(options[2].textContent).toBe('Italic 400');

    // Choose second option
    fireEvent.click(options[1]);
    expect(onChange).toHaveBeenCalledWith({ style: 'normal', weight: 700 });
  });

  it('handles keyboard navigation and selection with Arrow keys and Enter', () => {
    const onChange = vi.fn();
    render(
      <FontVariantDropdown
        family={sampleFamily}
        value={customBinding}
        t={mockT}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /font variant/i });
    // Open via ArrowDown
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = screen.getByRole('listbox');
    expect(menu).toBeInTheDocument();

    // Navigate down
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    // Select via Enter
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ style: 'normal', weight: 700 });
  });

  it('closes menu on Escape key and outside pointerdown', () => {
    render(
      <FontVariantDropdown
        family={sampleFamily}
        value={customBinding}
        t={mockT}
        onChange={() => {}}
      />,
    );

    const trigger = screen.getByRole('button', { name: /font variant/i });
    fireEvent.click(trigger);
    const menu = screen.getByRole('listbox');
    expect(menu).toBeInTheDocument();

    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Reopen and close via outside click
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
