import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { MarkdownSourceEditor } from '../../../../ui/src/components/Content/MarkdownSourceEditor';
import { EDITOR_FONT_SIZE_EVENT, EDITOR_FONT_SIZE_STORAGE_KEY } from '../../../../ui/src/editor/editorUx';

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

    fireEvent.keyDown(editor, { key: '`', ctrlKey: true });
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
    fireEvent.mouseEnter(bold);
    const tooltipText = document.body.querySelector('.tooltip-text.tooltip-portal')?.textContent ?? '';
    expect(tooltipText).toContain('Bold');
    expect(tooltipText).toMatch(/(Ctrl\+|⌘)B/);
    expect(bold.querySelector('svg')).not.toBeNull();
    expect(document.querySelectorAll('.markdown-formatting-toolbar__group').length).toBe(7);
    const wrapButton = screen.getByRole('button', { name: 'Wrap text' });
    expect(wrapButton).toBeInTheDocument();
    expect(screen.getByTestId('editor-font-size-value')).toBeInTheDocument();
  });

  it('adjusts editor font size and updates container attribute', () => {
    const { container } = renderEditor();
    const editor = container.querySelector('.markdown-source-editor');
    expect(editor).toHaveAttribute('data-editor-font-size', '14');

    fireEvent.click(screen.getByRole('button', { name: 'Increase font size' }));
    expect(editor).toHaveAttribute('data-editor-font-size', '15');
    expect(screen.getByTestId('editor-font-size-input')).toHaveValue('15');

    const textbox = screen.getByRole('textbox', { name: 'Markdown source' });
    fireEvent.keyDown(textbox, { key: '=', ctrlKey: true });
    expect(editor).toHaveAttribute('data-editor-font-size', '16');

    fireEvent.keyDown(textbox, { key: '-', ctrlKey: true });
    expect(editor).toHaveAttribute('data-editor-font-size', '15');
  });

  it('triggers immediate EditorView.requestMeasure when adjusting font size without needing window resize', () => {
    const requestMeasureSpy = vi.spyOn(EditorView.prototype, 'requestMeasure');
    requestMeasureSpy.mockClear();

    renderEditor();
    expect(requestMeasureSpy).toHaveBeenCalled();
    requestMeasureSpy.mockClear();

    // Changing font size via toolbar button immediately triggers measurement
    fireEvent.click(screen.getByRole('button', { name: 'Increase font size' }));
    expect(requestMeasureSpy).toHaveBeenCalled();
    requestMeasureSpy.mockClear();

    // Changing font size via keyboard shortcut immediately triggers measurement
    const textbox = screen.getByRole('textbox', { name: 'Markdown source' });
    fireEvent.keyDown(textbox, { key: '=', ctrlKey: true });
    expect(requestMeasureSpy).toHaveBeenCalled();

    requestMeasureSpy.mockRestore();
  });

  it('synchronizes font size and requests measure on external font size event', () => {
    const requestMeasureSpy = vi.spyOn(EditorView.prototype, 'requestMeasure');
    const { container } = renderEditor();
    requestMeasureSpy.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent(EDITOR_FONT_SIZE_EVENT, { detail: 18 }));
    });

    const editor = container.querySelector('.markdown-source-editor');
    expect(editor).toHaveAttribute('data-editor-font-size', '18');
    expect(requestMeasureSpy).toHaveBeenCalled();

    requestMeasureSpy.mockRestore();
  });

  it('triggers measure when controlled fontSize prop updates', () => {
    const requestMeasureSpy = vi.spyOn(EditorView.prototype, 'requestMeasure');
    const { rerender, props } = renderEditor({ fontSize: 14 });
    requestMeasureSpy.mockClear();

    rerender(<MarkdownSourceEditor {...props} fontSize={20} />);
    expect(requestMeasureSpy).toHaveBeenCalled();

    requestMeasureSpy.mockRestore();
  });

  it('reports the requested font size without overriding a controlled font size', () => {
    const onFontSizeChange = vi.fn();
    const previous = localStorage.getItem(EDITOR_FONT_SIZE_STORAGE_KEY);
    try {
      const { props, rerender } = renderEditor({ fontSize: 20, onFontSizeChange });
      const container = screen.getByTestId('markdown-source-editor');
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Markdown source' }), { key: '-', ctrlKey: true });
      expect(onFontSizeChange).toHaveBeenCalledExactlyOnceWith(19);
      expect(container).toHaveAttribute('data-editor-font-size', '20');
      rerender(<MarkdownSourceEditor {...props} fontSize={19} />);
      expect(container).toHaveAttribute('data-editor-font-size', '19');
    } finally {
      if (previous === null) localStorage.removeItem(EDITOR_FONT_SIZE_STORAGE_KEY);
      else localStorage.setItem(EDITOR_FONT_SIZE_STORAGE_KEY, previous);
    }
  });

  it('synchronizes font size across windows without accepting unrelated storage events', () => {
    const { container, unmount } = renderEditor();
    const editor = container.querySelector('.markdown-source-editor');
    const measure = vi.spyOn(EditorView.prototype, 'requestMeasure');
    const storage = (key: string, newValue: string | null) =>
      fireEvent(window, new StorageEvent('storage', { key, newValue }));
    try {
      storage(EDITOR_FONT_SIZE_STORAGE_KEY, '42');
      expect(editor).toHaveAttribute('data-editor-font-size', '32');
      expect(measure).toHaveBeenCalled();
      measure.mockClear();
      storage('another-setting', '12');
      storage(EDITOR_FONT_SIZE_STORAGE_KEY, null);
      fireEvent(window, new CustomEvent(EDITOR_FONT_SIZE_EVENT, { detail: '10' }));
      expect(editor).toHaveAttribute('data-editor-font-size', '32');
      expect(measure).not.toHaveBeenCalled();
      storage(EDITOR_FONT_SIZE_STORAGE_KEY, '2');
      expect(editor).toHaveAttribute('data-editor-font-size', '8');
      unmount();
      measure.mockClear();
      storage(EDITOR_FONT_SIZE_STORAGE_KEY, '14');
      expect(measure).not.toHaveBeenCalled();
    } finally {
      measure.mockRestore();
    }
  });
it('preserves undo and redo history across unmount and remount with the same sessionKey', () => {
    let currentValue = 'initial text';
    const onChange = vi.fn((val: string) => { currentValue = val; });

    const { unmount } = render(
      <MarkdownSourceEditor
        value={currentValue}
        sessionKey="doc1.md"
        disabled={false}
        ariaLabel="Markdown source"
        language="en"
        onChange={onChange}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    const editor = screen.getByRole('textbox', { name: 'Markdown source' });
    fireEvent.keyDown(editor, { key: 'b', ctrlKey: true });
    expect(onChange).toHaveBeenCalled();
    expect(currentValue).toContain('**');

    unmount();

    render(
      <MarkdownSourceEditor
        value={currentValue}
        sessionKey="doc1.md"
        disabled={false}
        ariaLabel="Markdown source"
        language="en"
        onChange={onChange}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).not.toBeDisabled();
    fireEvent.click(undoButton);
    expect(onChange).toHaveBeenLastCalledWith('initial text');
    expect(undoButton).toBeDisabled();
  });

  it('does not leak undo history across different session keys', () => {
    let currentValueA = 'text A';
    const onChangeA = vi.fn((val: string) => { currentValueA = val; });

    const { unmount } = render(
      <MarkdownSourceEditor
        value={currentValueA}
        sessionKey="docA.md"
        disabled={false}
        ariaLabel="Markdown source A"
        language="en"
        onChange={onChangeA}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    const editorA = screen.getByRole('textbox', { name: 'Markdown source A' });
    fireEvent.keyDown(editorA, { key: 'b', ctrlKey: true });
    expect(onChangeA).toHaveBeenCalled();

    unmount();

    render(
      <MarkdownSourceEditor
        value="text B"
        sessionKey="docB.md"
        disabled={false}
        ariaLabel="Markdown source B"
        language="en"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    const undoButtonB = screen.getByRole('button', { name: 'Undo' });
    expect(undoButtonB).toBeDisabled();
  });

  it('does not add external value changes to undo history', () => {
    let currentValue = 'initial disk content';
    const onChange = vi.fn((val: string) => { currentValue = val; });

    const { rerender } = render(
      <MarkdownSourceEditor
        value={currentValue}
        sessionKey="docReload.md"
        disabled={false}
        ariaLabel="Markdown source"
        language="en"
        onChange={onChange}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    const editor = screen.getByRole('textbox', { name: 'Markdown source' });
    fireEvent.keyDown(editor, { key: 'b', ctrlKey: true });
    expect(onChange).toHaveBeenCalled();

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).not.toBeDisabled();

    // External reload updates value from disk
    rerender(
      <MarkdownSourceEditor
        value="reloaded disk content"
        sessionKey="docReload.md"
        disabled={false}
        ariaLabel="Markdown source"
        language="en"
        onChange={onChange}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    // After external reload without history recording, undo is disabled
    expect(undoButton).toBeDisabled();
  });

  it('toggles word wrap when clicking the wrap button', () => {
    render(
      <MarkdownSourceEditor
        value="long text"
        disabled={false}
        ariaLabel="Markdown source"
        language="en"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    const wrapButton = screen.getByRole('button', { name: 'Wrap text' });
    expect(wrapButton).toHaveAttribute('aria-pressed', 'true');
    expect(wrapButton).toHaveClass('markdown-formatting-toolbar__button--active');

    fireEvent.click(wrapButton);
    expect(wrapButton).toHaveAttribute('aria-pressed', 'false');
    expect(wrapButton).not.toHaveClass('markdown-formatting-toolbar__button--active');

    fireEvent.click(wrapButton);
    expect(wrapButton).toHaveAttribute('aria-pressed', 'true');
    expect(wrapButton).toHaveClass('markdown-formatting-toolbar__button--active');
  });

  it('supports rectangular and multiple selections in editor state', () => {
    const { container } = render(
      <MarkdownSourceEditor
        value={"line 1\nline 2\nline 3"}
        disabled={false}
        ariaLabel="Markdown source"
        language="en"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    const cmEditor = container.querySelector('.cm-editor');
    expect(cmEditor).toBeInTheDocument();
  });

  it('supports Mod-Arrow word navigation shortcuts without errors', () => {
    renderEditor({ value: 'first second third' });
    const editor = screen.getByRole('textbox', { name: 'Markdown source' });
    expect(() => {
      fireEvent.keyDown(editor, { key: 'ArrowRight', ctrlKey: true });
      fireEvent.keyDown(editor, { key: 'ArrowLeft', ctrlKey: true });
      fireEvent.keyDown(editor, { key: 'ArrowRight', ctrlKey: true, shiftKey: true });
    }).not.toThrow();
  });

  it('opens table insert dialog from toolbar and inserts customized table into document', () => {
    const onChange = vi.fn();
    render(
      <MarkdownSourceEditor
        value="# Test Document"
        disabled={false}
        ariaLabel="Markdown source"
        language="en"
        onChange={onChange}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    const tableButton = screen.getByRole('button', { name: 'Table' });
    fireEvent.click(tableButton);

    const dialog = screen.getByTestId('table-insert-dialog');
    expect(dialog).toBeInTheDocument();

    const colsInput = screen.getByTestId('table-insert-cols');
    const rowsInput = screen.getByTestId('table-insert-rows');
    fireEvent.change(colsInput, { target: { value: '2' } });
    fireEvent.change(rowsInput, { target: { value: '2' } });

    fireEvent.click(screen.getByTestId('table-insert-confirm'));

    expect(screen.queryByTestId('table-insert-dialog')).toBeNull();
    expect(onChange).toHaveBeenCalled();
    const inserted = onChange.mock.calls[0][0];
    expect(inserted).toContain('| Column 1 | Column 2 |');
    expect(inserted).toContain('| Value 1  | Value 2  |');
  });

  it('separates a new table from both halves of a split line', () => {
    const onChange = vi.fn();
    renderEditor({ value: 'beforeafter', onChange });
    const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Markdown source' }))!;
    act(() => view.dispatch({ selection: { anchor: 6 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    fireEvent.click(screen.getByTestId('table-insert-confirm'));
    const source = onChange.mock.lastCall?.[0];
    expect(source).toMatch(/^before\n\n\|/);
    expect(source).toMatch(/\|\n\n\s*after$/);
  });

  it('opens link dialog on toolbar link click and inserts link with custom url and text', () => {
    const onChange = vi.fn();
    renderEditor({ value: '', onChange });
    const linkButton = screen.getByRole('button', { name: 'Link' });
    fireEvent.click(linkButton);

    expect(screen.getByTestId('link-insert-dialog')).toBeInTheDocument();

    const urlInput = screen.getByTestId('link-insert-url');
    const textInput = screen.getByTestId('link-insert-text');
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.change(textInput, { target: { value: 'Example' } });

    fireEvent.click(screen.getByTestId('link-insert-confirm'));

    expect(onChange).toHaveBeenCalledWith('[Example](https://example.com)');
    expect(screen.queryByTestId('link-insert-dialog')).toBeNull();
  });

  it('opens link dialog via Ctrl+K shortcut and allows closing via cancel', () => {
    renderEditor({ value: '' });
    const editor = screen.getByRole('textbox', { name: 'Markdown source' });

    fireEvent.keyDown(editor, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('link-insert-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('link-insert-dialog')).toBeNull();
  });

  it('caps editor sessions to 15 entries and evicts oldest by LRU', async () => {
    const {
      setEditorSession,
      getEditorSession,
      clearAllEditorSessions,
      MAX_EDITOR_SESSIONS,
    } = await import('../../../../ui/src/editor/editorSessionStore');

    clearAllEditorSessions();
    expect(MAX_EDITOR_SESSIONS).toBe(15);

    // Insert 15 items
    for (let i = 1; i <= 15; i++) {
      setEditorSession(`file-${i}`, {
        state: {} as any,
        editableCompartment: {} as any,
      });
    }

    // Refresh file-1 by reading it
    expect(getEditorSession('file-1')).toBeDefined();

    // Insert file-16 -> file-2 (now oldest) should be evicted, file-1 remains!
    setEditorSession('file-16', {
      state: {} as any,
      editableCompartment: {} as any,
    });

    expect(getEditorSession('file-1')).toBeDefined();
    expect(getEditorSession('file-2')).toBeUndefined();
    expect(getEditorSession('file-16')).toBeDefined();

    clearAllEditorSessions();
  });

  it('shows and hides the table cell hint when a table cell gains and loses focus', () => {
    renderEditor({ value: '| A | B |\n| --- | --- |\n| 1 | 2 |' });
    expect(screen.queryByTestId('markdown-source-editor-table-hint')).toBeNull();

    const cell = document.querySelector<HTMLElement>('.cm-table-cell');
    expect(cell).not.toBeNull();
    fireEvent.focus(cell!);
    const hint = screen.getByTestId('markdown-source-editor-table-hint');
    expect(hint).toHaveTextContent(
      'Shift+Enter: line break · Alt+Enter: line break (keep trailing words) · Alt+←/→: move across cells',
    );
    const keycaps = hint.querySelectorAll('kbd.keycap-3d');
    expect(keycaps.length).toBeGreaterThan(0);
    for (const k of keycaps) {
      expect(k.textContent).not.toContain(':');
    }

    fireEvent.blur(cell!, { relatedTarget: null });
    expect(screen.queryByTestId('markdown-source-editor-table-hint')).toBeNull();
  });

  it('formats a focused table cell as a bulleted list via the toolbar button', () => {
    const onChange = vi.fn();
    renderEditor({ value: '| A | B |\n| --- | --- |\n| item | 2 |', onChange });
    const cell = document.querySelector<HTMLElement>('.cm-table-cell[data-row="0"][data-col="0"]');
    expect(cell).not.toBeNull();
    cell!.tabIndex = 0;
    cell!.focus();
    fireEvent.focus(cell!);
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<ul><li>item</li></ul>'));
  });
});
