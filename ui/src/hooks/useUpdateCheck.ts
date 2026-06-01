import { useEffect, useMemo, useState } from 'react';
import type { AppRuntime, HostPlatform } from '../types';

const RELEASE_API_URL = 'https://api.github.com/repos/the-long-ride/markdown-explorer/releases/latest';
export const CHANGELOG_URL = 'https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md';
export const VSCODE_MARKETPLACE_URL = 'https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer';
const RELEASE_FALLBACK_URL = 'https://github.com/the-long-ride/markdown-explorer/releases/latest';

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
  readonly status: 'idle' | 'checking' | 'current' | 'available' | 'error';
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly downloadUrl: string;
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

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, '').split(/[+-]/)[0];
}

function parseVersion(version: string) {
  const normalized = normalizeVersion(version);
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [
    Number(match[1] ?? 0),
    Number(match[2] ?? 0),
    Number(match[3] ?? 0),
  ];
}

function compareVersions(left: string, right: string) {
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

function getDesktopAssetScore(assetName: string, platform: HostPlatform, arch: string) {
  const name = assetName.toLowerCase();
  const normalizedArch = arch.toLowerCase();
  let score = 0;

  if (platform === 'windows' && name.endsWith('.exe')) score += 20;
  if (platform === 'linux' && name.endsWith('.appimage')) score += 20;
  if (platform === 'linux' && name.endsWith('.deb')) score += 12;
  if (platform === 'macos' && name.endsWith('.dmg')) score += 20;
  if (platform === 'macos' && name.endsWith('.zip')) score += 10;

  if (normalizedArch && name.includes(normalizedArch)) score += 8;
  if (normalizedArch === 'x64' && name.includes('amd64')) score += 8;

  return score;
}

function pickDesktopDownloadUrl(
  assets: readonly GitHubReleaseAsset[],
  platform: HostPlatform,
  arch: string,
) {
  const best = assets
    .map((asset) => ({
      asset,
      score: getDesktopAssetScore(asset.name ?? '', platform, arch),
    }))
    .filter(({ asset, score }) => score > 0 && !!asset.browser_download_url)
    .sort((a, b) => b.score - a.score)[0]?.asset;

  return best?.browser_download_url;
}

function getDownloadUrl(
  release: GitHubRelease,
  runtime: AppRuntime,
  platform: HostPlatform,
  arch: string,
) {
  if (runtime === 'vscode') return VSCODE_MARKETPLACE_URL;

  const assets = Array.isArray(release.assets) ? release.assets : [];
  return pickDesktopDownloadUrl(assets, platform, arch) || release.html_url || RELEASE_FALLBACK_URL;
}

export function useUpdateCheck({
  currentVersion,
  runtime,
  hostPlatform,
  hostArch,
}: UseUpdateCheckParams): UpdateCheckState {
  const initialState = useMemo<UpdateCheckState>(() => ({
    status: currentVersion ? 'checking' : 'idle',
    currentVersion,
    latestVersion: '',
    downloadUrl: runtime === 'vscode' ? VSCODE_MARKETPLACE_URL : RELEASE_FALLBACK_URL,
    releaseUrl: RELEASE_FALLBACK_URL,
    changelogUrl: CHANGELOG_URL,
    hasUpdate: false,
  }), [currentVersion, runtime]);

  const [state, setState] = useState<UpdateCheckState>(initialState);

  useEffect(() => {
    if (!currentVersion) {
      setState(initialState);
      return;
    }

    const controller = new AbortController();
    setState(initialState);

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

        setState({
          status: hasUpdate ? 'available' : 'current',
          currentVersion,
          latestVersion,
          downloadUrl: getDownloadUrl(release, runtime, hostPlatform, hostArch),
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

    return () => controller.abort();
  }, [currentVersion, hostArch, hostPlatform, initialState, runtime]);

  return state;
}
