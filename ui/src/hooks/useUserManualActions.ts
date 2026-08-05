import { useEffect } from 'react';

interface UserManualActionsArgs {
  readonly isTabView: boolean;
  readonly createNewWorkspaceTab: () => void;
  readonly closeWorkspaceToSelection: () => void;
  readonly openSidebarSearch: () => void;
  readonly openSidebarBookmarks: () => void;
  readonly openSettings: () => void;
}

export function useUserManualActions({
  isTabView,
  createNewWorkspaceTab,
  closeWorkspaceToSelection,
  openSidebarSearch,
  openSidebarBookmarks,
  openSettings,
}: UserManualActionsArgs): void {
  useEffect(() => {
    const openWorkspace = () => {
      if (isTabView) createNewWorkspaceTab();
      else closeWorkspaceToSelection();
    };
    window.addEventListener('open-workspace-selection', openWorkspace);
    window.addEventListener('open-sidebar-search', openSidebarSearch);
    window.addEventListener('open-bookmarks', openSidebarBookmarks);
    window.addEventListener('open-settings', openSettings);
    return () => {
      window.removeEventListener('open-workspace-selection', openWorkspace);
      window.removeEventListener('open-sidebar-search', openSidebarSearch);
      window.removeEventListener('open-bookmarks', openSidebarBookmarks);
      window.removeEventListener('open-settings', openSettings);
    };
  }, [closeWorkspaceToSelection, createNewWorkspaceTab, isTabView, openSettings, openSidebarBookmarks, openSidebarSearch]);
}
