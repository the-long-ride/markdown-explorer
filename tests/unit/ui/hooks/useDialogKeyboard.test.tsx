import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDialogKeyboard } from '../../../../ui/src/hooks/useDialogKeyboard';

describe('useDialogKeyboard', () => {
  it('triggers secondary on Escape with preventDefault and stopPropagation', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderHook(() => useDialogKeyboard({ onCancel, onConfirm }));

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    const stopSpy = vi.spyOn(event, 'stopPropagation');

    document.dispatchEvent(event);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(preventSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
  });

  it('triggers primary on Enter when not composing or holding shift', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderHook(() => useDialogKeyboard({ onCancel, onConfirm }));

    // Plain Enter
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Shift+Enter should be ignored
    fireEvent.keyDown(document, { key: 'Enter', shiftKey: true });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Ctrl+Enter should be ignored
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // isComposing should be ignored
    fireEvent.keyDown(document, { key: 'Enter', isComposing: true });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not trigger primary when disabled is true', () => {
    const onConfirm = vi.fn();
    renderHook(() => useDialogKeyboard({ onConfirm, disabled: true }));

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not trigger primary when focus is on a textarea', () => {
    const onConfirm = vi.fn();
    function TestComponent() {
      useDialogKeyboard({ onConfirm });
      return <textarea data-testid="test-textarea" />;
    }
    render(<TestComponent />);
    const textarea = screen.getByTestId('test-textarea');
    textarea.focus();

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not trigger primary when focus is on cancelRef or cancel selector', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    function TestComponent() {
      const cancelRef = useRef<HTMLButtonElement>(null);
      const primaryRef = useRef<HTMLButtonElement>(null);
      useDialogKeyboard({ onCancel, onConfirm, cancelRef, primaryRef });
      return (
        <div>
          <button ref={cancelRef} type="button" onClick={onCancel}>Cancel</button>
          <button ref={primaryRef} type="button" onClick={onConfirm}>Confirm</button>
        </div>
      );
    }

    render(<TestComponent />);
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    cancelBtn.focus();

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    confirmBtn.focus();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does nothing when open is false and cleans up on unmount', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { unmount } = renderHook(() => useDialogKeyboard({ open: false, onCancel, onConfirm }));

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
