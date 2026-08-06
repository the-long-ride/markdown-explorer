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
  if (!open) return null;
  return (
    <div className="bookmark-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="bookmark-dialog bookmark-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bookmark-delete-title">
        <h2 id="bookmark-delete-title">{title}</h2>
        <p>{message.replace('{count}', String(count))}</p>
        <div className="bookmark-dialog__actions">
          <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="btn bookmark-delete-dialog__confirm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
