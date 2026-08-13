import { useCallback, useEffect, useState } from 'react';
import type { UpdateCheckState } from './useUpdateCheck';
import { getSkippedUpdateVersion, shouldNotifyForUpdate, skipUpdateVersion } from '../updateNotification';

export function useUpdateNotificationState(updateCheck: UpdateCheckState, downloadUpdate: () => void) {
  const [skippedVersion, setSkippedVersion] = useState(() => getSkippedUpdateVersion());
  const [dismissedVersion, setDismissedVersion] = useState('');
  const [promptOpen, setPromptOpen] = useState(false);
  const attention = shouldNotifyForUpdate(updateCheck.hasUpdate, updateCheck.latestVersion, skippedVersion);

  useEffect(() => {
    if (!attention || !updateCheck.latestVersion) {
      setPromptOpen(false);
      return;
    }
    if (dismissedVersion === updateCheck.latestVersion) return;
    setPromptOpen(true);
  }, [attention, dismissedVersion, updateCheck.latestVersion]);

  const later = useCallback(() => {
    setDismissedVersion(updateCheck.latestVersion);
    setPromptOpen(false);
  }, [updateCheck.latestVersion]);

  const skipVersion = useCallback(() => {
    const skipped = skipUpdateVersion(updateCheck.latestVersion);
    setSkippedVersion(skipped);
    setDismissedVersion(updateCheck.latestVersion);
    setPromptOpen(false);
  }, [updateCheck.latestVersion]);

  const download = useCallback(() => {
    later();
    downloadUpdate();
  }, [downloadUpdate, later]);

  return { attention, promptOpen, later, skipVersion, download };
}
