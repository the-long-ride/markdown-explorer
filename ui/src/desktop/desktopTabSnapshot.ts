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

  return {
    ...tab,
    kind: state.workspaceName ? 'workspace' : tab.kind,
    alias: savedAlias ?? (sameWorkspace ? tab.alias : undefined),
    workspaceName: state.workspaceName || tab.workspaceName,
    workspacePath: nextWorkspacePath,
    fileList: state.fileList,
    tree: state.tree,
    currentFile: state.currentFile,
    contentHtml: state.contentHtml,
    markdownSource: state.markdownSource,
    frontmatter: state.frontmatter,
    toc: state.toc,
    previewInfo: state.previewInfo,
    relativePath: state.relativePath,
    isLoading: state.isLoading,
    notFoundHref: state.notFoundHref,
    workspaceUnavailablePath: state.workspaceUnavailablePath,
    workspaceUnavailableReason: state.workspaceUnavailableReason,
    contentTabs: state.contentTabs,
    activeContentTabPath: state.activeContentTabPath,
    isIndexed: tab.isIndexed || (tab.id === activeTabId && !state.isLoading),
  };
}
