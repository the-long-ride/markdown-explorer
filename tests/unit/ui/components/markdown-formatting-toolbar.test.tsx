import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownFormattingToolbar } from '../../../../ui/src/components/Content/MarkdownFormattingToolbar';
import type { MarkdownFormatCommand } from '../../../../ui/src/editor/markdownFormatting';

const labels = {
  toolbar: 'Formatting tools',
  bold: 'Bold', italic: 'Italic', heading: 'Heading', quote: 'Quote',
  inlineCode: 'Inline code', codeBlock: 'Code block', link: 'Link',
  bulletList: 'Bulleted list', numberedList: 'Numbered list', taskList: 'Task list',
  table: 'Table', undo: 'Undo', redo: 'Redo', preview: 'Preview',
};

function createActions() {
  return {
    format: vi.fn<(command: MarkdownFormatCommand) => void>(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: true,
  };
}

describe('MarkdownFormattingToolbar', () => {
  it('uses the translated toolbar label and dispatches formatting commands', async () => {
    const user = userEvent.setup();
    const actions = createActions();
    render(<MarkdownFormattingToolbar actions={actions} labels={labels} onPreview={vi.fn()} />);

    expect(screen.getByRole('toolbar', { name: 'Formatting tools' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    await user.click(screen.getByRole('button', { name: 'Heading 3' }));
    await user.click(screen.getByRole('button', { name: 'Task list' }));

    expect(actions.format).toHaveBeenNthCalledWith(1, 'bold');
    expect(actions.format).toHaveBeenNthCalledWith(2, 'heading-3');
    expect(actions.format).toHaveBeenNthCalledWith(3, 'task-list');
  });

  it('honors undo/redo availability and keeps Preview available in read-only mode', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const actions = { ...createActions(), canUndo: false, canRedo: false };
    render(<MarkdownFormattingToolbar actions={actions} labels={labels} disabled onPreview={onPreview} />);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(onPreview).toHaveBeenCalledTimes(1);
  });
});
