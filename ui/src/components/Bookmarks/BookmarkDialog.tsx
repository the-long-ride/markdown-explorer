import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const titleId = useId();
  const inputId = useId();

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [initialValue, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  const normalized = value.trim();
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
          <button type="button" className="btn" onClick={onClose}>{cancelLabel}</button>
          <button type="submit" className="btn btn--accent" disabled={!normalized}>{saveLabel}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
