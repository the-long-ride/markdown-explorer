import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FontSearchDropdown } from '../../../../ui/src/components/Settings/FontSearchDropdown';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import type { DesktopFontFamily, DesktopFontBinding } from '../../../../ui/src/desktop/fonts/fontModel';

const mockFonts: DesktopFontFamily[] = [
  { id: 'inter', family: 'Inter', cssFamily: 'Inter', source: 'system' },
  { id: 'fira-code', family: 'Fira Code', cssFamily: 'Fira Code', source: 'system' },
  { id: 'custom-sans', family: 'Custom Sans', cssFamily: 'Custom Sans', source: 'imported' },
];

const t = getTranslations('en');

describe('FontSearchDropdown component', () => {
  it('renders default selection when value source is default', () => {
    const value: DesktopFontBinding = { source: 'default', style: 'normal', weight: 400 };
    render(
      <FontSearchDropdown
        value={value}
        fonts={mockFonts}
        t={t}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { expanded: false })).toHaveTextContent(t.fontDefault);
  });

  it('renders selected font family name', () => {
    const value: DesktopFontBinding = { source: 'system', family: 'Inter', style: 'normal', weight: 400 };
    render(
      <FontSearchDropdown
        value={value}
        fonts={mockFonts}
        t={t}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { expanded: false })).toHaveTextContent('Inter');
  });

  it('opens listbox menu on click and displays options', () => {
    const value: DesktopFontBinding = { source: 'default', style: 'normal', weight: 400 };
    render(
      <FontSearchDropdown
        value={value}
        fonts={mockFonts}
        t={t}
        onChange={vi.fn()}
      />
    );
    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(t.fontSearchPlaceholder)).toBeInTheDocument();
    expect(screen.getByText('Inter')).toBeInTheDocument();
    expect(screen.getByText('Custom Sans')).toBeInTheDocument();
  });

  it('filters fonts based on search input', () => {
    const value: DesktopFontBinding = { source: 'default', style: 'normal', weight: 400 };
    render(
      <FontSearchDropdown
        value={value}
        fonts={mockFonts}
        t={t}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));

    const searchInput = screen.getByPlaceholderText(t.fontSearchPlaceholder);
    fireEvent.change(searchInput, { target: { value: 'fira' } });

    expect(screen.getByText('Fira Code')).toBeInTheDocument();
    expect(screen.queryByText('Inter')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom Sans')).not.toBeInTheDocument();
  });

  it('selects a font option and fires onChange', () => {
    const onChange = vi.fn();
    const value: DesktopFontBinding = { source: 'default', style: 'normal', weight: 400 };
    render(
      <FontSearchDropdown
        value={value}
        fonts={mockFonts}
        t={t}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));

    fireEvent.click(screen.getByText('Fira Code'));
    expect(onChange).toHaveBeenCalledWith({ source: 'system', family: 'Fira Code' });
  });

  it('handles keyboard navigation and Enter to choose font', () => {
    const onChange = vi.fn();
    const value: DesktopFontBinding = { source: 'default', style: 'normal', weight: 400 };
    render(
      <FontSearchDropdown
        value={value}
        fonts={mockFonts}
        t={t}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));

    const searchInput = screen.getByPlaceholderText(t.fontSearchPlaceholder);
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({ source: 'system', family: 'Inter' });
  });

  it('closes menu when pressing Escape', () => {
    const value: DesktopFontBinding = { source: 'default', style: 'normal', weight: 400 };
    render(
      <FontSearchDropdown
        value={value}
        fonts={mockFonts}
        t={t}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(t.fontSearchPlaceholder);
    fireEvent.keyDown(searchInput, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keeps Default available when no fonts match, then selects an imported font and restores trigger focus', async () => {
    const onChange = vi.fn();
    render(<FontSearchDropdown value={{ source: 'default', style: 'normal', weight: 400 }} fonts={mockFonts} t={t} onChange={onChange} />);
    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);
    const search = screen.getByPlaceholderText(t.fontSearchPlaceholder);
    fireEvent.change(search, { target: { value: 'no matching font' } });
    expect(screen.getByText(t.fontNoResults)).toBeVisible();
    expect(screen.getAllByRole('option')).toEqual([screen.getByRole('option', { name: t.fontDefault })]);
    fireEvent.keyDown(search, { key: 'ArrowUp' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ source: 'default' });
    await waitFor(() => expect(trigger).toHaveFocus());
    onChange.mockClear();

    fireEvent.click(trigger);
    const reopenedSearch = screen.getByPlaceholderText(t.fontSearchPlaceholder);
    fireEvent.change(reopenedSearch, { target: { value: 'Custom Sans' } });
    fireEvent.pointerDown(reopenedSearch);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const imported = screen.getByRole('option', { name: /Custom Sans/ });
    fireEvent.pointerMove(imported);
    fireEvent.click(imported);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ source: 'imported', family: 'Custom Sans', id: 'custom-sans' });
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    expect(screen.getByPlaceholderText(t.fontSearchPlaceholder)).toHaveValue('');
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
