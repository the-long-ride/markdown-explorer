import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarInlineEntryInput } from '../../../../ui/src/components/Sidebar/SidebarInlineEntryInput';

afterEach(cleanup);
const handlers = () => ({ onChange: vi.fn(), onCommit: vi.fn(), onCancel: vi.fn(), onBlur: vi.fn() });

describe('SidebarInlineEntryInput', () => {
  it('focuses with the caret before the extension', () => {
    render(<SidebarInlineEntryInput kind="file" value=".md" label="New file name" error={null} hint={null} busy={false} {...handlers()} />);
    const input = screen.getByRole('textbox', { name: 'New file name' }) as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(0);
  });
  it('commits on Enter, cancels on Escape, reports blur', () => {
    const h = handlers();
    render(<SidebarInlineEntryInput kind="folder" value="docs" label="New folder name" error={null} hint={null} busy={false} {...h} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.change(input, { target: { value: 'docs2' } });
    fireEvent.blur(input);
    expect(h.onCommit).toHaveBeenCalledOnce();
    expect(h.onCancel).toHaveBeenCalledOnce();
    expect(h.onChange).toHaveBeenCalledWith('docs2');
    expect(h.onBlur).toHaveBeenCalledOnce();
  });
  it('shows error over hint and marks the input invalid', () => {
    const { rerender } = render(<SidebarInlineEntryInput kind="file" value="a.txt" label="New file name" error={null} hint="Hidden type" busy={false} {...handlers()} />);
    expect(screen.getByText('Hidden type')).toBeTruthy();
    rerender(<SidebarInlineEntryInput kind="file" value="a.txt" label="New file name" error="Exists" hint="Hidden type" busy={false} {...handlers()} />);
    expect(screen.getByRole('alert').textContent).toBe('Exists');
    expect(screen.queryByText('Hidden type')).toBeNull();
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });
  it('keeps focus and goes read-only while busy', () => {
    const props = { kind: 'file' as const, value: 'a.md', label: 'New file name', error: null, hint: null, ...handlers() };
    const { rerender } = render(<SidebarInlineEntryInput {...props} busy={false} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    for (const busy of [true, false, true]) {
      rerender(<SidebarInlineEntryInput {...props} busy={busy} />);
      expect(input.readOnly).toBe(busy);
      expect(input.disabled).toBe(false);
      expect(input.getAttribute('aria-busy')).toBe(String(busy));
      expect(document.activeElement).toBe(input);
    }
  });
  it('ignores Enter and Escape while an IME composition is active', () => {
    const h = handlers();
    render(<SidebarInlineEntryInput kind="file" value="n.md" label="New file name" error={null} hint={null} busy={false} {...h} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true });
    expect(h.onCommit).not.toHaveBeenCalled();
    expect(h.onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.onCommit).toHaveBeenCalledOnce();
  });
  it('puts the caret at the end for folders', () => {
    render(<SidebarInlineEntryInput kind="folder" value="my.folder" label="New folder name" error={null} hint={null} busy={false} {...handlers()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.selectionStart).toBe(9);
    expect(input.selectionEnd).toBe(9);
  });
});
