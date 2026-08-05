export type KeyboardShortcutSearchAction = {
  id: string;
  label: string;
};

export const KEYBOARD_SHORTCUT_ENGLISH_LABELS: Record<string, string> = {
  findCurrentFile: 'Find in current file',
  searchCurrent: 'Search current workspace',
  searchAllTabs: 'Search all tabs',
  back: 'Back to previous file',
  forward: 'Go to next file',
  welcome: 'Go to welcome page',
  settings: 'Toggle settings modal',
  toggleTheme: 'Toggle light/dark mode',
  refresh: 'Refresh current file',
  collapseAll: 'Collapse all headings',
  expandAll: 'Expand all headings',
  workspaceSelection: 'Go to workspace selection',
  toggleSidebar: 'Toggle sidebar visibility',
  openBookmarks: 'Open Bookmarks tab',
  toggleToc: 'Toggle table of contents panel',
  toggleFocusMode: 'Toggle focus mode',
  sidebarCursorMode: 'Sidebar cursor mode',
  locateFile: 'Locate current open file in sidebar',
  openCurrentDocumentLocation: 'Open current document folder',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
};

export function filterKeyboardShortcutActions<T extends KeyboardShortcutSearchAction>(
  actions: readonly T[],
  query: string,
  translatedLabels: Record<string, string | undefined>,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...actions];

  return actions.filter((action) => {
    const haystack = [
      action.id,
      translatedLabels[action.id],
      KEYBOARD_SHORTCUT_ENGLISH_LABELS[action.id],
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
