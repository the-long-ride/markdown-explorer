import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppRuntime, HostPlatform } from '../types';
import {
  CHANGELOG_URL,
  RELEASE_API_URL,
  RELEASE_FALLBACK_URL,
  VSCODE_MARKETPLACE_URL,
} from '../constants/urls';

export { CHANGELOG_URL, VSCODE_MARKETPLACE_URL } from '../constants/urls';


interface GitHubReleaseAsset {
  readonly name?: string;
  readonly browser_download_url?: string;
}

interface GitHubRelease {
  readonly tag_name?: string;
  readonly name?: string;
  readonly html_url?: string;
  readonly assets?: readonly GitHubReleaseAsset[];
}

export interface UpdateCheckState {
  readonly checkNow: () => void;
  readonly status: 'idle' | 'checking' | 'current' | 'available' | 'error';
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly downloadUrl: string;
  readonly canInstallUpdate: boolean;
  readonly releaseUrl: string;
  readonly changelogUrl: string;
  readonly hasUpdate: boolean;
  readonly error?: string;
}

interface UseUpdateCheckParams {
  readonly currentVersion: string;
  readonly runtime: AppRuntime;
  readonly hostPlatform: HostPlatform;
  readonly hostArch: string;
}

export function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, '').split(/[+-]/)[0];
}

export function parseVersion(version: string) {
  const normalized = normalizeVersion(version);
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [
    Number(match[1] ?? 0),
    Number(match[2] ?? 0),
    Number(match[3] ?? 0),
  ];
}

export function compareVersions(left: string, right: string) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) {
    const normalizedLeft = normalizeVersion(left);
    const normalizedRight = normalizeVersion(right);
    return normalizedLeft === normalizedRight ? 0 : 1;
  }

  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function getDesktopAssetScore(
  assetName: string,
  platform: HostPlatform,
  arch: string,
  runtime: AppRuntime = 'desktop',
) {
  const name = assetName.toLowerCase();
  const normalizedArch = arch.toLowerCase();
  let score = 0;

  if (runtime === 'desktop') {
    if (name.includes('electron')) score += 40;
    if (name.includes('tauri')) score -= 40;
  } else if (runtime === 'tauri') {
    if (name.includes('tauri')) score += 40;
    if (name.includes('electron')) score -= 40;
  }

  if (platform === 'windows' && name.endsWith('.exe')) {
    // Prefer the NSIS installer for standard desktop releases and in-app updates.
    score += name.includes('setup') || name.includes('installer') ? 30 : 18;
  }
  if (platform === 'windows' && name.endsWith('.zip')) {
    // Keep unpacked zip builds as a lower-priority fallback for manual installs.
    score += 12;
  }
  if (platform === 'linux' && name.endsWith('.appimage')) score += 20;
  if (platform === 'linux' && name.endsWith('.deb')) score += 12;
  if (platform === 'macos' && name.endsWith('.dmg')) score += 20;
  if (platform === 'macos' && name.endsWith('.zip')) score += 10;

  if (normalizedArch && name.includes(normalizedArch)) score += 8;
  if (normalizedArch === 'x64' && name.includes('amd64')) score += 8;

  return score;
}

export function isInstallableDesktopAsset(
  assetName: string,
  platform: HostPlatform,
  runtime: AppRuntime,
) {
  const name = assetName.toLowerCase();
  if (platform !== 'windows') return false;
  if (!name.endsWith('.exe')) return false;
  if (!(name.includes('setup') || name.includes('installer'))) return false;
  const hasElectronKeyword = name.includes('electron');
  const hasTauriKeyword = name.includes('tauri');
  if (runtime === 'desktop') {
    return !hasTauriKeyword;
  }
  if (runtime === 'tauri') {
    return hasTauriKeyword && !hasElectronKeyword;
  }
  return false;
}

export function pickDesktopDownloadUrl(
  assets: readonly GitHubReleaseAsset[],
  platform: HostPlatform,
  arch: string,
  runtime: AppRuntime = 'desktop',
) {
  const best = assets
    .map((asset) => ({
      asset,
      score: getDesktopAssetScore(asset.name ?? '', platform, arch, runtime),
    }))
    .filter(({ asset, score }) => score > 0 && !!asset.browser_download_url)
    .sort((a, b) => b.score - a.score)[0]?.asset;

  return best?.browser_download_url;
}

export function pickInstallableDesktopDownloadUrl(
  assets: readonly GitHubReleaseAsset[],
  platform: HostPlatform,
  arch: string,
  runtime: AppRuntime,
) {
  const best = assets
    .map((asset) => ({
      asset,
      score: isInstallableDesktopAsset(asset.name ?? '', platform, runtime)
        ? getDesktopAssetScore(asset.name ?? '', platform, arch, runtime)
        : 0,
    }))
    .filter(({ asset, score }) => score > 0 && !!asset.browser_download_url)
    .sort((a, b) => b.score - a.score)[0]?.asset;

  return best?.browser_download_url;
}

export function getDownloadUrl(
  release: GitHubRelease,
  runtime: AppRuntime,
  platform: HostPlatform,
  arch: string,
) {
  if (runtime === 'vscode') return VSCODE_MARKETPLACE_URL;

  const assets = Array.isArray(release.assets) ? release.assets : [];
  return pickDesktopDownloadUrl(assets, platform, arch, runtime) || release.html_url || RELEASE_FALLBACK_URL;
}

export function getInstallableDownloadUrl(
  release: GitHubRelease,
  runtime: AppRuntime,
  platform: HostPlatform,
  arch: string,
) {
  if (runtime !== 'desktop' && runtime !== 'tauri') return undefined;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return pickInstallableDesktopDownloadUrl(assets, platform, arch, runtime);
}

export function useUpdateCheck({
  currentVersion,
  runtime,
  hostPlatform,
  hostArch,
}: UseUpdateCheckParams): UpdateCheckState {
  const initialState = useMemo<Omit<UpdateCheckState, 'checkNow'>>(() => ({
    status: currentVersion ? 'checking' : 'idle',
    currentVersion,
    latestVersion: '',
    downloadUrl: runtime === 'vscode' ? VSCODE_MARKETPLACE_URL : RELEASE_FALLBACK_URL,
    canInstallUpdate: false,
    releaseUrl: RELEASE_FALLBACK_URL,
    changelogUrl: CHANGELOG_URL,
    hasUpdate: false,
  }), [currentVersion, runtime]);

  const [state, setState] = useState<Omit<UpdateCheckState, 'checkNow'>>(initialState);
  const [checkNonce, setCheckNonce] = useState(0);
  const checkNow = useCallback(() => setCheckNonce((value: number) => value + 1), []);

  useEffect(() => {
    if (!currentVersion) {
      setState(initialState);
      return;
    }

    const controller = new AbortController();
    setState(initialState);

    // Delay update check to avoid competing with first paint
    const delayMs = checkNonce > 0 ? 0 : 8000;
    const timer = setTimeout(() => {
      if (controller.signal.aborted) return;
      fetch(RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        return response.json() as Promise<GitHubRelease>;
      })
      .then((release) => {
        const latestVersion = release.tag_name || release.name || '';
        const hasUpdate = latestVersion
          ? compareVersions(latestVersion, currentVersion) > 0
          : false;
        const installableDownloadUrl = getInstallableDownloadUrl(
          release,
          runtime,
          hostPlatform,
          hostArch,
        );

        setState({
          status: hasUpdate ? 'available' : 'current',
          currentVersion,
          latestVersion,
          downloadUrl: installableDownloadUrl
            || getDownloadUrl(release, runtime, hostPlatform, hostArch),
          canInstallUpdate: Boolean(installableDownloadUrl),
          releaseUrl: release.html_url || RELEASE_FALLBACK_URL,
          changelogUrl: CHANGELOG_URL,
          hasUpdate,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          ...initialState,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unable to check for updates',
        });
      });
    }, delayMs);

    return () => { controller.abort(); clearTimeout(timer); };
  }, [checkNonce, currentVersion, hostArch, hostPlatform, initialState, runtime]);

  return { ...state, checkNow };
}
