import { useEffect, useId, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

interface SidebarConfirmDialogProps {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel?: string;
  items?: readonly string[];
  moreLabel?: string;
  warning?: string;
  options?: ReactNode;
  variant?: 'default' | 'destructive';
  onCancel: () => void;
  onConfirm: () => void;
}

export function SidebarConfirmDialog({
  title,
  message,
  cancelLabel,
  confirmLabel,
  items,
  moreLabel,
  warning,
  options,
  variant = 'default',
  onCancel,
  onConfirm,
}: SidebarConfirmDialogProps) {
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
    } else if (event.key === 'Tab') {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };

  return createPortal(
    <div className="sidebar-confirm-dialog__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className={`sidebar-confirm-dialog sidebar-confirm-dialog--${variant}`} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} onKeyDown={onKeyDown}>
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        {items && items.length > 0 && (
          <ul className="sidebar-confirm-dialog__list">
            {items.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}
            {moreLabel && <li className="sidebar-confirm-dialog__more">{moreLabel}</li>}
          </ul>
        )}
        {warning && <p className="sidebar-confirm-dialog__warning" role="note">{warning}</p>}
        {options}
        <div className="sidebar-confirm-dialog__actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className={`btn sidebar-confirm-dialog__confirm${variant === 'destructive' ? ' is-destructive' : ''}`} onClick={onConfirm}>{confirmLabel ?? title}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
