import { useEffect, useRef } from 'react';
import type { EditorUiTranslations } from '../../contexts/editorUiTranslations';
import type { UnsavedChangesChoice } from '../../editor/unsavedGuards';
import { FloppyDiskIcon, LeaveWithoutSavingIcon } from '../Content/MarkdownEditingIcons';

interface UnsavedChangesModalProps {
  readonly fileName: string;
  readonly labels?: Partial<EditorUiTranslations>;
  /** A save is in flight: every choice is disabled until it settles. */
  readonly saving?: boolean;
  /** Why the last save attempt failed; the modal stays open so the user can retry or discard. */
  readonly errorMessage?: string | null;
  readonly onChoose: (choice: UnsavedChangesChoice) => void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function UnsavedChangesModal({ fileName, labels, saving = false, errorMessage = null, onChoose }: UnsavedChangesModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(saving);
  savingRef.current = saving;

  const titleText = labels?.unsavedChangesTitle ?? 'Your changes has not been saved';
  const filePromptText = labels?.fileNotSavedPrompt ?? 'The following file has not been saved:';
  const dontSaveLabel = labels?.dontSaveAndLeave ?? "Don't Save & Leave";
  const cancelLabel = labels?.cancel ?? 'Cancel';
  const saveLabel = labels?.save ?? 'Save';

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    saveRef.current?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!savingRef.current) onChoose('cancel');
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== 'Tab' || !dialog) return;
      const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const outside = !dialog.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [onChoose]);

  return (
    <div ref={dialogRef} className="mdn-modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-changes-title">
      <div className="settings-card document-editing-modal-card">
        <h3 id="unsaved-changes-title" className="document-editing-modal-card__title">{titleText}</h3>
        <div className="document-editing-modal-card__message">
          <p className="document-editing-modal-card__lead">{filePromptText}</p>
          <div className="document-editing-modal-card__filename">{fileName}</div>
          {errorMessage && <p className="document-editing-modal-card__error" role="alert">{errorMessage}</p>}
        </div>
        <div className="document-editing-modal-card__actions">
          <button
            type="button"
            className="btn document-editing-modal__btn document-editing-modal__btn--discard"
            disabled={saving}
            onClick={() => onChoose('discard')}
          >
            <LeaveWithoutSavingIcon size={14} />
            <span>{dontSaveLabel}</span>
          </button>
          <button
            type="button"
            className="btn document-editing-modal__btn"
            disabled={saving}
            onClick={() => onChoose('cancel')}
          >
            {cancelLabel}
          </button>
          <button
            ref={saveRef}
            type="button"
            className="btn btn--primary document-editing-modal__btn document-editing-modal__btn--save"
            disabled={saving}
            aria-busy={saving || undefined}
            onClick={() => onChoose('save')}
          >
            <FloppyDiskIcon size={14} />
            <span>{saveLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
