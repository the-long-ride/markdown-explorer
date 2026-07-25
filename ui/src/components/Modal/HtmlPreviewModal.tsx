import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface HtmlPreviewModalProps {
  documentHtml: string;
  title: string;
  closeLabel: string;
  trigger: HTMLElement | null;
  onClose: () => void;
}

function measureHeaderBottom(): number {
  const selectors = [
    '.topbar',
    '.desktop-tabbar',
    '.workspace-window-controls',
    'header',
  ];
  const rects = selectors.flatMap((selector) =>
    [...document.querySelectorAll<HTMLElement>(selector)]
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.height > 0 && rect.bottom > 0),
  ).sort((left, right) => left.top - right.top);

  let bottom = 0;
  for (const rect of rects) {
    if (rect.top > bottom + 8) break;
    bottom = Math.max(bottom, rect.bottom);
  }
  return Math.max(8, Math.ceil(bottom + 8));
}

export function HtmlPreviewModal({
  documentHtml,
  title,
  closeLabel,
  trigger,
  onClose,
}: HtmlPreviewModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    backdropRef.current?.style.setProperty('--mdn-html-modal-top', `${measureHeaderBottom()}px`);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], iframe, [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute('disabled'));
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onResize = () => {
      backdropRef.current?.style.setProperty('--mdn-html-modal-top', `${measureHeaderBottom()}px`);
    };
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onResize);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [onClose, trigger]);

  return createPortal(
    <div
      ref={backdropRef}
      className="mdn-html-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="mdn-html-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="mdn-html-modal__header">
          <strong>{title}</strong>
          <button
            ref={closeRef}
            type="button"
            className="mdn-html-modal__close"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <iframe
          className="mdn-html-modal__iframe"
          title={title}
          sandbox="allow-scripts"
          srcDoc={documentHtml}
        />
      </div>
    </div>,
    document.body,
  );
}
