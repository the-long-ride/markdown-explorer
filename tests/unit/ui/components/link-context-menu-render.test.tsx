import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LinkContextMenu } from '../../../../ui/src/components/shared/LinkContextMenu';

describe('LinkContextMenu', () => {
  it('loops through enabled actions by keyboard and restores focus to the trigger on close', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const onClose = vi.fn();
    try {
      const { unmount } = render(<LinkContextMenu
        state={{ x: 10, y: 20, anchor, imageTarget: document.createElement('img') }}
        menuLabel="Image actions"
        openLabel="Open"
        copyLabel="Copy link"
        copyImageLabel="Copy image"
        saveImageLabel="Save image"
        onCopyImage={vi.fn()}
        onSaveImage={vi.fn()}
        onBookmark={vi.fn()}
        bookmarkLabel="Bookmark image"
        onClose={onClose}
      />);
      const first = screen.getByRole('menuitem', { name: 'Copy image' });
      const last = screen.getByRole('menuitem', { name: 'Bookmark image' });
      expect(first).toHaveFocus();
      fireEvent.pointerDown(first);
      fireEvent.keyDown(first, { key: 'a' });
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.keyDown(first, { key: 'ArrowUp' });
      expect(last).toHaveFocus();
      fireEvent.keyDown(last, { key: 'ArrowDown' });
      expect(first).toHaveFocus();
      fireEvent.keyDown(first, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
      fireEvent.resize(window);
      expect(onClose).toHaveBeenCalledTimes(2);
      unmount();
      expect(anchor).toHaveFocus();
    } finally {
      anchor.remove();
    }
  });

  it('renders copy and save image options when imageTarget is present', () => {
    const onCopyImage = vi.fn();
    const onSaveImage = vi.fn();
    const onClose = vi.fn();
    const imageEl = document.createElement('img');

    render(
      <LinkContextMenu
        state={{
          x: 100,
          y: 200,
          imageTarget: imageEl,
        }}
        menuLabel="Image actions"
        openLabel="Open in browser"
        copyLabel="Copy link"
        copyImageLabel="Copy image to clipboard"
        saveImageLabel="Save as image (.PNG)"
        onCopyImage={onCopyImage}
        onSaveImage={onSaveImage}
        onClose={onClose}
      />
    );

    const copyBtn = screen.getByRole('menuitem', { name: /Copy image to clipboard/i });
    const saveBtn = screen.getByRole('menuitem', { name: /Save as image \(\.PNG\)/i });

    expect(copyBtn).toBeInTheDocument();
    expect(saveBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);
    expect(onCopyImage).toHaveBeenCalledWith(imageEl);

    fireEvent.click(saveBtn);
    expect(onSaveImage).toHaveBeenCalledWith(imageEl);
  });
});
