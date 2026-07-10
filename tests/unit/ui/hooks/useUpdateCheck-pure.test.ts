import { describe, it, expect } from 'vitest';
import {
  normalizeVersion,
  parseVersion,
  compareVersions,
  getDesktopAssetScore,
  isInstallableDesktopAsset,
  pickDesktopDownloadUrl,
  pickInstallableDesktopDownloadUrl,
  getDownloadUrl,
  getInstallableDownloadUrl,
} from '../../../../ui/src/hooks/useUpdateCheck';

describe('normalizeVersion', () => {
  it('removes leading v', () => {
    expect(normalizeVersion('v1.0.0')).toBe('1.0.0');
  });

  it('removes leading V', () => {
    expect(normalizeVersion('V2.3.4')).toBe('2.3.4');
  });

  it('returns same when no leading v', () => {
    expect(normalizeVersion('1.0.0')).toBe('1.0.0');
  });

  it('strips anything after + (build metadata)', () => {
    expect(normalizeVersion('v1.0.0+build123')).toBe('1.0.0');
  });

  it('strips anything after - (pre-release)', () => {
    expect(normalizeVersion('v2.0.0-alpha')).toBe('2.0.0');
  });

  it('trims whitespace', () => {
    expect(normalizeVersion('  v1.0.0  ')).toBe('1.0.0');
  });

  it('handles empty string', () => {
    expect(normalizeVersion('')).toBe('');
  });

  it('handles non-standard input', () => {
    expect(normalizeVersion('  latest  ')).toBe('latest');
  });
});

describe('parseVersion', () => {
  it('parses x.y.z', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
  });

  it('parses v-prefixed version', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
  });

  it('parses two-part version, filling missing with 0', () => {
    expect(parseVersion('1.2')).toEqual([1, 2, 0]);
  });

  it('parses single-part version, filling missing with 0', () => {
    expect(parseVersion('v1')).toEqual([1, 0, 0]);
  });

  it('returns null for non-numeric versions', () => {
    expect(parseVersion('latest')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseVersion('')).toBeNull();
  });

  it('strips pre-release and build metadata', () => {
    expect(parseVersion('1.0.0-alpha+build')).toEqual([1, 0, 0]);
  });
});

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns positive when left > right', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
  });

  it('returns negative when left < right', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('compares major version', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('3.0.0', '2.0.0')).toBe(1);
  });

  it('compares minor version when major is equal', () => {
    expect(compareVersions('1.2.0', '1.3.0')).toBe(-1);
    expect(compareVersions('1.3.0', '1.2.0')).toBe(1);
  });

  it('compares patch version when major and minor are equal', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
  });

  it('handles v prefix', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
  });

  it('handles missing patch numbers (treats missing as 0)', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
    expect(compareVersions('1.2.1', '1.2')).toBe(1);
  });

  it('handles non-parsable strings by normalizing and using string equality', () => {
    expect(compareVersions('latest', 'latest')).toBe(0);
    expect(compareVersions('latest', 'beta')).toBe(1);
  });

  it('handles one non-parsable and one parsable', () => {
    // Since 'abc' cannot be parsed, it falls back to string compare
    expect(compareVersions('abc', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', 'abc')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(compareVersions('', '')).toBe(0);
    expect(compareVersions('', '1.0.0')).toBe(1);
  });
});

describe('getDesktopAssetScore', () => {
  describe('windows', () => {
    it('gives high score for setup exe', () => {
      const score = getDesktopAssetScore('app-setup.exe', 'windows', 'x64');
      expect(score).toBeGreaterThan(0);
    });

    it('gives medium score for non-setup exe', () => {
      const setupScore = getDesktopAssetScore('app-setup.exe', 'windows', 'x64');
      const plainScore = getDesktopAssetScore('app.exe', 'windows', 'x64');
      expect(plainScore).toBeGreaterThan(0);
      expect(plainScore).toBeLessThanOrEqual(setupScore);
    });

    it('gives score for zip on windows', () => {
      expect(getDesktopAssetScore('app.zip', 'windows', 'x64')).toBeGreaterThan(0);
    });

    it('gives no score for non-windows file on windows', () => {
      expect(getDesktopAssetScore('app.deb', 'windows', 'x64')).toBe(0);
    });
  });

  describe('linux', () => {
    it('gives score for appimage', () => {
      expect(getDesktopAssetScore('app.AppImage', 'linux', 'x64')).toBeGreaterThan(0);
    });

    it('gives score for deb', () => {
      expect(getDesktopAssetScore('app.deb', 'linux', 'x64')).toBeGreaterThan(0);
    });

    it('gives no score for non-linux file on linux', () => {
      expect(getDesktopAssetScore('app.exe', 'linux', 'x64')).toBe(0);
    });
  });

  describe('macos', () => {
    it('gives score for dmg', () => {
      expect(getDesktopAssetScore('app.dmg', 'macos', 'x64')).toBeGreaterThan(0);
    });

    it('gives score for zip', () => {
      expect(getDesktopAssetScore('app.zip', 'macos', 'x64')).toBeGreaterThan(0);
    });

    it('gives no score for non-macos file on macos', () => {
      expect(getDesktopAssetScore('app.exe', 'macos', 'x64')).toBe(0);
    });
  });

  describe('architecture matching', () => {
    it('adds score when arch is in filename', () => {
      const x64Score = getDesktopAssetScore('app-x64.exe', 'windows', 'x64');
      const armScore = getDesktopAssetScore('app-arm64.exe', 'windows', 'x64');
      expect(x64Score).toBeGreaterThan(armScore);
    });

    it('adds score for amd64 when arch is x64', () => {
      const amd64Score = getDesktopAssetScore('app-amd64.exe', 'windows', 'x64');
      const plainScore = getDesktopAssetScore('app.exe', 'windows', 'x64');
      expect(amd64Score).toBeGreaterThan(plainScore);
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase extensions', () => {
      expect(getDesktopAssetScore('app.APP', 'linux', 'x64')).toBe(0);
      expect(getDesktopAssetScore('app.AppImage', 'linux', 'x64')).toBeGreaterThan(0);
    });
  });

  describe('runtime asset prefixes', () => {
    it('prefers Electron assets for Electron desktop runtime', () => {
      const electronScore = getDesktopAssetScore('electron-Markdown Explorer Setup.exe', 'windows', 'x64', 'desktop');
      const tauriScore = getDesktopAssetScore('tauri-Markdown Explorer Setup.exe', 'windows', 'x64', 'desktop');
      expect(electronScore).toBeGreaterThan(tauriScore);
    });

    it('prefers Tauri assets for Tauri runtime', () => {
      const electronScore = getDesktopAssetScore('electron-Markdown Explorer Setup.exe', 'windows', 'x64', 'tauri');
      const tauriScore = getDesktopAssetScore('tauri-Markdown Explorer Setup.exe', 'windows', 'x64', 'tauri');
      expect(tauriScore).toBeGreaterThan(electronScore);
    });
  });
});

describe('pickDesktopDownloadUrl', () => {
  it('returns best matching asset url', () => {
    const assets = [
      { name: 'app-x64.exe', browser_download_url: 'http://example.com/app-x64.exe' },
      { name: 'app-x64.zip', browser_download_url: 'http://example.com/app-x64.zip' },
      { name: 'app.dmg', browser_download_url: 'http://example.com/app.dmg' },
    ];
    const url = pickDesktopDownloadUrl(assets, 'windows', 'x64');
    expect(url).toBe('http://example.com/app-x64.exe');
  });

  it('returns undefined when no assets match', () => {
    const assets = [
      { name: 'app.dmg', browser_download_url: 'http://example.com/app.dmg' },
    ];
    const url = pickDesktopDownloadUrl(assets, 'windows', 'x64');
    expect(url).toBeUndefined();
  });

  it('returns undefined for empty assets array', () => {
    const url = pickDesktopDownloadUrl([], 'windows', 'x64');
    expect(url).toBeUndefined();
  });

  it('prefers setup exe over plain exe', () => {
    const assets = [
      { name: 'app.exe', browser_download_url: 'http://example.com/app.exe' },
      { name: 'app-setup.exe', browser_download_url: 'http://example.com/app-setup.exe' },
    ];
    const url = pickDesktopDownloadUrl(assets, 'windows', 'x64');
    expect(url).toBe('http://example.com/app-setup.exe');
  });

  it('skips assets without browser_download_url', () => {
    const assets = [
      { name: 'app.exe' },
      { name: 'app-setup.exe', browser_download_url: 'http://example.com/app-setup.exe' },
    ];
    const url = pickDesktopDownloadUrl(assets, 'windows', 'x64');
    expect(url).toBe('http://example.com/app-setup.exe');
  });

  it('picks Electron installer over Tauri installer for Electron desktop', () => {
    const assets = [
      { name: 'tauri-Markdown Explorer Setup.exe', browser_download_url: 'http://example.com/tauri.exe' },
      { name: 'electron-Markdown Explorer Setup.exe', browser_download_url: 'http://example.com/electron.exe' },
    ];
    const url = pickDesktopDownloadUrl(assets, 'windows', 'x64', 'desktop');
    expect(url).toBe('http://example.com/electron.exe');
  });
});

describe('installable desktop download selection', () => {
  const releaseAssets = [
    {
      name: 'electron-Markdown Explorer Portable.exe',
      browser_download_url: 'http://example.com/electron-portable.exe',
    },
    {
      name: 'electron-Markdown Explorer.zip',
      browser_download_url: 'http://example.com/electron.zip',
    },
    {
      name: 'tauri-Markdown Explorer Setup.exe',
      browser_download_url: 'http://example.com/tauri-setup.exe',
    },
    {
      name: 'electron-Markdown Explorer Setup.exe',
      browser_download_url: 'http://example.com/electron-setup.exe',
    },
  ];

  it('marks only matching Windows installer assets as installable for Electron', () => {
    expect(isInstallableDesktopAsset('electron-Markdown Explorer Setup.exe', 'windows', 'desktop')).toBe(true);
    expect(isInstallableDesktopAsset('electron-Markdown Explorer Portable.exe', 'windows', 'desktop')).toBe(false);
    expect(isInstallableDesktopAsset('electron-Markdown Explorer.zip', 'windows', 'desktop')).toBe(false);
    expect(isInstallableDesktopAsset('tauri-Markdown Explorer Setup.exe', 'windows', 'desktop')).toBe(false);
  });

  it('picks Electron Windows setup for current Electron Windows app', () => {
    expect(pickInstallableDesktopDownloadUrl(releaseAssets, 'windows', 'x64', 'desktop'))
      .toBe('http://example.com/electron-setup.exe');
  });

  it('picks Tauri Windows setup for current Tauri Windows app', () => {
    expect(pickInstallableDesktopDownloadUrl(releaseAssets, 'windows', 'x64', 'tauri'))
      .toBe('http://example.com/tauri-setup.exe');
  });

  it('returns no installable URL when only portable or archive assets exist', () => {
    const assets = [
      { name: 'electron-Markdown Explorer Portable.exe', browser_download_url: 'http://example.com/portable.exe' },
      { name: 'electron-Markdown Explorer.zip', browser_download_url: 'http://example.com/app.zip' },
    ];
    expect(pickInstallableDesktopDownloadUrl(assets, 'windows', 'x64', 'desktop')).toBeUndefined();
  });
});

describe('getDownloadUrl', () => {
  it('returns vscode marketplace url for vscode runtime', () => {
    const url = getDownloadUrl({}, 'vscode', 'windows', 'x64');
    expect(url).toBe('https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer');
  });

  it('returns picked asset url for desktop runtime', () => {
    const release = {
      assets: [
        { name: 'app-setup.exe', browser_download_url: 'http://example.com/app-setup.exe' },
      ],
      html_url: 'http://example.com/release',
    };
    const url = getDownloadUrl(release, 'desktop', 'windows', 'x64');
    expect(url).toBe('http://example.com/app-setup.exe');
  });

  it('falls back to release html_url when no assets match', () => {
    const release = {
      assets: [{ name: 'app.dmg', browser_download_url: 'http://example.com/app.dmg' }],
      html_url: 'http://example.com/release',
    };
    const url = getDownloadUrl(release, 'desktop', 'windows', 'x64');
    expect(url).toBe('http://example.com/release');
  });

  it('falls back to release fallback url when no assets and no html_url', () => {
    const release = { assets: [] };
    const url = getDownloadUrl(release, 'desktop', 'windows', 'x64');
    expect(url).toBe('https://github.com/the-long-ride/markdown-explorer/releases/latest');
  });

  it('handles missing assets array', () => {
    const release = { html_url: 'http://example.com/release' };
    const url = getDownloadUrl(release, 'desktop', 'windows', 'x64');
    expect(url).toBe('http://example.com/release');
  });

});

describe('getInstallableDownloadUrl', () => {
  it('returns Electron setup URL for Electron Windows release assets', () => {
    const release = {
      assets: [
        { name: 'electron-Markdown Explorer Portable.exe', browser_download_url: 'http://example.com/portable.exe' },
        { name: 'electron-Markdown Explorer Setup.exe', browser_download_url: 'http://example.com/setup.exe' },
      ],
    };
    expect(getInstallableDownloadUrl(release, 'desktop', 'windows', 'x64')).toBe('http://example.com/setup.exe');
  });

  it('returns undefined for vscode runtime', () => {
    const release = {
      assets: [
        { name: 'electron-Markdown Explorer Setup.exe', browser_download_url: 'http://example.com/setup.exe' },
      ],
    };
    expect(getInstallableDownloadUrl(release, 'vscode', 'windows', 'x64')).toBeUndefined();
  });
});
