import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LinkContextMenu } from '../../../../ui/src/components/shared/LinkContextMenu';

describe('LinkContextMenu', () => {
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
