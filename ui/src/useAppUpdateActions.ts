import { useCallback } from 'react';
import type { PlatformBridge } from './platform/bridge';

interface AppUpdateActionOptions {
  bridge: PlatformBridge;
  canInstallUpdates: boolean;
  canInstallUpdate: boolean;
  downloadUrl: string;
  latestVersion: string;
  changelogUrl: string;
}

export function useAppUpdateActions({
  bridge,
  canInstallUpdates,
  canInstallUpdate,
  downloadUrl,
  latestVersion,
  changelogUrl,
}: AppUpdateActionOptions) {
  const openExternalUrl = useCallback((url: string) => {
    if (url) bridge.postMessage({ command: 'openExternal', url });
  }, [bridge]);

  const downloadUpdate = useCallback(() => {
    if (canInstallUpdates && canInstallUpdate && downloadUrl) {
      bridge.postMessage({ command: 'downloadUpdate', version: latestVersion, url: downloadUrl });
      return;
    }
    openExternalUrl(downloadUrl);
  }, [bridge, canInstallUpdate, canInstallUpdates, downloadUrl, latestVersion, openExternalUrl]);

  const scheduleUpdateOnExit = useCallback(() => {
    if (canInstallUpdates) bridge.postMessage({ command: 'scheduleDownloadedUpdate' });
  }, [bridge, canInstallUpdates]);

  const restartAndApplyUpdate = useCallback(() => {
    if (canInstallUpdates) bridge.postMessage({ command: 'restartAndApplyUpdate' });
  }, [bridge, canInstallUpdates]);

  const openUpdateChangelog = useCallback(() => openExternalUrl(changelogUrl), [changelogUrl, openExternalUrl]);

  return { openExternalUrl, downloadUpdate, scheduleUpdateOnExit, restartAndApplyUpdate, openUpdateChangelog };
}
