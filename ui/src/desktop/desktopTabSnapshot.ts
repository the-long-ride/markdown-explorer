import type { AppState } from '../contexts/AppStateContext';
import type { DesktopTab, WorkspaceAliasMap } from '../desktop/types';

export function snapshotDesktopTab(
  state: AppState,
  tab: DesktopTab,
  activeTabId: string,
  workspaceAliases: WorkspaceAliasMap,
): DesktopTab {
  const nextWorkspacePath = state.workspacePath || tab.workspacePath;
  const sameWorkspace =
    !tab.workspacePath || !nextWorkspacePath || tab.workspacePath === nextWorkspacePath;
  const savedAlias = nextWorkspacePath ? workspaceAliases[nextWorkspacePath] : undefined;
  const preserveRestoredSelection = sameWorkspace && state.isLoading && !state.currentFile;

  return {
    ...tab,
    kind: state.workspaceName ? 'workspace' : tab.kind,
    alias: savedAlias ?? (sameWorkspace ? tab.alias : undefined),
    workspaceName: state.workspaceName || tab.workspaceName,
    workspacePath: nextWorkspacePath,
    fileList: state.fileList,
    tree: state.tree,
    currentFile: preserveRestoredSelection ? tab.currentFile : state.currentFile,
    contentHtml: state.contentHtml,
    markdownSource: state.markdownSource,
    sourceDocumentText: state.sourceDocumentText,
    frontmatter: state.frontmatter,
    toc: state.toc,
    previewInfo: state.previewInfo,
    relativePath: state.relativePath,
    isLoading: state.isLoading,
    notFoundHref: state.notFoundHref,
    workspaceUnavailablePath: state.workspaceUnavailablePath,
    workspaceUnavailableReason: state.workspaceUnavailableReason,
    contentTabs: preserveRestoredSelection && state.contentTabs.length === 0 ? tab.contentTabs : state.contentTabs,
    activeContentTabPath: preserveRestoredSelection ? tab.activeContentTabPath : state.activeContentTabPath,
    isIndexed: tab.isIndexed || (tab.id === activeTabId && !state.isLoading),
    workspaceLoadState: state.workspaceName && !state.isLoading && !state.isWorkspaceScanning ? 'ready' : tab.workspaceLoadState,
  };
}
