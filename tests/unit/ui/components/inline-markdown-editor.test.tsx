import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineMarkdownEditor } from '../../../../ui/src/components/Content/InlineMarkdownEditor';

const formatting = {
  toolbar: 'Formatting tools',
  bold: 'Bold', italic: 'Italic', heading: 'Heading', quote: 'Quote',
  inlineCode: 'Inline code', codeBlock: 'Code block', link: 'Link',
  bulletList: 'Bulleted list', numberedList: 'Numbered list', taskList: 'Task list',
  table: 'Table', undo: 'Undo', redo: 'Redo', preview: 'Preview',
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

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Changed' } });
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
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
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
    const editor = screen.getByRole('textbox');

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
    const editor = screen.getByRole('textbox');

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
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;

    editor.setSelectionRange(0, 4);
    fireEvent.keyDown(editor, { key: 'b', ctrlKey: true });
    expect(editor).toHaveValue('**Text**');
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 6]);
  });

  it('shows a compact formatting toolbar that can be toggled off with a switch, and formats the draft', () => {
    const target = createTarget();
    render(<InlineMarkdownEditor target={target} source={'# A\n\nText\nEnd'} labels={labels} onApply={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('toolbar', { name: formatting.toolbar })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: formatting.undo })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: formatting.preview })).not.toBeInTheDocument();

    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;
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
    expect(screen.getByRole('textbox')).toHaveValue('## A');

    unmount();
    expect(heading).not.toHaveClass('is-inline-editing-anchor');
    expect(document.querySelector('.markdown-inline-editor-host')).toBeNull();
  });
});
