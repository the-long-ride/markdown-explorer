import type { Translations } from '../../contexts/translationTypes';

export type ShortcutMission = 'application' | 'document' | 'documentTabs' | 'navigation' | 'search' | 'view';
export type ShortcutScope = 'both' | 'non-vscode' | 'desktop' | 'electron' | 'editor';

export interface ShortcutAction {
  id: string;
  label: string;
  scope: ShortcutScope;
  mission: ShortcutMission;
}

export const ACTIONS_LIST: ShortcutAction[] = [
  // Navigation & Workspace
  { id: 'welcome', label: 'Go to welcome page', scope: 'both', mission: 'navigation' },
  { id: 'workspaceSelection', label: 'Go to workspace selection', scope: 'non-vscode', mission: 'navigation' },
  { id: 'back', label: 'Back to previous file', scope: 'both', mission: 'navigation' },
  { id: 'forward', label: 'Go to next file', scope: 'both', mission: 'navigation' },
  { id: 'locateFile', label: 'Locate current open file in sidebar', scope: 'both', mission: 'navigation' },
  { id: 'openCurrentDocumentLocation', label: 'Open current document folder', scope: 'electron', mission: 'document' },
  { id: 'refresh', label: 'Refresh current file', scope: 'both', mission: 'document' },

  // Search & Find
  { id: 'findCurrentFile', label: 'Find in current file', scope: 'both', mission: 'search' },
  { id: 'searchCurrent', label: 'Search current workspace', scope: 'both', mission: 'search' },
  { id: 'searchAllTabs', label: 'Search all tabs', scope: 'desktop', mission: 'search' },

  // View & Panels
  { id: 'toggleSidebar', label: 'Toggle sidebar visibility', scope: 'both', mission: 'view' },
  { id: 'openBookmarks', label: 'Open Bookmarks tab', scope: 'both', mission: 'view' },
  { id: 'toggleToc', label: 'Toggle table of contents panel', scope: 'both', mission: 'view' },
  { id: 'toggleWorkspaceInsights', label: 'Toggle workspace insights panel', scope: 'desktop', mission: 'view' },
  { id: 'toggleFocusMode', label: 'Toggle focus mode', scope: 'both', mission: 'view' },
  { id: 'sidebarCursorMode', label: 'Sidebar cursor mode', scope: 'both', mission: 'view' },
  { id: 'toggleDesktopViewMode', label: 'Toggle Tabs/Focus view', scope: 'electron', mission: 'view' },
  { id: 'toggleHtmlPreview', label: 'Toggle default HTML preview', scope: 'both', mission: 'view' },
  { id: 'zoomIn', label: 'Zoom in', scope: 'electron', mission: 'view' },
  { id: 'zoomOut', label: 'Zoom out', scope: 'electron', mission: 'view' },
  { id: 'resetZoom', label: 'Reset zoom', scope: 'electron', mission: 'view' },

  // Headings & Structure
  { id: 'collapseAll', label: 'Collapse all headings', scope: 'desktop', mission: 'document' },
  { id: 'expandAll', label: 'Expand all headings', scope: 'desktop', mission: 'document' },

  // Tab Management
  { id: 'closeContentTab', label: 'Close current document tab', scope: 'electron', mission: 'documentTabs' },
  { id: 'closeOtherContentTabs', label: 'Close other document tabs', scope: 'electron', mission: 'documentTabs' },
  { id: 'closeContentTabsToRight', label: 'Close document tabs to the right', scope: 'electron', mission: 'documentTabs' },
  { id: 'closeAllContentTabs', label: 'Close all document tabs', scope: 'electron', mission: 'documentTabs' },

  // General & Settings
  { id: 'saveCurrentDocument', label: 'Save current document', scope: 'both', mission: 'document' },
  { id: 'editCurrentDocument', label: 'Edit current document', scope: 'editor', mission: 'document' },
  { id: 'settings', label: 'Toggle settings modal', scope: 'both', mission: 'application' },
  { id: 'toggleTheme', label: 'Toggle light/dark mode', scope: 'both', mission: 'application' },
];


export function getLocalizedShortcutActionLabel(
  t: Translations,
  actionId: string,
  fallback: string,
): string {
  switch (actionId) {
    case 'sidebarCursorMode': return t.ui.sidebarCursorMode;
    case 'resetZoom': return t.tooltips.resetZoom;
    case 'closeContentTab': return t.tabContextMenu.closeThisTab;
    case 'closeContentTabsToRight': return t.tabContextMenu.closeTabsToRight;
    case 'closeOtherContentTabs': return t.tabContextMenu.closeOtherTabs;
    case 'closeAllContentTabs': return t.tabContextMenu.closeAllTabs;
    default:
      return (t.actions as Record<string, string | undefined>)[actionId] ?? fallback;
  }
}

export function getLocalizedShortcutActionLabels(t: Translations): Record<string, string> {
  return Object.fromEntries(
    ACTIONS_LIST.map((action) => [action.id, getLocalizedShortcutActionLabel(t, action.id, action.label)]),
  );
}
