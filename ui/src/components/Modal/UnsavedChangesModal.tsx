import type { UnsavedChangesChoice } from '../../editor/unsavedGuards';

interface UnsavedChangesModalProps {
  readonly fileName: string;
  readonly onChoose: (choice: UnsavedChangesChoice) => void;
}

export function UnsavedChangesModal({ fileName, onChoose }: UnsavedChangesModalProps) {
  return (
    <div className="mdn-modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-changes-title">
      <div className="settings-card document-editing-modal-card">
        <h3 id="unsaved-changes-title">Save changes to {fileName}?</h3>
        <p>Your changes have not been saved.</p>
        <div className="document-editing-modal-card__actions">
          <button type="button" onClick={() => onChoose('discard')}>Don't Save</button>
          <button type="button" onClick={() => onChoose('cancel')}>Cancel</button>
          <button type="button" onClick={() => onChoose('save')}>Save</button>
        </div>
      </div>
    </div>
  );
}
