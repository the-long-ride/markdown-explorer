import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomSelect } from '../../../../ui/src/components/shared/CustomSelect';

describe('CustomSelect component', () => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'warn', label: 'Warning' },
    { value: 'err', label: 'Error', badge: 'Critical' },
  ];

  it('renders closed initially and opens custom dropdown on click', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CustomSelect aria-label="Filter" value="all" options={options} onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: 'Filter' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Click opens dropdown
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Filter' })).toBeVisible();

    // Select an option
    const warnOption = screen.getByRole('option', { name: /warning/i });
    await user.click(warnOption);
    expect(onChange).toHaveBeenCalledWith('warn');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('supports keyboard navigation with arrow keys, Enter, and Escape', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CustomSelect aria-label="Filter" value="all" options={options} onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: 'Filter' });

    // Press ArrowDown to open
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Press Escape to close
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Reopen and navigate with arrow keys
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalled();
  });
});
