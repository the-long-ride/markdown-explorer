import { describe, expect, it } from 'vitest';
import { compareVersions, getDesktopAssetScore, isInstallableDesktopAsset, parseVersion } from '../../../../ui/src/hooks/useUpdateCheck';

describe('update asset scoring per runtime', () => {
  it('prefers tauri assets for the tauri runtime and electron for desktop', () => {
    expect(getDesktopAssetScore('app-tauri-setup.exe', 'windows', 'x64', 'tauri')).toBeGreaterThan(getDesktopAssetScore('app-electron-setup.exe', 'windows', 'x64', 'tauri'));
    expect(getDesktopAssetScore('app-electron-amd64.deb', 'linux', 'x64', 'desktop')).toBeGreaterThan(getDesktopAssetScore('app-tauri.deb', 'linux', 'x64', 'desktop'));
    expect(getDesktopAssetScore('app.zip', 'windows', '', 'vscode' as any)).toBe(12);
  });

  it('only installs matching windows setup executables', () => {
    expect(isInstallableDesktopAsset('app-tauri-setup.exe', 'windows', 'tauri')).toBe(true);
    expect(isInstallableDesktopAsset('app-tauri-electron-setup.exe', 'windows', 'tauri')).toBe(false);
    expect(isInstallableDesktopAsset('app-tauri-setup.exe', 'windows', 'desktop')).toBe(false);
    expect(isInstallableDesktopAsset('app-setup.exe', 'windows', 'vscode' as any)).toBe(false);
    expect(isInstallableDesktopAsset('app.exe', 'windows', 'desktop')).toBe(false);
    expect(isInstallableDesktopAsset('app-setup.msi', 'windows', 'desktop')).toBe(false);
    expect(isInstallableDesktopAsset('app-setup.exe', 'linux', 'desktop')).toBe(false);
  });

  it('compares versions of different lengths', () => {
    expect(compareVersions('1.2', '1.2.1')).toBeLessThan(0);
    expect(parseVersion('garbage')).toBeDefined();
  });
});
