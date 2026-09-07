import type { DocumentConflict } from '../../editor/documentSession';

interface DocumentConflictModalProps {
  readonly fileName: string;
  readonly conflict: DocumentConflict;
  readonly onReload: () => void;
  readonly onKeepMine: () => void;
  readonly onCompare: () => void;
}

export function DocumentConflictModal({
  fileName,
  conflict,
  onReload,
  onKeepMine,
  onCompare,
}: DocumentConflictModalProps) {
  return (
    <div className="mdn-modal" role="dialog" aria-modal="true" aria-labelledby="document-conflict-title">
      <div className="settings-card document-editing-modal-card">
        <h3 id="document-conflict-title">{fileName} changed on disk</h3>
        <p>The file changed after you started editing. Choose which version to keep.</p>
        <div className="document-editing-modal-card__actions">
          <button type="button" onClick={onReload}>Reload disk version</button>
          <button type="button" onClick={onCompare}>Compare changes</button>
          <button type="button" onClick={onKeepMine}>Keep my edit</button>
        </div>
        <span className="sr-only">Disk revision {conflict.diskRevision}</span>
      </div>
    </div>
  );
}
