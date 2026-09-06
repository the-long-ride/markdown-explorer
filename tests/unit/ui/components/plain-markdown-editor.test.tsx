import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlainMarkdownEditor } from '../../../../ui/src/components/Content/PlainMarkdownEditor';

describe('PlainMarkdownEditor', () => {
  it('edits the working source without saving until Ctrl+S', () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <PlainMarkdownEditor
        value="# A"
        disabled={false}
        onChange={onChange}
        onSave={onSave}
      />,
    );

    const editor = screen.getByRole('textbox');
    fireEvent.change(editor, { target: { value: '# B' } });
    expect(onChange).toHaveBeenLastCalledWith('# B');
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.keyDown(editor, { key: 's', ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('supports Cmd+S and prevents native save behavior', () => {
    const onSave = vi.fn();
    render(
      <PlainMarkdownEditor
        value="# A"
        disabled={false}
        onChange={vi.fn()}
        onSave={onSave}
      />,
    );

    const editor = screen.getByRole('textbox');
    const event = new KeyboardEvent('keydown', {
      key: 's',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('does not mutate or save while disabled', () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(
      <PlainMarkdownEditor
        value="# A"
        disabled
        onChange={onChange}
        onSave={onSave}
      />,
    );

    const editor = screen.getByRole('textbox');
    expect(editor).toBeDisabled();
    fireEvent.change(editor, { target: { value: '# B' } });
    fireEvent.keyDown(editor, { key: 's', ctrlKey: true });

    expect(onChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
