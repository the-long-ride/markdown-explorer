import { describe, it, expect } from 'vitest';
import {
  normalizeVersion,
  parseVersion,
  compareVersions,
  getDesktopAssetScore,
  pickDesktopDownloadUrl,
  getDownloadUrl,
  CHANGELOG_URL,
  VSCODE_MARKETPLACE_URL,
} from '../../../../ui/src/hooks/useUpdateCheck';
import type { GitHubRelease } from '../../../../ui/src/hooks/useUpdateCheck';

describe('useUpdateCheck pure functions', () => {
  describe('normalizeVersion', () => {
    it('strips v prefix', () => {
      expect(normalizeVersion('v1.2.3')).toBe('1.2.3');
    });

    it('strips V prefix', () => {
      expect(normalizeVersion('V2.0.0')).toBe('2.0.0');
    });

    it('trims whitespace', () => {
      expect(normalizeVersion(' 1.0.0 ')).toBe('1.0.0');
    });

    it('splits on + and takes first part', () => {
      expect(normalizeVersion('1.0.0+build123')).toBe('1.0.0');
    });

    it('splits on - and takes first part', () => {
      expect(normalizeVersion('1.0.0-beta')).toBe('1.0.0');
    });

    it('passes through normal semver', () => {
      expect(normalizeVersion('1.2.3')).toBe('1.2.3');
    });
  });

  describe('parseVersion', () => {
    it('parses major.minor.patch', () => {
      expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    });

    it('parses major only', () => {
      expect(parseVersion('5')).toEqual([5, 0, 0]);
    });

    it('parses major.minor', () => {
      expect(parseVersion('5.3')).toEqual([5, 3, 0]);
    });

    it('returns null for unparsable', () => {
      expect(parseVersion('abc')).toBeNull();
    });

    it('handles v prefix via normalizeVersion', () => {
      expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    });
  });

  describe('compareVersions', () => {
    it('returns negative when left < right', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    });

    it('returns positive when left > right', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    });

    it('returns 0 for equal versions', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('compares major first', () => {
      expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    });

    it('compares minor second', () => {
      expect(compareVersions('1.3.0', '1.2.9')).toBeGreaterThan(0);
    });

    it('compares patch third', () => {
      expect(compareVersions('1.2.4', '1.2.3')).toBeGreaterThan(0);
    });

    it('handles different length versions', () => {
      expect(compareVersions('1.2', '1.2.0')).toBe(0);
    });

    it('falls back to string equality for unparseable', () => {
      expect(compareVersions('abc', 'abc')).toBe(0);
    });

    it('returns 1 for different unparseable versions', () => {
      expect(compareVersions('abc', 'def')).toBe(1);
    });
  });

  describe('getDesktopAssetScore', () => {
    it('gives high score for Windows .exe with setup/installer', () => {
      const score = getDesktopAssetScore('markdown-explorer-setup-1.0.0.exe', 'windows', 'x64');
      expect(score).toBeGreaterThanOrEqual(30);
    });

    it('gives moderate score for Windows .exe without setup', () => {
      const score = getDesktopAssetScore('markdown-explorer-1.0.0.exe', 'windows', 'x64');
      expect(score).toBe(18);
    });

    it('gives lower score for Windows .zip', () => {
      const score = getDesktopAssetScore('markdown-explorer-1.0.0.zip', 'windows', 'x64');
      expect(score).toBe(12);
    });

    it('gives high score for Linux .AppImage', () => {
      const score = getDesktopAssetScore('markdown-explorer-1.0.0.AppImage', 'linux', 'x64');
      expect(score).toBe(20);
    });

    it('gives lower score for Linux .deb', () => {
      const score = getDesktopAssetScore('markdown-explorer-1.0.0.deb', 'linux', 'x64');
      expect(score).toBe(12);
    });

    it('gives high score for macOS .dmg', () => {
      const score = getDesktopAssetScore('markdown-explorer-1.0.0.dmg', 'macos', 'arm64');
      expect(score).toBe(20);
    });

    it('gives lower score for macOS .zip', () => {
      const score = getDesktopAssetScore('markdown-explorer-1.0.0.zip', 'macos', 'arm64');
      expect(score).toBe(10);
    });

    it('adds arch bonus for matching arch', () => {
      const armScore = getDesktopAssetScore('markdown-explorer-arm64-1.0.0.dmg', 'macos', 'arm64');
      const noArchScore = getDesktopAssetScore('markdown-explorer-1.0.0.dmg', 'macos', '');
      expect(armScore).toBeGreaterThan(noArchScore);
    });

    it('adds x64/amd64 arch bonus', () => {
      const score = getDesktopAssetScore('markdown-explorer-amd64-1.0.0.deb', 'linux', 'x64');
      expect(score).toBeGreaterThanOrEqual(20);
    });

    it('returns 0 for non-matching assets', () => {
      expect(getDesktopAssetScore('readme.txt', 'windows', 'x64')).toBe(0);
    });
  });

  describe('pickDesktopDownloadUrl', () => {
    const assets = [
      { name: 'app-setup-1.0.0.exe', browser_download_url: 'https://example.com/setup.exe' },
      { name: 'app-1.0.0.zip', browser_download_url: 'https://example.com/app.zip' },
      { name: 'source.tar.gz', browser_download_url: 'https://example.com/source.tar.gz' },
    ];

    it('picks highest-scoring asset', () => {
      const url = pickDesktopDownloadUrl(assets, 'windows', 'x64');
      expect(url).toBe('https://example.com/setup.exe');
    });

    it('returns undefined for no matching assets', () => {
      const url = pickDesktopDownloadUrl(assets, 'linux', 'x64');
      expect(url).toBeUndefined();
    });

    it('skips assets with no download URL', () => {
      const noUrlAssets = [{ name: 'app-setup-1.0.0.exe' }];
      const url = pickDesktopDownloadUrl(noUrlAssets, 'windows', 'x64');
      expect(url).toBeUndefined();
    });

    it('handles empty assets array', () => {
      expect(pickDesktopDownloadUrl([], 'windows', 'x64')).toBeUndefined();
    });
  });

  describe('getDownloadUrl', () => {
    it('returns marketplace URL for vscode', () => {
      const release: GitHubRelease = {};
      const url = getDownloadUrl(release, 'vscode', 'windows', 'x64');
      expect(url).toBe(VSCODE_MARKETPLACE_URL);
    });

    it('returns asset URL for desktop', () => {
      const release: GitHubRelease = {
        assets: [{ name: 'app-setup-1.0.0.exe', browser_download_url: 'https://example.com/setup.exe' }],
        html_url: 'https://github.com/release',
      };
      const url = getDownloadUrl(release, 'desktop', 'windows', 'x64');
      expect(url).toBe('https://example.com/setup.exe');
    });

    it('falls back to html_url for desktop', () => {
      const release: GitHubRelease = {
        html_url: 'https://github.com/release',
      };
      const url = getDownloadUrl(release, 'desktop', 'linux', 'x64');
      expect(url).toBe('https://github.com/release');
    });

    it('falls back to RELEASE_FALLBACK_URL for desktop', () => {
      const release: GitHubRelease = {};
      const url = getDownloadUrl(release, 'desktop', 'windows', 'x64');
      expect(url).toContain('github.com');
    });

    it('handles undefined assets', () => {
      const release: GitHubRelease = { html_url: 'https://github.com/release' };
      const url = getDownloadUrl(release, 'desktop', 'windows', 'x64');
      expect(url).toBe('https://github.com/release');
    });
  });

  describe('constants', () => {
    it('CHANGELOG_URL is a valid URL', () => {
      expect(CHANGELOG_URL).toContain('github.com');
    });

    it('VSCODE_MARKETPLACE_URL is a valid URL', () => {
      expect(VSCODE_MARKETPLACE_URL).toContain('marketplace.visualstudio.com');
    });
  });
});
