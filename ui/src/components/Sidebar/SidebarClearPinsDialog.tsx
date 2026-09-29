import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

interface SidebarClearPinsDialogProps {
  title: string;
  message: string;
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SidebarClearPinsDialog({ title, message, cancelLabel, onCancel, onConfirm }: SidebarClearPinsDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.key === 'Tab' && event.shiftKey && document.activeElement === cancelRef.current) {
      event.preventDefault();
      confirmRef.current?.focus();
    } else if (event.key === 'Tab' && !event.shiftKey && document.activeElement === confirmRef.current) {
      event.preventDefault();
      cancelRef.current?.focus();
    }
  };

  return createPortal(
    <div className="sidebar-clear-pins-dialog__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="sidebar-clear-pins-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} onKeyDown={onKeyDown}>
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        <div className="sidebar-clear-pins-dialog__actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className="btn sidebar-clear-pins-dialog__confirm" onClick={onConfirm}>{title}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
