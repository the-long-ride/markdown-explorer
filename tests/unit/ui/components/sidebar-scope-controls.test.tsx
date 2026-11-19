import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SidebarScopeControls } from '../../../../ui/src/components/Sidebar/SidebarScopeControls';

describe('SidebarScopeControls', () => {
  const defaultLabels = {
    focus: 'Scope',
    applyFocus: 'Apply these files for focusing',
    clear: 'Clear scope',
    checkAll: 'Check all',
    uncheckAll: 'Uncheck all',
  };

  it('renders focus button and count badge', () => {
    render(
      <SidebarScopeControls
        editing={false}
        hasEntry={false}
        count={5}
        total={5}
        allSelected={true}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const btn = screen.getByRole('button', { name: /Scope/ });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('5/5');
    expect(btn).not.toHaveClass('is-active');
    expect(btn).not.toHaveClass('is-scope-narrowed');
    expect(btn).not.toHaveAttribute('data-scope-narrowed');
  });

  it('applies is-scope-narrowed and data-scope-narrowed when showing files != all files', () => {
    render(
      <SidebarScopeControls
        editing={false}
        hasEntry={true}
        count={2}
        total={5}
        allSelected={false}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const btn = screen.getByRole('button', { name: /Scope/ });
    expect(btn).toHaveClass('is-active');
    expect(btn).toHaveClass('is-scope-narrowed');
    expect(btn).toHaveAttribute('data-scope-narrowed', 'true');
  });

  it('does not apply is-scope-narrowed when scope is inactive even if count differs', () => {
    render(
      <SidebarScopeControls
        editing={false}
        hasEntry={false}
        count={2}
        total={5}
        allSelected={false}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const btn = screen.getByRole('button', { name: /Scope/ });
    expect(btn).not.toHaveClass('is-scope-narrowed');
    expect(btn).not.toHaveAttribute('data-scope-narrowed');
  });

  it('does not apply is-scope-narrowed when scoped folder contains all files in workspace', () => {
    render(
      <SidebarScopeControls
        editing={false}
        hasEntry={true}
        count={5}
        total={5}
        allSelected={true}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const btn = screen.getByRole('button', { name: /Scope/ });
    expect(btn).toHaveClass('is-active');
    expect(btn).not.toHaveClass('is-scope-narrowed');
    expect(btn).not.toHaveAttribute('data-scope-narrowed');
  });

  it('does not apply is-scope-narrowed when total files count is 0', () => {
    render(
      <SidebarScopeControls
        editing={false}
        hasEntry={true}
        count={0}
        total={0}
        allSelected={false}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const btn = screen.getByRole('button', { name: /Scope/ });
    expect(btn).not.toHaveClass('is-scope-narrowed');
    expect(btn).not.toHaveAttribute('data-scope-narrowed');
  });

  it('honors explicit narrowed prop override', () => {
    const { rerender } = render(
      <SidebarScopeControls
        editing={false}
        hasEntry={true}
        count={5}
        total={5}
        allSelected={true}
        narrowed={true}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const btn = screen.getByRole('button', { name: /Scope/ });
    expect(btn).toHaveClass('is-scope-narrowed');
    expect(btn).toHaveAttribute('data-scope-narrowed', 'true');

    rerender(
      <SidebarScopeControls
        editing={false}
        hasEntry={true}
        count={2}
        total={5}
        allSelected={false}
        narrowed={false}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(btn).not.toHaveClass('is-scope-narrowed');
    expect(btn).not.toHaveAttribute('data-scope-narrowed');
  });

  it('invokes callbacks on button clicks', () => {
    const onToggleEditing = vi.fn();
    const onToggleAll = vi.fn();
    const onClear = vi.fn();

    render(
      <SidebarScopeControls
        editing={true}
        hasEntry={true}
        count={2}
        total={5}
        allSelected={false}
        labels={defaultLabels}
        onToggleEditing={onToggleEditing}
        onToggleAll={onToggleAll}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Scope/ }));
    expect(onToggleEditing).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: defaultLabels.checkAll }));
    expect(onToggleAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: defaultLabels.clear }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows apply-focus tooltip on the Scope Focus button only while editing chosen files', () => {
    const { rerender } = render(
      <SidebarScopeControls
        editing={true}
        hasEntry={true}
        count={2}
        total={5}
        allSelected={false}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Scope/ })).toHaveAttribute('data-hover-tooltip', 'Apply these files for focusing');

    rerender(
      <SidebarScopeControls
        editing={true}
        hasEntry={false}
        count={5}
        total={5}
        allSelected={true}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Scope/ })).not.toHaveAttribute('data-hover-tooltip');

    rerender(
      <SidebarScopeControls
        editing={false}
        hasEntry={true}
        count={2}
        total={5}
        allSelected={false}
        labels={defaultLabels}
        onToggleEditing={vi.fn()}
        onToggleAll={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Scope/ })).not.toHaveAttribute('data-hover-tooltip');
  });
});
