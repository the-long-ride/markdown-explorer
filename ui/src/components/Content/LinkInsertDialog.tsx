import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { useDialogKeyboard } from '../../hooks/useDialogKeyboard';

export interface LinkInsertDialogProps {
  open: boolean;
  language: string;
  initialText?: string;
  initialUrl?: string;
  onInsert: (url: string, text: string) => void;
  onClose: () => void;
}

function PasteIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

export function LinkInsertDialog({
  open,
  language,
  initialText = '',
  initialUrl = '',
  onInsert,
  onClose,
}: LinkInsertDialogProps) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const titleId = useId();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const labels = getEditorUiTranslations(language);

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setText(initialText);
      const timer = setTimeout(() => {
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, initialUrl, initialText]);

  useDialogKeyboard({
    open,
    onCancel: onClose,
    onConfirm: () => {
      onInsert(url, text);
      onClose();
    },
    cancelSelector: '.table-insert-dialog__button--cancel, .link-insert-dialog__button--cancel',
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInsert(url, text);
    onClose();
  };

  const handlePaste = () => {
    navigator.clipboard?.readText?.().then((clip) => {
      if (clip) setUrl(clip.trim());
    }).catch(() => {});
    urlInputRef.current?.focus();
  };

  return createPortal(
    <div
      className="table-insert-dialog-backdrop"
      data-testid="link-insert-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="table-insert-dialog link-insert-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        data-testid="link-insert-dialog"
      >
        <h2 id={titleId} className="table-insert-dialog__title">
          {labels.insertLink}
        </h2>

        <div className="table-insert-dialog__field">
          <span className="table-insert-dialog__label">{labels.linkUrl}</span>
          <div className="link-insert-dialog__url-row">
            <input
              ref={urlInputRef}
              type="text"
              className="table-insert-dialog__input"
              data-testid="link-insert-url"
              placeholder={labels.linkUrlPlaceholder}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="button"
              className="link-insert-dialog__paste-btn"
              data-testid="link-insert-paste"
              data-hover-tooltip={labels.pasteUrl}
              aria-label={labels.pasteUrl}
              onClick={handlePaste}
            >
              <PasteIcon />
            </button>
          </div>
        </div>

        <label className="table-insert-dialog__field">
          <span className="table-insert-dialog__label">{labels.linkText}</span>
          <input
            type="text"
            className="table-insert-dialog__input"
            data-testid="link-insert-text"
            placeholder={labels.linkTextPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        <div className="table-insert-dialog__actions">
          <button
            type="button"
            className="table-insert-dialog__button table-insert-dialog__button--cancel link-insert-dialog__button--cancel"
            data-dialog-cancel="true"
            onClick={onClose}
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            className="table-insert-dialog__button table-insert-dialog__button--submit"
            data-testid="link-insert-confirm"
          >
            {labels.apply || 'Insert'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
