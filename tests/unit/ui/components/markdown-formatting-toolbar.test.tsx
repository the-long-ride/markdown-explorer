import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownFormattingToolbar } from '../../../../ui/src/components/Content/MarkdownFormattingToolbar';
import type { MarkdownFormatCommand } from '../../../../ui/src/editor/markdownFormatting';

const labels = {
  toolbar: 'Formatting tools',
  bold: 'Bold', italic: 'Italic', underline: 'Underline', heading: 'Heading', quote: 'Quote',
  inlineCode: 'Inline code', codeBlock: 'Code block', link: 'Link',
  bulletList: 'Bulleted list', numberedList: 'Numbered list', taskList: 'Task list',
  table: 'Table', properties: 'Insert properties',
  undo: 'Undo', redo: 'Redo', preview: 'Preview', wrapText: 'Wrap text',
  decreaseFontSize: 'Decrease font size', increaseFontSize: 'Increase font size',
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
    const previewButton = screen.getByRole('button', { name: 'Preview' });
    expect(previewButton).toBeEnabled();
    expect(previewButton.querySelector('svg')).not.toBeNull();
    expect(previewButton).not.toHaveClass('markdown-formatting-toolbar__button--labelled');
    expect(document.querySelector('.markdown-formatting-toolbar__spacer')).toBeNull();

    await user.click(previewButton);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('hides the undo/redo group and Preview button when disabled via props (used by the compact inline-edit toolbar)', () => {
    render(<MarkdownFormattingToolbar actions={createActions()} labels={labels} onPreview={vi.fn()} showUndoRedo={false} showPreview={false} />);

    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Redo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });

  it('shows a viewport-portaled hover tooltip instead of a native title attribute, including when disabled', () => {
    render(
      <MarkdownFormattingToolbar
        actions={{ ...createActions(), canRedo: false }}
        labels={labels}
        onPreview={vi.fn()}
      />,
    );

    const boldButton = screen.getByRole('button', { name: 'Bold' });
    expect(boldButton).not.toHaveAttribute('title');
    expect(boldButton).toHaveClass('tooltip-container');
    fireEvent.mouseEnter(boldButton);
    const boldTooltip = document.body.querySelector('.tooltip-text.tooltip-portal');
    expect(boldTooltip).not.toBeNull();
    expect(boldTooltip?.textContent).toContain('Bold');
    fireEvent.mouseLeave(boldButton);

    const redoButton = screen.getByRole('button', { name: 'Redo' });
    expect(redoButton).toBeDisabled();
    const redoWrap = redoButton.closest('.tooltip-disabled-wrap');
    expect(redoWrap).not.toBeNull();
    fireEvent.mouseEnter(redoWrap!);
    const redoTooltip = document.body.querySelector('.tooltip-text.tooltip-portal');
    expect(redoTooltip).not.toBeNull();
    expect(redoTooltip?.textContent).toContain('Redo');
  });
  it('renders and toggles the wrap text button when onToggleWrapText is provided', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(
      <MarkdownFormattingToolbar
        actions={createActions()}
        labels={labels}
        onPreview={vi.fn()}
        wrapText={true}
        onToggleWrapText={onToggle}
      />,
    );

    const wrapButton = screen.getByRole('button', { name: 'Wrap text' });
    expect(wrapButton).toHaveAttribute('aria-pressed', 'true');
    expect(wrapButton).toHaveClass('markdown-formatting-toolbar__button--active');

    await user.click(wrapButton);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <MarkdownFormattingToolbar
        actions={createActions()}
        labels={labels}
        onPreview={vi.fn()}
        wrapText={false}
        onToggleWrapText={onToggle}
      />,
    );
    expect(screen.getByRole('button', { name: 'Wrap text' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Wrap text' })).not.toHaveClass('markdown-formatting-toolbar__button--active');
  });
  it('dispatches underline command', async () => {
    const user = userEvent.setup();
    const actions = createActions();
    render(<MarkdownFormattingToolbar actions={actions} labels={labels} onPreview={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Underline' }));
    expect(actions.format).toHaveBeenCalledWith('underline');
  });

  it('triggers onOpenLinkDialog when provided, falling back to format link', async () => {
    const user = userEvent.setup();
    const onOpenLinkDialog = vi.fn();
    const actions = createActions();
    const { rerender } = render(
      <MarkdownFormattingToolbar actions={actions} labels={labels} onPreview={vi.fn()} onOpenLinkDialog={onOpenLinkDialog} />,
    );
    await user.click(screen.getByRole('button', { name: 'Link' }));
    expect(onOpenLinkDialog).toHaveBeenCalledTimes(1);
    expect(actions.format).not.toHaveBeenCalled();

    rerender(<MarkdownFormattingToolbar actions={actions} labels={labels} onPreview={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Link' }));
    expect(actions.format).toHaveBeenCalledWith('link');
  });

  it('dispatches properties formatting command when Properties button is clicked', async () => {
    const user = userEvent.setup();
    const actions = createActions();
    render(<MarkdownFormattingToolbar actions={actions} labels={labels} onPreview={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Insert properties' }));
    expect(actions.format).toHaveBeenCalledWith('properties');
  });

  it('renders font size adjustment controls and handles size changes', async () => {
    const user = userEvent.setup();
    const onChangeFontSize = vi.fn();
    const actions = createActions();
    const { rerender } = render(
      <MarkdownFormattingToolbar
        actions={actions}
        labels={labels}
        fontSize={14}
        onChangeFontSize={onChangeFontSize}
        onPreview={vi.fn()}
      />,
    );

    expect(screen.getByTestId('editor-font-size-input')).toHaveValue('14');
    await user.click(screen.getByRole('button', { name: 'Increase font size' }));
    expect(onChangeFontSize).toHaveBeenCalledWith(15);

    await user.click(screen.getByRole('button', { name: 'Decrease font size' }));
    expect(onChangeFontSize).toHaveBeenCalledWith(13);

    // Disabled at boundaries 8 and 32
    rerender(
      <MarkdownFormattingToolbar
        actions={actions}
        labels={labels}
        fontSize={8}
        onChangeFontSize={onChangeFontSize}
        onPreview={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Decrease font size' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase font size' })).toBeEnabled();

    rerender(
      <MarkdownFormattingToolbar
        actions={actions}
        labels={labels}
        fontSize={32}
        onChangeFontSize={onChangeFontSize}
        onPreview={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Increase font size' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease font size' })).toBeEnabled();

    // Shortcuts displayed on buttons
    expect(screen.getByRole('button', { name: 'Decrease font size' })).toHaveAttribute('aria-keyshortcuts', 'Ctrl+-');
    expect(screen.getByRole('button', { name: 'Increase font size' })).toHaveAttribute('aria-keyshortcuts', 'Ctrl+=');
  });

  it('allows direct font size input with clamping and arrow keyboard adjustment', async () => {
    const user = userEvent.setup();
    const onChangeFontSize = vi.fn();
    const actions = createActions();
    const { rerender } = render(
      <MarkdownFormattingToolbar
        actions={actions}
        labels={labels}
        fontSize={14}
        onChangeFontSize={onChangeFontSize}
        onPreview={vi.fn()}
      />,
    );

    const input = screen.getByTestId('editor-font-size-input');
    expect(input).toHaveValue('14');

    // Type a valid number
    await user.clear(input);
    await user.type(input, '18');
    expect(onChangeFontSize).toHaveBeenCalledWith(18);

    // ArrowUp increments
    await user.keyboard('{ArrowUp}');
    expect(onChangeFontSize).toHaveBeenCalledWith(15);

    // ArrowDown decrements
    await user.keyboard('{ArrowDown}');
    expect(onChangeFontSize).toHaveBeenCalledWith(13);

    // Enter clamps value on blur/enter
    await user.clear(input);
    await user.type(input, '99{Enter}');
    expect(onChangeFontSize).toHaveBeenCalledWith(32);

    await user.clear(input);
    await user.type(input, '2{Enter}');
    expect(onChangeFontSize).toHaveBeenCalledWith(8);
  });
});
