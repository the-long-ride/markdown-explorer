import { useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';
import { useDialogKeyboard } from '../../hooks/useDialogKeyboard';

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
  const { state } = useAppState();
  const t = getTranslations(state.settings.language || 'en');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard({
    open: isOpen,
    onClose,
    onConfirm,
    cancelRef,
    primaryRef: confirmRef,
  });

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
        <h3 id="workspace-selection-confirm-title">{t.workspaceSelection.confirmTitle}</h3>
        <div className="workspace-selection-confirm-card__body">{t.workspaceSelection.confirmBody}</div>
        <div className="workspace-selection-confirm-card__actions">
          <button
            ref={cancelRef}
            type="button"
            className="workspace-selection-confirm-button workspace-selection-confirm-button--outline"
            onClick={onClose}
          >
            {t.workspaceSelection.cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="workspace-selection-confirm-button"
            onClick={onConfirm}
          >
            {t.workspaceSelection.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
