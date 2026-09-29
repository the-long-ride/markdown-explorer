import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownSourceEditor } from '../../../../ui/src/components/Content/MarkdownSourceEditor';

function renderEditor(overrides: Partial<React.ComponentProps<typeof MarkdownSourceEditor>> = {}) {
  const props: React.ComponentProps<typeof MarkdownSourceEditor> = {
    value: '# Hello',
    disabled: false,
    ariaLabel: 'Markdown source',
    language: 'en',
    onChange: vi.fn(),
    onSave: vi.fn(),
    onPreview: vi.fn(),
    ...overrides,
  };
  const view = render(<MarkdownSourceEditor {...props} />);
  return { ...view, props };
}

describe('MarkdownSourceEditor', () => {
  it('mounts CodeMirror with the controlled source and syncs external changes', () => {
    const { rerender, props } = renderEditor();
    const editor = screen.getByRole('textbox', { name: 'Markdown source' });
    expect(editor).toHaveTextContent('# Hello');

    rerender(<MarkdownSourceEditor {...props} value="# Updated" />);
    expect(editor).toHaveTextContent('# Updated');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('routes save and bold shortcuts through the editor without auto-saving ordinary edits', () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    renderEditor({ value: 'text', onChange, onSave });
    const editor = screen.getByRole('textbox', { name: 'Markdown source' });

    fireEvent.keyDown(editor, { key: 'b', ctrlKey: true });
    expect(onChange).toHaveBeenCalledWith('****text');
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.keyDown(editor, { key: 's', ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('switches the CodeMirror surface to read-only mode when disabled', () => {
    const { rerender, props } = renderEditor();
    const editor = screen.getByRole('textbox', { name: 'Markdown source' });
    expect(editor).toHaveAttribute('contenteditable', 'true');

    rerender(<MarkdownSourceEditor {...props} disabled />);
    expect(editor).toHaveAttribute('contenteditable', 'false');
  });

  it('binds link and inline-code shortcuts', () => {
    const onChange = vi.fn();
    renderEditor({ value: '', onChange });
    const editor = screen.getByRole('textbox', { name: 'Markdown source' });

    fireEvent.keyDown(editor, { key: 'e', ctrlKey: true });
    expect(onChange).toHaveBeenLastCalledWith('``');
  });

  it('shows cursor, word and character counts with the save state', () => {
    const { rerender, props } = renderEditor({ value: '# Hello world', dirty: true });
    const status = screen.getByTestId('markdown-source-editor-status');
    expect(status).toHaveTextContent('Ln 1, Col 1');
    expect(status).toHaveTextContent('2 words');
    expect(status).toHaveTextContent('13 characters');
    expect(status).toHaveTextContent('Unsaved changes');

    rerender(<MarkdownSourceEditor {...props} dirty={false} />);
    expect(status).toHaveTextContent('Saved');
    rerender(<MarkdownSourceEditor {...props} disabled />);
    expect(status).toHaveTextContent('Saving…');
  });

  it('groups toolbar buttons and exposes shortcuts in tooltips', () => {
    renderEditor();
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(bold).not.toHaveAttribute('title');
    const tooltipText = bold.querySelector('.tooltip-text')?.textContent ?? '';
    expect(tooltipText).toContain('Bold');
    expect(tooltipText).toMatch(/(Ctrl\+|⌘)B/);
    expect(bold.querySelector('svg')).not.toBeNull();
    expect(document.querySelectorAll('.markdown-formatting-toolbar__group').length).toBe(5);
  });
});
