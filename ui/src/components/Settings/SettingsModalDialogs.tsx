import { useRef } from 'react';
import { AlertTriangleIcon } from '../shared/icons';
import { useDialogKeyboard } from '../../hooks/useDialogKeyboard';

type DownloadedUpdateDialogProps = {
  t: any;
  version: string;
  onSchedule: () => void;
  onRestart: () => void;
};

export function DownloadedUpdateDialog({ t, version, onSchedule, onRestart }: DownloadedUpdateDialogProps) {
  const deferRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard({
    open: true,
    onCancel: onSchedule,
    onConfirm: onRestart,
    cancelRef: deferRef,
    primaryRef: restartRef,
  });

  return (
    <div className="mdn-modal banned-shortcut-modal settings-modal-dialog" role="dialog" aria-modal="true">
      <div className="settings-card banned-shortcut-card">
        <div className="banned-shortcut-header"><div className="banned-shortcut-icon"><AlertTriangleIcon size={38} /></div><h3>{t.update.restartPromptTitle}</h3></div>
        <div className="banned-shortcut-body"><p>{t.update.restartPromptBody.replace('{version}', version || '')}</p></div>
        <div className="banned-shortcut-footer settings-update-dialog__actions">
          <button ref={deferRef} type="button" className="banned-shortcut-close-btn settings-update-dialog__defer" onClick={onSchedule}>{t.update.updateOnExit}</button>
          <button ref={restartRef} type="button" className="banned-shortcut-close-btn settings-update-dialog__restart" onClick={onRestart}>{t.update.restartAndUpdate}</button>
        </div>
      </div>
    </div>
  );
}

export function BannedShortcutDialog({ t, error, mascot, onClose }: { t: any; error: string; mascot: string; onClose: () => void }) {
  const dismissRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard({
    open: true,
    onClose,
    onPrimary: onClose,
    primaryRef: dismissRef,
  });

  return (
    <div className="mdn-modal banned-shortcut-modal settings-modal-dialog" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="settings-card banned-shortcut-card">
        <button type="button" className="settings-card__close" onClick={onClose} aria-label={t.ui.closeWarning}>&times;</button>
        <div className="banned-shortcut-header">
          {mascot ? <div className="banned-shortcut-mascot"><img src={mascot} alt={t.ui.warningMascotAlt} draggable={false} /></div> : <div className="banned-shortcut-icon"><AlertTriangleIcon size={38} /></div>}
          <h3>{t.bannedShortcutTitle}</h3>
        </div>
        <div className="banned-shortcut-body"><p>{error}</p></div>
        <div className="banned-shortcut-footer"><button ref={dismissRef} type="button" className="banned-shortcut-close-btn" onClick={onClose}>{t.bannedShortcutDismiss}</button></div>
      </div>
    </div>
  );
}

type ResetShortcutsConfirmDialogProps = {
  t: any;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ResetShortcutsConfirmDialog({ t, onCancel, onConfirm }: ResetShortcutsConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard({
    open: true,
    onCancel,
    onConfirm,
    cancelRef,
    primaryRef: confirmRef,
  });

  return (
    <div
      className="mdn-modal banned-shortcut-modal settings-modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-shortcuts-confirm-title"
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div className="settings-card banned-shortcut-card">
        <button type="button" className="settings-card__close" onClick={onCancel} aria-label={t.cancelResetShortcuts}>&times;</button>
        <div className="banned-shortcut-header">
          <div className="banned-shortcut-icon"><AlertTriangleIcon size={38} /></div>
          <h3 id="reset-shortcuts-confirm-title">{t.resetShortcutsConfirmTitle}</h3>
        </div>
        <div className="banned-shortcut-body"><p>{t.resetShortcutsConfirmBody}</p></div>
        <div className="banned-shortcut-footer settings-update-dialog__actions">
          <button ref={cancelRef} type="button" className="banned-shortcut-close-btn settings-update-dialog__defer" onClick={onCancel}>{t.cancelResetShortcuts}</button>
          <button ref={confirmRef} type="button" className="banned-shortcut-close-btn settings-reset-shortcuts-confirm" onClick={onConfirm}>{t.confirmResetShortcuts}</button>
        </div>
      </div>
    </div>
  );
}
