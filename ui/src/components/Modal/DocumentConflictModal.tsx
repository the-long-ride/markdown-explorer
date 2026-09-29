import { useEffect, useRef } from 'react';
import type { DocumentConflict } from '../../editor/documentSession';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';

interface DocumentConflictModalProps {
  readonly fileName: string;
  readonly conflict: DocumentConflict;
  readonly language?: string;
  readonly onReload: () => void;
  readonly onKeepMine: () => void;
  readonly onCompare: () => void;
}

interface DocumentConflictBannerProps {
  readonly fileName: string;
  readonly language?: string;
  readonly onReload: () => void;
  readonly onKeepMine: () => void;
  readonly onReturn: () => void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function DocumentConflictModal({
  fileName,
  conflict,
  language,
  onReload,
  onKeepMine,
  onCompare,
}: DocumentConflictModalProps) {
  const t = getEditorUiTranslations(language);
  const dialogRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    compareRef.current?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
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
  }, []);

  return (
    <div ref={dialogRef} className="mdn-modal" role="dialog" aria-modal="true" aria-labelledby="document-conflict-title">
      <div className="settings-card document-editing-modal-card">
        <h3 id="document-conflict-title">{t.conflictTitle.replace('{fileName}', fileName)}</h3>
        <p>{t.conflictMessage}</p>
        <div className="document-editing-modal-card__actions">
          <button type="button" className="btn" onClick={onReload}>{t.conflictReload}</button>
          <button ref={compareRef} type="button" className="btn btn--primary" onClick={onCompare}>{t.conflictCompare}</button>
          <button type="button" className="btn" onClick={onKeepMine}>{t.conflictKeepMine}</button>
        </div>
        <span className="sr-only">{t.conflictDiskRevision.replace('{revision}', conflict.diskRevision)}</span>
      </div>
    </div>
  );
}

/** Non-modal stand-in for the conflict dialog while the user inspects the diff. */
export function DocumentConflictBanner({
  fileName,
  language,
  onReload,
  onKeepMine,
  onReturn,
}: DocumentConflictBannerProps) {
  const t = getEditorUiTranslations(language);
  const title = t.conflictTitle.replace('{fileName}', fileName);
  return (
    <section
      className="mdn-action-notice document-conflict-banner"
      role="region"
      aria-label={title}
    >
      <strong>{title}</strong>
      <span role="status">{t.conflictComparing}</span>
      <div className="document-editing-modal-card__actions">
        <button type="button" className="btn btn--primary" onClick={onReturn}>{t.conflictBackToResolution}</button>
        <button type="button" className="btn" onClick={onReload}>{t.conflictReload}</button>
        <button type="button" className="btn" onClick={onKeepMine}>{t.conflictKeepMine}</button>
      </div>
    </section>
  );
}
