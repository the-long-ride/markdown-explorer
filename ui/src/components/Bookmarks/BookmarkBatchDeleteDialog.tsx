import { useRef } from 'react';
import { useDialogKeyboard } from '../../hooks/useDialogKeyboard';

interface BookmarkBatchDeleteDialogProps {
  open: boolean;
  count: number;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function BookmarkBatchDeleteDialog({ open, count, title, message, cancelLabel, confirmLabel, onCancel, onConfirm }: BookmarkBatchDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard({
    open,
    onCancel,
    onConfirm,
    cancelRef,
    primaryRef: confirmRef,
  });

  if (!open) return null;
  return (
    <div className="bookmark-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="bookmark-dialog bookmark-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bookmark-delete-title">
        <h2 id="bookmark-delete-title">{title}</h2>
        <p>{message.replace('{count}', String(count))}</p>
        <div className="bookmark-dialog__actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className="btn bookmark-delete-dialog__confirm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
