import type { PlatformBridge } from '../platform/bridge';
import type { AppRuntime, HostPlatform, ShellLocationMode } from '../types';
import type { Translations } from '../contexts/translations';

export type ShellLocationTargetKind = 'file' | 'folder';

export function supportsShellLocation(runtime: AppRuntime): boolean {
  return runtime === 'desktop' || runtime === 'tauri';
}

export function getShellLocationLabel(
  translations: Translations,
  platform: HostPlatform,
  targetKind: ShellLocationTargetKind,
): string {
  if (platform === 'macos') {
    return targetKind === 'file'
      ? translations.tabContextMenu.revealInFinder
      : translations.tabContextMenu.openInFinder;
  }
  if (platform === 'windows') return translations.tabContextMenu.showInFileExplorer;
  return translations.tabContextMenu.showInFileManager;
}


export function resolveWorkspaceFolderPath(
  workspacePath: string,
  relativeFolderPath: string,
  platform: HostPlatform,
): string {
  const separator = platform === 'windows' ? '\\' : '/';
  const root = workspacePath.replace(/[\\/]+$/, '');
  const relative = relativeFolderPath
    .replace(/[\\/]+/g, separator)
    .replace(/^[\\/]+/, '');
  return relative ? `${root}${separator}${relative}` : root;
}

export function requestShellLocation(
  bridge: PlatformBridge,
  targetPath: string,
  mode: ShellLocationMode,
): void {
  if (!targetPath) return;
  bridge.postMessage({ command: 'openShellLocation', path: targetPath, mode });
}
