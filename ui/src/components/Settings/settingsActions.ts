import type { Translations } from '../../contexts/translationTypes';

export const ACTIONS_LIST = [
  // Navigation & Workspace
  { id: 'welcome', label: 'Go to welcome page', scope: 'both' },
  { id: 'workspaceSelection', label: 'Go to workspace selection', scope: 'non-vscode' },
  { id: 'back', label: 'Back to previous file', scope: 'both' },
  { id: 'forward', label: 'Go to next file', scope: 'both' },
  { id: 'locateFile', label: 'Locate current open file in sidebar', scope: 'both' },
  { id: 'openCurrentDocumentLocation', label: 'Open current document folder', scope: 'electron' },
  { id: 'refresh', label: 'Refresh current file', scope: 'both' },

  // Search & Find
  { id: 'findCurrentFile', label: 'Find in current file', scope: 'both' },
  { id: 'searchCurrent', label: 'Search current workspace', scope: 'both' },
  { id: 'searchAllTabs', label: 'Search all tabs', scope: 'desktop' },

  // View & Panels
  { id: 'toggleSidebar', label: 'Toggle sidebar visibility', scope: 'both' },
  { id: 'openBookmarks', label: 'Open Bookmarks tab', scope: 'both' },
  { id: 'toggleToc', label: 'Toggle table of contents panel', scope: 'both' },
  { id: 'toggleWorkspaceInsights', label: 'Toggle workspace insights panel', scope: 'both' },
  { id: 'toggleFocusMode', label: 'Toggle focus mode', scope: 'both' },
  { id: 'sidebarCursorMode', label: 'Sidebar cursor mode', scope: 'both' },
  { id: 'toggleDesktopViewMode', label: 'Toggle Tabs/Focus view', scope: 'electron' },
  { id: 'toggleHtmlPreview', label: 'Toggle default HTML preview', scope: 'both' },
  { id: 'zoomIn', label: 'Zoom in', scope: 'electron' },
  { id: 'zoomOut', label: 'Zoom out', scope: 'electron' },
  { id: 'resetZoom', label: 'Reset zoom', scope: 'electron' },

  // Headings & Structure
  { id: 'collapseAll', label: 'Collapse all headings', scope: 'desktop' },
  { id: 'expandAll', label: 'Expand all headings', scope: 'desktop' },

  // Tab Management
  { id: 'closeContentTab', label: 'Close current document tab', scope: 'electron' },
  { id: 'closeOtherContentTabs', label: 'Close other document tabs', scope: 'electron' },
  { id: 'closeContentTabsToRight', label: 'Close document tabs to the right', scope: 'electron' },
  { id: 'closeAllContentTabs', label: 'Close all document tabs', scope: 'electron' },

  // General & Settings
  { id: 'saveCurrentDocument', label: 'Save current document', scope: 'both' },
  { id: 'editCurrentDocument', label: 'Edit current document', scope: 'editor' },
  { id: 'settings', label: 'Toggle settings modal', scope: 'both' },
  { id: 'toggleTheme', label: 'Toggle light/dark mode', scope: 'both' },
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
