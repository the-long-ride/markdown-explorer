import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogKeyboard } from '../../hooks/useDialogKeyboard';

interface BookmarkDialogProps {
  open: boolean;
  title: string;
  label: string;
  placeholder: string;
  initialValue: string;
  saveLabel: string;
  cancelLabel: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export function BookmarkDialog({
  open,
  title,
  label,
  placeholder,
  initialValue,
  saveLabel,
  cancelLabel,
  onSave,
  onClose,
}: BookmarkDialogProps) {
  const [value, setValue] = useState(initialValue);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const inputId = useId();

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [initialValue, open]);

  const normalized = value.trim();

  useDialogKeyboard({
    open,
    onClose,
    onSave: () => {
      if (normalized) onSave(normalized);
    },
    disabled: !normalized,
    cancelRef,
    primaryRef: saveRef,
  });

  if (!open) return null;
  return createPortal(
    <div className="bookmark-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form
        className="bookmark-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(event) => {
          event.preventDefault();
          if (normalized) onSave(normalized);
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <label htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          autoFocus
          value={value}
          placeholder={placeholder}
          maxLength={160}
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="bookmark-dialog__actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onClose}>{cancelLabel}</button>
          <button ref={saveRef} type="submit" className="btn btn--accent" disabled={!normalized}>{saveLabel}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
