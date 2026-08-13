import type { AppState } from '../../contexts/appStateReducer';
import type { UpdateCheckState } from '../../hooks/useUpdateCheck';
import type { UpdateState } from '../../types';
import type { Translations } from '../../contexts/translationTypes';
import { ExportSettingsIcon, ImportSettingsIcon, OpenInBrowserIcon, SettingsUpdateBackupIcon } from '../shared/icons';
import { SettingsOutlineButton } from './SettingsOutlineButton';

export function SettingsUpdateBackupPanel({
  state,
  t,
  updateCheck,
  hostUpdateState,
  settingsDataStatus,
  onImport,
  onExport,
  onOpenChangelog,
  onDownloadUpdate,
}: {
  state: AppState;
  t: Translations;
  updateCheck: UpdateCheckState;
  hostUpdateState: UpdateState;
  settingsDataStatus: string;
  onImport: () => void;
  onExport: () => void;
  onOpenChangelog: () => void;
  onDownloadUpdate: () => void;
}) {
  const updateAvailable = updateCheck.status === 'available' && updateCheck.hasUpdate;
  const canDownloadUpdate = state.appRuntime !== 'vscode';
  const status = hostUpdateState.status;
  const busy = status === 'downloading' || status === 'applying' || status === 'scheduled-on-exit';
  const error = status === 'error' ? hostUpdateState.error || '' : '';
  const currentVersion = updateCheck.currentVersion || state.appVersion || '0.0.0';
  const latestVersion = updateCheck.latestVersion || currentVersion;
  const versionStatus = updateAvailable
    ? t.newerVersionStatus.replace('{current}', currentVersion).replace('{latest}', latestVersion)
    : t.latestVersionStatus.replace('{current}', currentVersion);

  return (
    <div className="settings-section-panel settings-update-backup-panel">
      <div className="settings-section-panel__header">
        <h3>{t.updateBackup}</h3>
        <p>{t.updateBackupDesc}</p>
      </div>

      <section className="settings-section-card settings-update-overview">
        <div className="settings-section-card__header">
          <div>
            <div className="settings-item__title">{t.applicationUpdate}</div>
            <div className="settings-item__desc">{updateCheck.status === 'checking' ? t.updateChecking : versionStatus}</div>
          </div>
          {updateAvailable && <span className="settings-nav-badge-dot" aria-label={t.ui.updateAvailable} />}
        </div>
        {status === 'downloading' && <div className="settings-item__desc">{t.update.downloading.replace('{progress}', String(hostUpdateState.progressPercent ?? 0))}</div>}
        {status === 'scheduled-on-exit' && <div className="settings-item__desc">{t.update.scheduled}</div>}
        {status === 'applying' && <div className="settings-item__desc">{t.update.applying}</div>}
        {error && <div className="settings-item__desc desktop-typography-settings__error">{error}</div>}
        <div className="settings-section-card__actions">
          <SettingsOutlineButton
            type="button"
            label={t.checkForUpdate}
            tooltip={t.checkForUpdate}
            icon={<SettingsUpdateBackupIcon size={14} />}
            onClick={updateCheck.checkNow}
          />
          <SettingsOutlineButton
            type="button"
            label={t.update.viewChangelog}
            tooltip={t.update.viewChangelog}
            icon={<OpenInBrowserIcon size={14} />}
            onClick={onOpenChangelog}
          />
          {canDownloadUpdate && updateAvailable && !busy && status !== 'downloaded' && (
            <button type="button" className="banned-shortcut-close-btn settings-update-dialog__restart" onClick={onDownloadUpdate}>
              {t.update.downloadButton}
            </button>
          )}
        </div>
      </section>

      <section className="settings-section-card">
        <div className="settings-section-card__header">
          <div>
            <div className="settings-item__title">{t.settingsBackup}</div>
            <div className="settings-item__desc">{t.settingsBackupDesc}</div>
          </div>
        </div>
        <div className="settings-section-card__actions">
          <SettingsOutlineButton
            type="button"
            className="settings-data-btn"
            label={t.importJson}
            tooltip={t.importJson}
            icon={<ImportSettingsIcon size={14} />}
            onClick={onImport}
          />
          <SettingsOutlineButton
            type="button"
            className="settings-data-btn"
            label={t.exportJson}
            tooltip={t.exportJson}
            icon={<ExportSettingsIcon size={14} />}
            onClick={onExport}
          />
        </div>
        {settingsDataStatus && <div className="settings-data-status" role="status">{settingsDataStatus}</div>}
      </section>
    </div>
  );
}
