import { EditorView } from '@codemirror/view';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InlineTableEditor, type InlineTableEditorHandle } from '../../../../ui/src/components/Content/InlineTableEditor';

const ariaLabel = 'Table source';

function setup(initialSource: string) {
  const editorRef = createRef<InlineTableEditorHandle>();
  const props = {
    initialSource, ariaLabel, editorRef, wordWrap: false,
    onChange: vi.fn(), onApply: vi.fn(), onCancel: vi.fn(),
    onSaveShortcut: vi.fn(), onHistoryChange: vi.fn(),
  };
  const rendered = render(<InlineTableEditor {...props} />);
  const content = screen.getByRole('textbox', { name: ariaLabel });
  return { ...rendered, props, content, editor: editorRef.current! };
}

describe('InlineTableEditor', () => {
  it('formats the raw selection, reports undo and redo state, and releases the handle on unmount', () => {
    const { props, content, editor, unmount } = setup('Draft');
    const view = EditorView.findFromDOM(content)!;
    expect(content).toHaveFocus();
    expect(props.onHistoryChange).toHaveBeenLastCalledWith({ canUndo: false, canRedo: false });
    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(false);

    act(() => view.dispatch({ selection: { anchor: 0, head: 5 } }));
    act(() => editor.runFormat('bold'));
    expect(editor.getCurrentDoc()).toBe('**Draft**');
    expect(props.onChange).toHaveBeenLastCalledWith('**Draft**');
    expect(editor.canUndo()).toBe(true);
    expect(props.onHistoryChange).toHaveBeenLastCalledWith({ canUndo: true, canRedo: false });

    act(() => editor.undo());
    expect(editor.getCurrentDoc()).toBe('Draft');
    expect(editor.canRedo()).toBe(true);
    expect(props.onHistoryChange).toHaveBeenLastCalledWith({ canUndo: false, canRedo: true });
    act(() => editor.redo());
    expect(editor.getCurrentDoc()).toBe('**Draft**');
    act(() => editor.replaceDoc('Updated'));
    expect(props.onChange).toHaveBeenLastCalledWith('Updated');
    unmount();
    expect(props.editorRef.current).toBeNull();
  });

  it('commits a pending edit in the focused visual table cell', () => {
    const { container, editor, props } = setup('| Label |\n| --- |\n| Before |');
    const cell = container.querySelector<HTMLElement>('tbody .cm-table-cell')!;
    expect(cell).toBeInTheDocument();
    act(() => cell.focus());
    cell.textContent = 'After';
    act(() => editor.commitPendingEdit());
    expect(cell).not.toHaveFocus();
    expect(editor.getCurrentDoc()).toContain('| After |');
    expect(props.onChange).toHaveBeenLastCalledWith(expect.stringContaining('| After |'));
  });

  it('formats visual cell selections and restores the text through undo and redo', () => {
    const { container, editor } = setup('| Label |\n| --- |\n| Draft |');
    const focusCell = () => act(() => container.querySelector<HTMLElement>('tbody .cm-table-cell')!.focus());
    focusCell();
    act(() => editor.runFormat('bullet-list'));
    act(() => editor.commitPendingEdit());
    expect(editor.getCurrentDoc()).toContain('<ul><li>Draft</li></ul>');
    focusCell();
    act(() => editor.undo());
    expect(editor.getCurrentDoc()).toContain('| Draft |');
    focusCell();
    act(() => editor.redo());
    expect(editor.getCurrentDoc()).toContain('<ul><li>Draft</li></ul>');
  });

  it('applies the save chord without an optional save or history callback or imperative ref', () => {
    const onApply = vi.fn();
    render(<InlineTableEditor initialSource="Draft" ariaLabel={ariaLabel} wordWrap={false} onApply={onApply} onCancel={vi.fn()} onChange={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: ariaLabel }), { key: 's', ctrlKey: true });
    expect(onApply).toHaveBeenCalledOnce();
  });

  it('applies, saves, and cancels by keyboard using the latest callbacks, and reconfigures line wrapping', () => {
    const { content, props, rerender } = setup('Draft');
    expect(content).not.toHaveClass('cm-lineWrapping');
    const onApply = vi.fn();
    rerender(<InlineTableEditor {...props} onApply={onApply} wordWrap />);
    expect(content).toHaveClass('cm-lineWrapping');
    fireEvent.keyDown(content, { key: 'Enter', ctrlKey: true });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(props.onSaveShortcut).not.toHaveBeenCalled();
    fireEvent.keyDown(content, { key: 's', ctrlKey: true });
    expect(onApply).toHaveBeenCalledTimes(2);
    expect(props.onSaveShortcut).toHaveBeenCalledOnce();
    fireEvent.keyDown(content, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onApply).not.toHaveBeenCalled();
  });
});
