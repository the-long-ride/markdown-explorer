import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarTreeEntryContext, sidebarTreeForcesOpen, type SidebarTreeEntryContextValue } from '../../../../ui/src/components/Sidebar/sidebarTreeContext';
import { SidebarEntryCheckbox } from '../../../../ui/src/components/Sidebar/SidebarTreeCheckboxes';

afterEach(cleanup);
const base = (patch: Partial<SidebarTreeEntryContextValue> = {}): SidebarTreeEntryContextValue => ({
  inlineParentPath: null, inlineInput: null, revealPath: null, selectionActive: true,
  isSelected: () => false, toggleSelected: vi.fn(), selectItemLabel: 'Select {name}', rememberFocus: vi.fn(), ...patch,
});

describe('sidebar tree entry context', () => {
  it('forces ancestors of the inline input and reveal path open', () => {
    expect(sidebarTreeForcesOpen(base({ inlineParentPath: 'docs/a' }), 'docs')).toBe(true);
    expect(sidebarTreeForcesOpen(base({ inlineParentPath: 'docs/a' }), 'docs/a')).toBe(true);
    expect(sidebarTreeForcesOpen(base({ inlineParentPath: 'docs/a' }), 'doc')).toBe(false);
    expect(sidebarTreeForcesOpen(base({ revealPath: 'x' }), 'x')).toBe(true);
    expect(sidebarTreeForcesOpen(base({ inlineParentPath: '' }), 'docs')).toBe(false);
  });
  it('renders a selection checkbox only in selection mode', () => {
    const value = base({ isSelected: (key) => key === 'folder:docs' });
    const { rerender } = render(<SidebarTreeEntryContext.Provider value={value}><SidebarEntryCheckbox kind="folder" path="docs" name="docs" /></SidebarTreeEntryContext.Provider>);
    const box = screen.getByRole('checkbox', { name: 'Select docs' }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(value.toggleSelected).toHaveBeenCalledWith('folder', 'docs');
    rerender(<SidebarTreeEntryContext.Provider value={base({ selectionActive: false })}><SidebarEntryCheckbox kind="folder" path="docs" name="docs" /></SidebarTreeEntryContext.Provider>);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
