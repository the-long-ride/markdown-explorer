import { useEffect, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

export interface UseDialogKeyboardOptions {
  /** Whether the dialog is open and listening. Defaults to true. */
  open?: boolean;
  /** Secondary action invoked on Escape (e.g. cancel, close). */
  onClose?: () => void;
  onCancel?: () => void;
  onSecondary?: () => void;
  /** Primary action invoked on Enter (e.g. confirm, save, primary). */
  onConfirm?: () => void;
  onSave?: () => void;
  onPrimary?: () => void;
  /** Whether the primary action is disabled. */
  disabled?: boolean;
  /** Reference to the secondary/cancel button or element. */
  cancelRef?: RefObject<HTMLElement | null>;
  /** Reference to the primary action button. */
  primaryRef?: RefObject<HTMLElement | null>;
  /** CSS selector identifying cancel/secondary controls. */
  cancelSelector?: string;
  /** Predicate identifying cancel/secondary controls. */
  isCancelElement?: (element: HTMLElement) => boolean;
  /** Whether to capture keydown in the capture phase. */
  capture?: boolean;
}

export function isDialogCancelTarget(
  target: EventTarget | null,
  options: Pick<UseDialogKeyboardOptions, 'cancelRef' | 'primaryRef' | 'cancelSelector' | 'isCancelElement'>,
): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (options.cancelRef?.current && (target === options.cancelRef.current || options.cancelRef.current.contains(target))) {
    return true;
  }
  if (options.primaryRef?.current && (target instanceof HTMLButtonElement || target.getAttribute('role') === 'button')) {
    if (target !== options.primaryRef.current && !options.primaryRef.current.contains(target)) {
      return true;
    }
  }
  if (options.isCancelElement?.(target)) {
    return true;
  }
  if (options.cancelSelector && (target.matches(options.cancelSelector) || Boolean(target.closest(options.cancelSelector)))) {
    return true;
  }
  if (
    target.classList.contains('btn--cancel') ||
    target.classList.contains('dialog-cancel') ||
    target.hasAttribute('data-dialog-cancel')
  ) {
    return true;
  }
  return false;
}

export function useDialogKeyboard(options: UseDialogKeyboardOptions) {
  const {
    open = true,
    onClose,
    onCancel,
    onSecondary,
    onConfirm,
    onSave,
    onPrimary,
    disabled = false,
    cancelRef,
    primaryRef,
    cancelSelector,
    isCancelElement,
    capture = false,
  } = options;

  const secondaryAction = onCancel ?? onClose ?? onSecondary;
  const primaryAction = onConfirm ?? onSave ?? onPrimary;

  const handleKey = (event: KeyboardEvent | ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      if (secondaryAction) {
        event.preventDefault();
        event.stopPropagation();
        secondaryAction();
      }
      return;
    }

    if (event.key === 'Enter') {
      const isComposing = 'isComposing' in event ? event.isComposing : event.nativeEvent.isComposing;
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || isComposing) {
        return;
      }
      if (disabled || !primaryAction) {
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)) {
        return;
      }
      if (isDialogCancelTarget(active, { cancelRef, primaryRef, cancelSelector, isCancelElement })) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      primaryAction();
    }
  };

  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      handleKey(event);
    };
    document.addEventListener('keydown', listener, capture);
    return () => {
      document.removeEventListener('keydown', listener, capture);
    };
  }, [open, secondaryAction, primaryAction, disabled, cancelRef, primaryRef, cancelSelector, isCancelElement, capture]);

  return {
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => handleKey(event),
  };
}
