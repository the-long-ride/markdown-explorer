import { AlertTriangleIcon } from '../shared/icons';

type DownloadedUpdateDialogProps = {
  t: any;
  version: string;
  onSchedule: () => void;
  onRestart: () => void;
};

export function DownloadedUpdateDialog({ t, version, onSchedule, onRestart }: DownloadedUpdateDialogProps) {
  return (
    <div className="mdn-modal banned-shortcut-modal settings-modal-dialog" role="dialog" aria-modal="true">
      <div className="settings-card banned-shortcut-card">
        <div className="banned-shortcut-header"><div className="banned-shortcut-icon"><AlertTriangleIcon size={38} /></div><h3>{t.update.restartPromptTitle}</h3></div>
        <div className="banned-shortcut-body"><p>{t.update.restartPromptBody.replace('{version}', version || '')}</p></div>
        <div className="banned-shortcut-footer settings-update-dialog__actions">
          <button type="button" className="banned-shortcut-close-btn settings-update-dialog__defer" onClick={onSchedule}>{t.update.updateOnExit}</button>
          <button type="button" className="banned-shortcut-close-btn settings-update-dialog__restart" onClick={onRestart}>{t.update.restartAndUpdate}</button>
        </div>
      </div>
    </div>
  );
}

export function BannedShortcutDialog({ t, error, mascot, onClose }: { t: any; error: string; mascot: string; onClose: () => void }) {
  return (
    <div className="mdn-modal banned-shortcut-modal settings-modal-dialog" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="settings-card banned-shortcut-card">
        <button type="button" className="settings-card__close" onClick={onClose} aria-label="Close warning">&times;</button>
        <div className="banned-shortcut-header">
          {mascot ? <div className="banned-shortcut-mascot"><img src={mascot} alt="Warning Mascot" draggable={false} /></div> : <div className="banned-shortcut-icon"><AlertTriangleIcon size={38} /></div>}
          <h3>{t.bannedShortcutTitle}</h3>
        </div>
        <div className="banned-shortcut-body"><p>{error}</p></div>
        <div className="banned-shortcut-footer"><button type="button" className="banned-shortcut-close-btn" onClick={onClose}>{t.bannedShortcutDismiss}</button></div>
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
          <button type="button" className="banned-shortcut-close-btn settings-update-dialog__defer" onClick={onCancel}>{t.cancelResetShortcuts}</button>
          <button type="button" className="banned-shortcut-close-btn settings-reset-shortcuts-confirm" onClick={onConfirm}>{t.confirmResetShortcuts}</button>
        </div>
      </div>
    </div>
  );
}
