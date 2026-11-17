import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinkInsertDialog } from '../../../../ui/src/components/Content/LinkInsertDialog';

describe('LinkInsertDialog', () => {
  it('does not render when open is false', () => {
    render(<LinkInsertDialog open={false} language="en" onInsert={() => {}} onClose={() => {}} />);
    expect(screen.queryByTestId('link-insert-dialog')).toBeNull();
  });

  it('renders default empty values and submits entered url and text', () => {
    const handleInsert = vi.fn();
    const handleClose = vi.fn();

    render(
      <LinkInsertDialog
        open={true}
        language="en"
        onInsert={handleInsert}
        onClose={handleClose}
      />,
    );

    const urlInput = screen.getByTestId('link-insert-url') as HTMLInputElement;
    const textInput = screen.getByTestId('link-insert-text') as HTMLInputElement;

    expect(urlInput.value).toBe('');
    expect(textInput.value).toBe('');

    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.change(textInput, { target: { value: 'Example Site' } });

    fireEvent.click(screen.getByTestId('link-insert-confirm'));

    expect(handleInsert).toHaveBeenCalledWith('https://example.com', 'Example Site');
    expect(handleClose).toHaveBeenCalled();
  });

  it('initializes with initialText and initialUrl', () => {
    const handleInsert = vi.fn();
    const handleClose = vi.fn();

    render(
      <LinkInsertDialog
        open={true}
        language="en"
        initialUrl="https://docs.github.com"
        initialText="Documentation"
        onInsert={handleInsert}
        onClose={handleClose}
      />,
    );

    const urlInput = screen.getByTestId('link-insert-url') as HTMLInputElement;
    const textInput = screen.getByTestId('link-insert-text') as HTMLInputElement;

    expect(urlInput.value).toBe('https://docs.github.com');
    expect(textInput.value).toBe('Documentation');

    fireEvent.click(screen.getByTestId('link-insert-confirm'));
    expect(handleInsert).toHaveBeenCalledWith('https://docs.github.com', 'Documentation');
    expect(handleClose).toHaveBeenCalled();
  });

  it('closes on Escape key press or backdrop click', () => {
    const handleClose = vi.fn();

    render(
      <LinkInsertDialog
        open={true}
        language="en"
        onInsert={() => {}}
        onClose={handleClose}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);

    const backdrop = screen.getByTestId('link-insert-dialog-backdrop');
    fireEvent.mouseDown(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('triggers primary insert action on Enter key press', () => {
    const handleInsert = vi.fn();
    const handleClose = vi.fn();

    render(
      <LinkInsertDialog
        open={true}
        language="en"
        initialUrl="https://github.com"
        initialText="GitHub"
        onInsert={handleInsert}
        onClose={handleClose}
      />,
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(handleInsert).toHaveBeenCalledWith('https://github.com', 'GitHub');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('reads clipboard content when paste button is clicked', async () => {
    const originalClipboard = navigator.clipboard;
    const readTextMock = vi.fn().mockResolvedValue('  https://vitejs.dev  ');
    Object.assign(navigator, {
      clipboard: {
        readText: readTextMock,
      },
    });

    render(
      <LinkInsertDialog
        open={true}
        language="en"
        onInsert={() => {}}
        onClose={() => {}}
      />,
    );

    const pasteBtn = screen.getByTestId('link-insert-paste');
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      const urlInput = screen.getByTestId('link-insert-url') as HTMLInputElement;
      expect(urlInput.value).toBe('https://vitejs.dev');
    });

    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it('supports localized labels', () => {
    render(
      <LinkInsertDialog
        open={true}
        language="vi"
        onInsert={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('Chèn liên kết')).toBeInTheDocument();
    expect(screen.getByText('Văn bản liên kết')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dán từ bảng tạm' })).toBeInTheDocument();
  });
});
