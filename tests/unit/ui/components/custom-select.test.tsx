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

  it('falls back to the first option and skips disabled choices with either keyboard or pointer', () => {
    const onChange = vi.fn();
    const choices = [...options, { value: 'off', label: 'Unavailable', disabled: true }];
    const { container } = render(<CustomSelect aria-label="Filter" value="unknown" options={choices} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Filter' });
    expect(trigger).toHaveTextContent('All');
    fireEvent.keyDown(trigger, { key: ' ' });
    const disabled = screen.getByRole('option', { name: 'Unavailable' });
    fireEvent.mouseEnter(disabled);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.mouseDown(disabled);
    expect(disabled).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('err');
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(disabled).not.toBeInTheDocument();
    fireEvent.change(container.querySelector('select')!, { target: { value: 'warn' } });
    expect(onChange).toHaveBeenLastCalledWith('warn');
  });

  it('shows a raw value with no options and ignores keyboard input when disabled', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CustomSelect aria-label="Filter" value="custom" options={[]} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Filter' });
    expect(trigger).toHaveTextContent('custom');
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(screen.getByRole('listbox')).toBeEmptyDOMElement();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(trigger);
    rerender(<CustomSelect aria-label="Filter" value="custom" options={[]} onChange={onChange} disabled />);
    expect(fireEvent.keyDown(trigger, { key: 'Enter' })).toBe(true);
    expect(trigger).toBeDisabled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
