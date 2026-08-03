import type { FolderNode, MdFile } from '../../ui/src/types';

declare const chrome: { runtime: { getManifest(): { version: string } } };

export function getHostInfo() {
  return { appVersion: chrome.runtime.getManifest().version, appRuntime: 'chrome' as const,
    hostPlatform: 'unknown' as const, hostArch: 'unknown' };
}

export function normalizeSearchQuery(query: unknown, matchCase = false): string {
  const trimmed = String(query || '').trim();
  return matchCase ? trimmed : trimmed.toLowerCase();
}

export function filterSearchIndexTabs(tabRequests: unknown[], activeWorkspacePath: string): Array<{
  tabId: string; workspacePath: string; fileList: MdFile[]; tree: FolderNode | null;
}> {
  return (Array.isArray(tabRequests) ? tabRequests : []).flatMap((tab: any) => {
    const tabId = String(tab?.tabId || '');
    const workspacePath = String(tab?.workspacePath || '');
    return !tabId || !workspacePath || !activeWorkspacePath || workspacePath !== activeWorkspacePath ? []
      : [{ tabId, workspacePath: activeWorkspacePath, fileList: [], tree: null }];
  });
}

export function isValidExternalUrl(url: unknown): boolean {
  return typeof url === 'string' && /^(?:https?|file):\/\//i.test(url);
}

export function extractWorkspaceName(workspacePath: string): string {
  return workspacePath.split('/').pop() || 'Workspace';
}

export function findFileInfo(flatList: MdFile[], relativePath: string): { relativePath: string; title: string } {
  return flatList.find((file) => file.relativePath === relativePath)
    || { relativePath, title: relativePath.split('/').pop() || 'Untitled' };
}

export function shouldOpenFirstFile(currentFile: string | null, openFirstFile: boolean | undefined, flatList: MdFile[]): string | null {
  return openFirstFile !== false && !currentFile && flatList.length > 0 ? flatList[0].relativePath : currentFile;
}

export function resolveWorkspaceTextResourcePath(documentPath: string, resourcePath: string): string | null {
  const reference = resourcePath.split(/[?#]/, 1)[0];
  if (!reference || /^(?:https?:|data:|blob:|javascript:|file:)/i.test(reference)) return null;
  const parts = reference.startsWith('/') ? [] : documentPath.split('/').slice(0, -1).filter(Boolean);
  for (const part of reference.replace(/^\/+/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) return null; parts.pop(); }
    else parts.push(part);
  }
  const resolved = parts.join('/');
  return /\.(?:css|js|mjs|cjs)$/i.test(resolved) ? resolved : null;
}

export function createEmptyWorkspaceReadyAck(
  recentWorkspaces: unknown[],
  operation: Record<string, unknown> = {},
) {
  return {
    command: 'readyAck', fileList: [], tree: null, theme: 'dark', themeStyle: 'default',
    defaultExpanded: true, workspaceName: '', workspacePath: undefined, recentWorkspaces,
    documentConversionEnabled: false, ...getHostInfo(), ...operation,
  };
}

export function createWelcomeMessage(fileList: MdFile[], operation: Record<string, unknown> = {}) {
  return { command: 'renderContent', html: '', markdownSource: '', frontmatter: {}, toc: [],
    filePath: '', relativePath: 'Welcome Page', title: 'Welcome', fileList,
    previewInfo: null, ...operation };
}
