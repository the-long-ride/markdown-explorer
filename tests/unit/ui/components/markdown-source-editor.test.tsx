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
});
