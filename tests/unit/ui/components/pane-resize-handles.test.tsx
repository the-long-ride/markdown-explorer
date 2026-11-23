import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileHistoryResizeHandle } from '../../../../ui/src/components/History/FileHistoryResizeHandle';
import { useSearchOverlayResize } from '../../../../ui/src/components/Search/useSearchOverlayResize';

function pointer(target: Element | Window, type: string, clientX = 0, button = 0) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button });
  Object.defineProperty(event, 'pointerId', { value: 24 });
  return fireEvent(target, event);
}

function SearchPane({ preview }: { preview: boolean }) {
  const { cardRef, beginResize, style } = useSearchOverlayResize(preview);
  return <div ref={cardRef} data-testid="search-pane" style={style}>
    <div role="separator" aria-label="Workspaces" onPointerDown={(event) => beginResize('workspaces', event)} />
    {preview && <div role="separator" aria-label="Preview" onPointerDown={(event) => beginResize('preview', event)} />}
  </div>;
}

describe('pane resize interactions', () => {
  it('reserves space for results and the visible preview when growing the search workspaces pane', () => {
    const { rerender } = render(<SearchPane preview />);
    const card = screen.getByTestId('search-pane');
    card.getBoundingClientRect = () => new DOMRect(100, 0, 960, 600);
    const handle = screen.getByRole('separator', { name: 'Workspaces' });
    handle.setPointerCapture = vi.fn();
    try {
      expect(pointer(handle, 'pointerdown')).toBe(false);
      expect(handle.setPointerCapture).toHaveBeenCalledWith(24);
      expect(document.body).toHaveClass('is-resizing');
      pointer(window, 'pointermove', 500);
      expect(card.style.getPropertyValue('--search-workspaces-width')).toBe('288px');
      pointer(window, 'pointermove', 120);
      expect(card.style.getPropertyValue('--search-workspaces-width')).toBe('170px');
      pointer(window, 'pointerup');
      expect(document.body).not.toHaveClass('is-resizing');
      pointer(window, 'pointermove', 500);
      expect(card.style.getPropertyValue('--search-workspaces-width')).toBe('170px');

      rerender(<SearchPane preview={false} />);
      pointer(handle, 'pointerdown');
      pointer(window, 'pointermove', 500);
      expect(card.style.getPropertyValue('--search-workspaces-width')).toBe('360px');
      pointer(window, 'pointercancel');
      expect(document.body).not.toHaveClass('is-resizing');
    } finally {
      pointer(window, 'pointercancel');
    }
  });

  it('clamps preview width with the current workspace width and adapts to card remeasurement during the drag', () => {
    render(<SearchPane preview />);
    const card = screen.getByTestId('search-pane');
    const handle = screen.getByRole('separator', { name: 'Preview' });
    card.getBoundingClientRect = () => new DOMRect(100, 0, 1100, 600);
    try {
      pointer(handle, 'pointerdown');
      pointer(window, 'pointermove', 300);
      expect(card.style.getPropertyValue('--search-preview-width')).toBe('568px');
      pointer(window, 'pointermove', 1150);
      expect(card.style.getPropertyValue('--search-preview-width')).toBe('260px');
      card.getBoundingClientRect = () => new DOMRect(100, 0, 980, 600);
      pointer(window, 'pointermove', 300);
      expect(card.style.getPropertyValue('--search-preview-width')).toBe('448px');
    } finally {
      pointer(window, 'pointercancel');
    }
    expect(document.body).not.toHaveClass('is-resizing');
  });

  it('resizes file history only from an active primary pointer and supports keyboard adjustments and reset', () => {
    const onResize = vi.fn();
    const onStep = vi.fn();
    const onReset = vi.fn();
    render(<FileHistoryResizeHandle className="fixture" label="History width" valueNow={214.7} valueMin={180} valueMax={400} onResize={onResize} onStep={onStep} onReset={onReset} />);
    const handle = screen.getByRole('separator', { name: 'History width' });
    expect(handle).toHaveAttribute('aria-valuenow', '215');
    expect(handle).toHaveAttribute('aria-valuemin', '180');
    expect(handle).toHaveAttribute('aria-valuemax', '400');
    handle.setPointerCapture = vi.fn();
    handle.hasPointerCapture = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    handle.releasePointerCapture = vi.fn();
    expect(pointer(handle, 'pointerdown', 130, 2)).toBe(true);
    pointer(handle, 'pointermove', 200);
    expect(onResize).not.toHaveBeenCalled();
    try {
      expect(pointer(handle, 'pointerdown', 130)).toBe(false);
      expect(handle.setPointerCapture).toHaveBeenLastCalledWith(24);
      expect(handle).toHaveClass('is-dragging');
      expect(document.body).toHaveClass('is-file-history-resizing');
      pointer(handle, 'pointermove', 240);
      expect(onResize).toHaveBeenCalledExactlyOnceWith(240);
      pointer(handle, 'pointercancel');
      expect(handle).not.toHaveClass('is-dragging');
      expect(document.body).not.toHaveClass('is-file-history-resizing');
      expect(handle.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(24);
      pointer(handle, 'pointermove', 300);
      expect(onResize).toHaveBeenCalledTimes(1);
      pointer(handle, 'pointerdown', 150);
      pointer(handle, 'pointerup');
      expect(handle.releasePointerCapture).toHaveBeenCalledTimes(1);
    } finally {
      pointer(handle, 'pointercancel');
    }
    expect(fireEvent.keyDown(handle, { key: 'x' })).toBe(true);
    expect(fireEvent.keyDown(handle, { key: 'ArrowLeft' })).toBe(false);
    expect(fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true })).toBe(false);
    expect(onStep.mock.calls).toEqual([[-1], [4]]);
    fireEvent.doubleClick(handle);
    expect(onReset).toHaveBeenCalledOnce();
  });
});
