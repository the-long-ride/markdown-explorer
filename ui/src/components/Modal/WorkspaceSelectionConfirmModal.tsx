import { useEffect } from 'react';

interface WorkspaceSelectionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function WorkspaceSelectionConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: WorkspaceSelectionConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="mdn-modal workspace-selection-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-selection-confirm-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="settings-card workspace-selection-confirm-card">
        <h3 id="workspace-selection-confirm-title">
          Return to workspace selection?
        </h3>
        <div className="workspace-selection-confirm-card__body">
          Close the current workspace and choose another one?
        </div>
        <div className="workspace-selection-confirm-card__actions">
          <button
            type="button"
            className="workspace-selection-confirm-button workspace-selection-confirm-button--outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="workspace-selection-confirm-button"
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
