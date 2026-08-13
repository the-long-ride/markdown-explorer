import type { Translations } from '../../contexts/translationTypes';
import { SkipUpdateVersionIcon, UpdateGlowIcon } from '../shared/icons';
import { SettingsOutlineButton } from './SettingsOutlineButton';

export function AvailableUpdateDialog({
  version,
  currentVersion,
  t,
  canDownloadUpdate,
  onDownload,
  onLater,
  onSkipVersion,
  onChangelog,
}: {
  version: string;
  currentVersion: string;
  t: Translations;
  canDownloadUpdate: boolean;
  onDownload: () => void;
  onLater: () => void;
  onSkipVersion: () => void;
  onChangelog: () => void;
}) {
  const status = t.newerVersionStatus.replace('{current}', currentVersion || '0.0.0').replace('{latest}', version);
  return (
    <div className="mdn-modal settings-modal-dialog update-available-modal" role="dialog" aria-modal="true" aria-labelledby="update-available-title">
      <div className="settings-card update-available-card">
        <button type="button" className="settings-card__close" onClick={onLater} aria-label={t.updateLater}>&times;</button>
        <div className="update-available-card__header">
          <div className="update-available-card__icon"><UpdateGlowIcon size={34} /></div>
          <div className="update-available-card__copy">
            <h3 id="update-available-title">{t.update.availableTitle.replace('{version}', version)}</h3>
            <p>{status}</p>
            <button type="button" className="settings-update-card__link update-available-card__changelog" onClick={onChangelog}>
              {t.update.viewChangelog}
            </button>
          </div>
        </div>
        <div className="update-available-card__actions">
          {canDownloadUpdate && (
            <button type="button" className="banned-shortcut-close-btn settings-update-dialog__restart" onClick={onDownload}>
              {t.update.downloadButton}
            </button>
          )}
          <SettingsOutlineButton
            type="button"
            className="settings-update-dialog__defer"
            label={t.updateLater}
            tooltip={t.updateLater}
            onClick={onLater}
          />
          <SettingsOutlineButton
            type="button"
            className="update-available-card__skip"
            label={t.updateSkipVersion}
            tooltip={t.updateSkipVersion}
            icon={<SkipUpdateVersionIcon size={14} />}
            onClick={onSkipVersion}
          />
        </div>
      </div>
    </div>
  );
}
