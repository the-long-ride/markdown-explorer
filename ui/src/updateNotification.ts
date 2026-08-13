import { SKIPPED_UPDATE_VERSION_STORAGE_KEY } from './constants/storage.ts';

function normalizeUpdateVersion(version: string) {
  return version.trim().replace(/^v/i, '').split(/[+-]/)[0];
}

export function getSkippedUpdateVersion(storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  if (!storage) return '';
  try {
    return normalizeUpdateVersion(storage.getItem(SKIPPED_UPDATE_VERSION_STORAGE_KEY) || '');
  } catch {
    return '';
  }
}

export function skipUpdateVersion(version: string, storage: Pick<Storage, 'setItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  const normalized = normalizeUpdateVersion(version);
  if (!normalized || !storage) return normalized;
  try {
    storage.setItem(SKIPPED_UPDATE_VERSION_STORAGE_KEY, normalized);
  } catch {
    // Storage is best-effort. The session can still dismiss the dialog.
  }
  return normalized;
}

export function shouldNotifyForUpdate(hasUpdate: boolean, latestVersion: string, skippedVersion: string) {
  if (!hasUpdate) return false;
  const latest = normalizeUpdateVersion(latestVersion);
  if (!latest) return false;
  return latest !== normalizeUpdateVersion(skippedVersion);
}
