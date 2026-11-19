import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { InlineMarkdownEditor } from '../../../../ui/src/components/Content/InlineMarkdownEditor';

const formatting = {
  toolbar: 'Formatting tools',
  bold: 'Bold', italic: 'Italic', underline: 'Underline', heading: 'Heading', quote: 'Quote',
  inlineCode: 'Inline code', codeBlock: 'Code block', link: 'Link',
  bulletList: 'Bulleted list', numberedList: 'Numbered list', taskList: 'Task list',
  table: 'Table', undo: 'Undo', redo: 'Redo', preview: 'Preview', wrapText: 'Wrap text',
};

const labels = {
  sourceLabel: 'Markdown source block',
  apply: 'Apply',
  cancel: 'Cancel',
  toggleToolbar: 'Toggle formatting toolbar',
  formatting,
};

function createTarget() {
  const target = document.createElement('p');
  target.setAttribute('data-mdn-source-start', '5');
  target.setAttribute('data-mdn-source-end', '9');
  target.textContent = 'Text';
  document.body.appendChild(target);
  return target;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('InlineMarkdownEditor', () => {
  it('edits the exact source slice and applies without saving to disk', () => {
    const target = createTarget();
    const onApply = vi.fn();
    const onCancel = vi.fn();

    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={labels}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );

    const editor = screen.getByRole('textbox', { name: labels.sourceLabel });
    expect(editor).toHaveValue('Text');
    expect(target).toHaveClass('is-inline-editing');

    fireEvent.change(editor, { target: { value: 'Next' } });
    fireEvent.click(screen.getByRole('button', { name: labels.apply }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith('Next', { start: 5, end: 9 });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels without applying the draft', () => {
    const target = createTarget();
    const onApply = vi.fn();
    const onCancel = vi.fn();

    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={labels}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: labels.sourceLabel }), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: labels.cancel }));

    expect(onApply).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when the selected DOM range is stale', () => {
    const target = document.createElement('p');
    target.setAttribute('data-mdn-source-start', '5');
    target.setAttribute('data-mdn-source-end', '99');
    document.body.appendChild(target);

    const { container } = render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText'}
        labels={labels}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('textarea')).toBeNull();
    expect(target).not.toHaveClass('is-inline-editing');
  });

  it('replaces the rendered block with a focused editor card', () => {
    const target = createTarget();
    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={{ ...labels, hint: 'Ctrl+Enter to apply' }}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const editor = screen.getByRole('textbox', { name: labels.sourceLabel });
    expect(target.nextElementSibling).toHaveClass('markdown-inline-editor-host');
    expect(target.nextElementSibling).toContainElement(editor);
    expect(editor).toHaveFocus();
    expect(document.querySelector('.markdown-inline-editor__footer')).toBeNull();
  });

  it('applies with Mod+Enter, cancels with Escape and skips unchanged applies', () => {
    const target = createTarget();
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<InlineMarkdownEditor target={target} source={'# A\n\nText\nEnd'} labels={labels} onApply={onApply} onCancel={onCancel} />);
    const editor = screen.getByRole('textbox', { name: labels.sourceLabel });

    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });
    expect(onApply).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.change(editor, { target: { value: 'Next' } });
    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true });
    expect(onApply).toHaveBeenCalledWith('Next', { start: 5, end: 9 });

    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('applies the draft and requests a save on Ctrl+S / Cmd+S, and always prevents the browser save dialog', () => {
    const target = createTarget();
    const onApply = vi.fn();
    const onCancel = vi.fn();
    const onSaveShortcut = vi.fn();
    render(<InlineMarkdownEditor target={target} source={'# A\n\nText\nEnd'} labels={labels} onApply={onApply} onCancel={onCancel} onSaveShortcut={onSaveShortcut} />);
    const editor = screen.getByRole('textbox', { name: labels.sourceLabel });

    fireEvent.change(editor, { target: { value: 'Next' } });
    const event = fireEvent.keyDown(editor, { key: 's', ctrlKey: true, cancelable: true });
    expect(event).toBe(false);
    expect(onApply).toHaveBeenCalledWith('Next', { start: 5, end: 9 });
    expect(onSaveShortcut).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(editor, { key: 's', metaKey: true, cancelable: true });
    expect(onSaveShortcut).toHaveBeenCalledTimes(2);
  });

  it('formats the selection with Mod+B inside the block editor', () => {
    const target = createTarget();
    render(<InlineMarkdownEditor target={target} source={'# A\n\nText\nEnd'} labels={labels} onApply={vi.fn()} onCancel={vi.fn()} />);
    const editor = screen.getByRole('textbox', { name: labels.sourceLabel }) as HTMLTextAreaElement;

    editor.setSelectionRange(0, 4);
    fireEvent.keyDown(editor, { key: 'b', ctrlKey: true });
    expect(editor).toHaveValue('**Text**');
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 6]);
  });

  it('shows a compact formatting toolbar that can be toggled off with a switch, and formats the draft', () => {
    const target = createTarget();
    render(<InlineMarkdownEditor target={target} source={'# A\n\nText\nEnd'} labels={labels} onApply={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('toolbar', { name: formatting.toolbar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: formatting.undo })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: formatting.redo })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: formatting.preview })).not.toBeInTheDocument();

    const editor = screen.getByRole('textbox', { name: labels.sourceLabel }) as HTMLTextAreaElement;
    editor.setSelectionRange(0, 4);
    fireEvent.click(screen.getByRole('button', { name: formatting.bold }));
    expect(editor).toHaveValue('**Text**');

    const toggle = screen.getByRole('switch', { name: labels.toggleToolbar });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveClass('tooltip-container');
    expect(toggle).toHaveAttribute('data-tooltip-pos', 'below');
    expect(toggle).toHaveAttribute('data-tooltip-align', 'right');
    expect(toggle.querySelector('.tooltip-text')).toHaveTextContent(labels.toggleToolbar);
    expect(toggle).not.toHaveAttribute('title');
    fireEvent.click(toggle);
    expect(screen.queryByRole('toolbar', { name: formatting.toolbar })).not.toBeInTheDocument();
  });

  it('uses icon buttons with tooltips instead of visible text for Cancel/Apply located in header', () => {
    const target = createTarget();
    render(<InlineMarkdownEditor target={target} source={'# A\n\nText\nEnd'} labels={labels} onApply={vi.fn()} onCancel={vi.fn()} />);

    const cancelButton = screen.getByRole('button', { name: labels.cancel });
    const applyButton = screen.getByRole('button', { name: labels.apply });
    expect(cancelButton).not.toHaveAttribute('title');
    expect(applyButton).not.toHaveAttribute('title');
    expect(cancelButton.querySelector('svg')).not.toBeNull();
    expect(applyButton.querySelector('svg')).not.toBeNull();

    const header = document.querySelector('.markdown-inline-editor__header');
    expect(header).toContainElement(cancelButton);
    expect(header).toContainElement(applyButton);
    expect(cancelButton.querySelector('.tooltip-text')).toHaveTextContent('Esc');
    expect(applyButton.querySelector('.tooltip-text')).toHaveTextContent('Enter');
  });

  it('hides a whole heading while its text is edited', () => {
    const heading = document.createElement('h2');
    const text = document.createElement('span');
    text.className = 'mdn-heading-text';
    text.setAttribute('data-mdn-source-start', '0');
    text.setAttribute('data-mdn-source-end', '4');
    heading.appendChild(text);
    document.body.appendChild(heading);

    const { unmount } = render(<InlineMarkdownEditor target={text} source="## A" labels={labels} onApply={vi.fn()} onCancel={vi.fn()} />);
    expect(heading).toHaveClass('is-inline-editing-anchor');
    expect(heading.nextElementSibling).toHaveClass('markdown-inline-editor-host');
    expect(screen.getByRole('textbox', { name: labels.sourceLabel })).toHaveValue('## A');

    unmount();
    expect(heading).not.toHaveClass('is-inline-editing-anchor');
    expect(document.querySelector('.markdown-inline-editor-host')).toBeNull();
  });
  it('toggles word wrap on the textarea when clicking the wrap button in the formatting toolbar', () => {
    const target = createTarget();
    render(
      <InlineMarkdownEditor
        target={target}
        source={'# Heading\n\nLong line text'}
        labels={labels}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const textarea = screen.getByRole('textbox', { name: labels.sourceLabel });
    expect(textarea).toHaveAttribute('wrap', 'soft');

    const wrapButton = screen.getByRole('button', { name: labels.formatting.wrapText });
    expect(wrapButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(wrapButton);
    expect(textarea).toHaveAttribute('wrap', 'off');
    expect(wrapButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(wrapButton);
    expect(textarea).toHaveAttribute('wrap', 'soft');
    expect(wrapButton).toHaveAttribute('aria-pressed', 'true');
  });
  it('renders visual table widget when editing a table block in inline edit mode', () => {
    const sampleTable = ['| Header 1 | Header 2 |', '| --- | --- |', '| Cell 1 | Cell 2 |'].join('\n');
    const target = document.createElement('div');
    target.className = 'mdn-table-source';
    target.setAttribute('data-mdn-source-start', '0');
    target.setAttribute('data-mdn-source-end', String(sampleTable.length));
    document.body.appendChild(target);

    render(
      <InlineMarkdownEditor
        target={target}
        source={sampleTable}
        labels={labels}
        language="en"
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(document.querySelector('textarea')).toBeNull();
    const widget = document.querySelector('[data-testid="cm-table-widget"]');
    expect(widget).not.toBeNull();

    const headers = document.querySelectorAll('.cm-table-cell--header');
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent('Header 1');
    expect(headers[1]).toHaveTextContent('Header 2');

    const cells = document.querySelectorAll('tbody .cm-table-cell');
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveTextContent('Cell 1');
    expect(cells[1]).toHaveTextContent('Cell 2');

    const info = document.querySelector('.cm-table-widget__info');
    expect(info).toHaveTextContent('Row 1 × 2 Columns');
  });

  it('updates cell content in visual table and applies changes', () => {
    const sampleTable = ['| Header 1 | Header 2 |', '| --- | --- |', '| Cell 1 | Cell 2 |'].join('\n');
    const target = document.createElement('div');
    target.className = 'mdn-table-source';
    target.setAttribute('data-mdn-source-start', '0');
    target.setAttribute('data-mdn-source-end', String(sampleTable.length));
    document.body.appendChild(target);

    const onApply = vi.fn();
    render(
      <InlineMarkdownEditor
        target={target}
        source={sampleTable}
        labels={labels}
        language="en"
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );

    const cell = document.querySelector('tbody .cm-table-cell');
    cell.textContent = 'Modified Cell';
    cell.dispatchEvent(new Event('blur'));

    fireEvent.click(screen.getByRole('button', { name: labels.apply }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toContain('Modified Cell');
  });

  it('toggles raw markdown view and back in inline table editor', () => {
    const sampleTable = ['| Header 1 | Header 2 |', '| --- | --- |', '| Cell 1 | Cell 2 |'].join('\n');
    const target = document.createElement('div');
    target.className = 'mdn-table-source';
    target.setAttribute('data-mdn-source-start', '0');
    target.setAttribute('data-mdn-source-end', String(sampleTable.length));
    document.body.appendChild(target);

    render(
      <InlineMarkdownEditor
        target={target}
        source={sampleTable}
        labels={labels}
        language="en"
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const toggleBtn = document.querySelector('.cm-table-widget__toggle-btn');
    expect(toggleBtn).not.toBeNull();
    fireEvent.click(toggleBtn);

    const banner = document.querySelector('.cm-raw-table-banner');
    expect(banner).not.toBeNull();

    const bannerBtn = banner.querySelector('button');
    expect(bannerBtn).not.toBeNull();
    fireEvent.click(bannerBtn);

    expect(document.querySelector('[data-testid="cm-table-widget"]')).not.toBeNull();
  });

  it('opens link modal on toolbar link button click and applies link format', () => {
    const target = createTarget();
    const onApply = vi.fn();
    const onCancel = vi.fn();

    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={labels}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );

    const linkBtn = screen.getByRole('button', { name: 'Link' });
    fireEvent.click(linkBtn);

    expect(screen.getByTestId('link-insert-dialog')).toBeInTheDocument();

    const urlInput = screen.getByTestId('link-insert-url');
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });

    fireEvent.click(screen.getByTestId('link-insert-confirm'));

    expect(screen.queryByTestId('link-insert-dialog')).toBeNull();
    const textarea = screen.getByRole('textbox', { name: labels.sourceLabel }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Text[https://example.com](https://example.com)');
  });

  it('opens link modal via Ctrl+K in textarea with selected text as label', () => {
    const target = createTarget();
    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={labels}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const textarea = screen.getByRole('textbox', { name: labels.sourceLabel }) as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 4);

    fireEvent.keyDown(textarea, { key: 'k', ctrlKey: true });

    expect(screen.getByTestId('link-insert-dialog')).toBeInTheDocument();
    const textInput = screen.getByTestId('link-insert-text') as HTMLInputElement;
    expect(textInput.value).toBe('Text');

    const urlInput = screen.getByTestId('link-insert-url');
    fireEvent.change(urlInput, { target: { value: 'https://mysite.com' } });

    fireEvent.click(screen.getByTestId('link-insert-confirm'));

    expect(textarea.value).toBe('[Text](https://mysite.com)');
  });

  it('adjusts editor font size via keyboard shortcuts Ctrl+= and Ctrl+- and updates data-editor-font-size attribute', () => {
    const target = createTarget();
    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={labels}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const textarea = screen.getByRole('textbox', { name: labels.sourceLabel }) as HTMLTextAreaElement;
    const editorCard = document.querySelector('.markdown-inline-editor');
    expect(editorCard).toHaveAttribute('data-editor-font-size', '14');

    fireEvent.keyDown(textarea, { key: '=', ctrlKey: true });
    expect(editorCard).toHaveAttribute('data-editor-font-size', '15');

    fireEvent.keyDown(textarea, { key: '-', ctrlKey: true });
    expect(editorCard).toHaveAttribute('data-editor-font-size', '14');

    const fontInput = screen.getByRole('textbox', { name: 'Font size' });
    fireEvent.change(fontInput, { target: { value: '20' } });
    fireEvent.blur(fontInput);
    expect(editorCard).toHaveAttribute('data-editor-font-size', '20');
  });

  it('triggers immediate EditorView.requestMeasure when adjusting font size in inline table editor', () => {
    const requestMeasureSpy = vi.spyOn(EditorView.prototype, 'requestMeasure');
    const sampleTable = ['| Header 1 | Header 2 |', '| --- | --- |', '| Cell 1 | Cell 2 |'].join('\n');
    const target = document.createElement('div');
    target.className = 'mdn-table-source';
    target.setAttribute('data-mdn-source-start', '0');
    target.setAttribute('data-mdn-source-end', String(sampleTable.length));
    document.body.appendChild(target);

    render(
      <InlineMarkdownEditor
        target={target}
        source={sampleTable}
        labels={labels}
        language="en"
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(requestMeasureSpy).toHaveBeenCalled();
    requestMeasureSpy.mockClear();

    const increaseBtn = screen.getByRole('button', { name: 'Increase font size' });
    fireEvent.click(increaseBtn);
    expect(requestMeasureSpy).toHaveBeenCalled();

    requestMeasureSpy.mockRestore();
    target.remove();
  });

  it('supports selecting multiple table cells and clearing them with Delete key before applying', () => {
    const sampleTable = [
      '| Header 1 | Header 2 |',
      '| --- | --- |',
      '| Cell A | Cell B |',
    ].join('\n');
    const target = document.createElement('div');
    target.className = 'mdn-table-source';
    target.setAttribute('data-mdn-source-start', '0');
    target.setAttribute('data-mdn-source-end', String(sampleTable.length));
    document.body.appendChild(target);

    const onApply = vi.fn();
    render(
      <InlineMarkdownEditor
        target={target}
        source={sampleTable}
        labels={labels}
        language="en"
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );

    const cellA = document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
    const cellB = document.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')!;
    expect(cellA).toBeDefined();
    expect(cellB).toBeDefined();

    // Select both cells via Shift+Click
    cellA.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    cellB.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));

    expect(cellA.classList.contains('is-multi-selected')).toBe(true);
    expect(cellB.classList.contains('is-multi-selected')).toBe(true);

    // Press Delete to clear both cells
    cellB.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    // Apply changes
    fireEvent.click(screen.getByRole('button', { name: labels.apply }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const appliedSource = onApply.mock.calls[0][0];
    expect(appliedSource).toContain('Header 1');
    expect(appliedSource).toContain('Header 2');
    expect(appliedSource).not.toContain('Cell A');
    expect(appliedSource).not.toContain('Cell B');

    target.remove();
  });

  it('supports undo and redo in textarea mode via toolbar buttons', () => {
    const target = createTarget();
    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={labels}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const undoBtn = screen.getByRole('button', { name: formatting.undo });
    const redoBtn = screen.getByRole('button', { name: formatting.redo });
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();

    const editor = screen.getByRole('textbox', { name: labels.sourceLabel }) as HTMLTextAreaElement;
    editor.setSelectionRange(0, 4);
    fireEvent.click(screen.getByRole('button', { name: formatting.bold }));
    expect(editor).toHaveValue('**Text**');
    expect(undoBtn).toBeEnabled();
    expect(redoBtn).toBeDisabled();

    fireEvent.click(undoBtn);
    expect(editor).toHaveValue('Text');
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeEnabled();

    fireEvent.click(redoBtn);
    expect(editor).toHaveValue('**Text**');
    expect(undoBtn).toBeEnabled();
    expect(redoBtn).toBeDisabled();
  });

  it('supports undo and redo in textarea mode via keyboard shortcuts', () => {
    const target = createTarget();
    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={labels}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const editor = screen.getByRole('textbox', { name: labels.sourceLabel }) as HTMLTextAreaElement;
    editor.setSelectionRange(0, 4);
    fireEvent.click(screen.getByRole('button', { name: formatting.italic }));
    expect(editor).toHaveValue('*Text*');

    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    expect(editor).toHaveValue('Text');

    fireEvent.keyDown(editor, { key: 'y', ctrlKey: true });
    expect(editor).toHaveValue('*Text*');
  });

  it('supports undo and redo in table mode via toolbar buttons', () => {
    const sampleTable = [
      '| Header 1 | Header 2 |',
      '| --- | --- |',
      '| Cell A | Cell B |',
    ].join('\n');
    const target = document.createElement('div');
    target.className = 'mdn-table-source';
    target.setAttribute('data-mdn-source-start', '0');
    target.setAttribute('data-mdn-source-end', String(sampleTable.length));
    document.body.appendChild(target);

    render(
      <InlineMarkdownEditor
        target={target}
        source={sampleTable}
        labels={labels}
        language="en"
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const undoBtn = screen.getByRole('button', { name: formatting.undo });
    const redoBtn = screen.getByRole('button', { name: formatting.redo });
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();

    const cellA = document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
    const cellB = document.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')!;

    cellA.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    cellB.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));

    // Clear cells with Delete
    fireEvent.keyDown(cellB, { key: 'Delete' });

    expect(cellA.textContent).toBe('');
    expect(cellB.textContent).toBe('');
    expect(undoBtn).toBeEnabled();

    // Undo via toolbar button
    fireEvent.click(undoBtn);
    const restoredA = document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
    const restoredB = document.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')!;
    expect(restoredA.textContent).toBe('Cell A');
    expect(restoredB.textContent).toBe('Cell B');
    expect(redoBtn).toBeEnabled();

    // Redo via toolbar button
    fireEvent.click(redoBtn);
    const redoneA = document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
    const redoneB = document.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')!;
    expect(redoneA.textContent).toBe('');
    expect(redoneB.textContent).toBe('');

    target.remove();
  });

  it('supports undo and redo via keyboard shortcuts inside .cm-table-widget', () => {
    const sampleTable = [
      '| Header 1 | Header 2 |',
      '| --- | --- |',
      '| Cell A | Cell B |',
    ].join('\n');
    const target = document.createElement('div');
    target.className = 'mdn-table-source';
    target.setAttribute('data-mdn-source-start', '0');
    target.setAttribute('data-mdn-source-end', String(sampleTable.length));
    document.body.appendChild(target);

    render(
      <InlineMarkdownEditor
        target={target}
        source={sampleTable}
        labels={labels}
        language="en"
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const cellA = document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
    const cellB = document.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')!;

    cellA.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    cellB.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));

    cellB.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(cellA.textContent).toBe('');
    expect(cellB.textContent).toBe('');

    // Press Ctrl+Z inside table widget to undo
    cellB.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    const restoredA = document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
    const restoredB = document.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')!;
    expect(restoredA.textContent).toBe('Cell A');
    expect(restoredB.textContent).toBe('Cell B');

    // Press Ctrl+Y inside table widget to redo
    restoredB.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    const redoneA = document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
    const redoneB = document.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')!;
    expect(redoneA.textContent).toBe('');
    expect(redoneB.textContent).toBe('');

    // Press Ctrl+Z to undo, then Ctrl+Shift+Z to redo
    redoneB.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!.textContent).toBe('Cell A');

    const cellAfterUndo = document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
    cellAfterUndo.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }));
    expect(document.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!.textContent).toBe('');

    target.remove();
  });
});
