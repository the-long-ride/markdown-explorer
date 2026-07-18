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
      style={{
        display: 'flex',
        background:
          'linear-gradient(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.12)), var(--modal-bg)',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="settings-card" style={{ width: '450px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 id="workspace-selection-confirm-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--tx)' }}>
          Return to workspace selection?
        </h3>
        <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--tx2)' }}>
          Close the current workspace and choose another one?
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid var(--bd)', paddingTop: '16px' }}>
          <button
            type="button"
            className="workspace-selection-confirm-button workspace-selection-confirm-button--outline"
            style={{
              height: '32px',
              minHeight: '32px',
              padding: '0 20px',
              border: '1px solid var(--bd-s)',
              borderRadius: 'var(--r-md)',
              background: 'transparent',
              color: 'var(--tx2)',
              font: '800 11px/1 var(--font-ui)',
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="workspace-selection-confirm-button"
            style={{
              height: '32px',
              minHeight: '32px',
              padding: '0 20px',
              border: '1px solid transparent',
              borderRadius: 'var(--r-md)',
              background: 'var(--accent)',
              color: '#fff',
              font: '800 11px/1 var(--font-ui)',
              cursor: 'pointer',
            }}
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
