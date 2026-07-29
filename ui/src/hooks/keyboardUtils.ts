export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut) return false;
  const parts = shortcut.split('+').map((p) => p.trim().toLowerCase());

  // Check modifiers
  const ctrlIndex = parts.indexOf('ctrl');
  const cmdIndex = parts.indexOf('cmd');
  const shiftIndex = parts.indexOf('shift');
  const altIndex = parts.indexOf('alt');

  const reqCtrl = ctrlIndex !== -1 || cmdIndex !== -1;
  const reqShift = shiftIndex !== -1;
  const reqAlt = altIndex !== -1;

  const actualCtrl = e.ctrlKey || e.metaKey; // support Cmd on Mac as Ctrl
  const actualShift = e.shiftKey;
  const actualAlt = e.altKey;

  if (reqCtrl !== actualCtrl) return false;
  if (reqShift !== actualShift) return false;
  if (reqAlt !== actualAlt) return false;

  // Key is the remaining part (not ctrl/cmd/shift/alt)
  const keyPart = parts.find((p) => p !== 'ctrl' && p !== 'cmd' && p !== 'shift' && p !== 'alt') ?? '';

  const eventKey = e.key.toLowerCase();
  let targetKey = keyPart;
  if (targetKey === '<-' || targetKey === 'left') targetKey = 'arrowleft';
  if (targetKey === '->' || targetKey === 'right') targetKey = 'arrowright';

  return eventKey === targetKey;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export type KeyboardAction =
  | { type: 'zoom-in' }
  | { type: 'zoom-out' }
  | { type: 'zoom-reset' }
  | { type: 'sidebar-cursor-mode-toggle' }
  | { type: 'close-sidebar-cursor-mode' }
  | { type: 'close-search' }
  | { type: 'close-find' }
  | { type: 'close-settings' }
  | { type: 'cross-tab-search-toggle' }
  | { type: 'current-search-toggle' }
  | { type: 'find-toggle' }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'welcome' }
  | { type: 'settings-toggle' }
  | { type: 'toggle-theme' }
  | { type: 'toggle-toc' }
  | { type: 'locate-file' }
  | { type: 'open-current-document-location' }
  | { type: 'toggle-focus-mode' }
  | { type: 'toggle-desktop-view-mode' }
  | { type: 'toggle-active-html-document-preview' }
  | { type: 'toggle-fullscreen' }
  | { type: 'close-content-tab' }
  | { type: 'close-all-content-tabs' }
  | { type: 'close-content-tabs-to-right' }
  | { type: 'close-other-content-tabs' }
  | { type: 'refresh' }
  | { type: 'collapse-all' }
  | { type: 'expand-all' }
  | { type: 'workspace-selection' }
  | { type: 'toggle-sidebar' }
  | null;

export interface KeyboardState {
  isDesktop: boolean;
  isDesktopLike: boolean;
  isVscode: boolean;
  isTermsOpen: boolean;
  isModalOpen: boolean;
  isSearchOpen: boolean;
  isFindOpen: boolean;
  isSettingsOpen: boolean;
  isSidebarCursorMode: boolean;
  activeSearchScope: 'current' | 'all-tabs';
  keybindings: Record<string, string>;
  hasOnCrossTabSearchOpen: boolean;
  hasOnFindOpen: boolean;
  hasOnSidebarCursorModeToggle: boolean;
  hasOnSidebarCursorModeClose: boolean;
  hasOnWelcome: boolean;
  hasOnToggleToc: boolean;
  hasOnLocateFile: boolean;
  hasOnOpenCurrentDocumentLocation?: boolean;
  hasOnToggleFocusMode: boolean;
  hasOnToggleDesktopViewMode: boolean;
  activeHtmlDocument?: boolean;
  onToggleActiveHtmlDocumentPreview?: boolean;
  hasOnToggleFullscreen: boolean;
  hasOnFindClose: boolean;
  isRepeat: boolean;
  isEditableTarget: boolean;
}

export function resolveKeyboardAction(e: KeyboardEvent, state: KeyboardState): KeyboardAction {
  if (state.isDesktop) {
    const isZoomIn =
      matchesShortcut(e, state.keybindings.zoomIn) ||
      ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.key === 'Add'));
    const isZoomOut =
      matchesShortcut(e, state.keybindings.zoomOut) ||
      ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_' || e.key === 'Subtract'));
    const isZoomReset = (e.ctrlKey || e.metaKey) && e.key === '0';

    if (isZoomIn) return { type: 'zoom-in' };
    if (isZoomOut) return { type: 'zoom-out' };
    if (isZoomReset) return { type: 'zoom-reset' };
  }

  if (state.isTermsOpen) return null;
  if (state.isModalOpen) return null;

  if (state.isDesktop && state.hasOnToggleFullscreen && e.key === 'F11') {
    if (state.isRepeat) return null;
    return { type: 'toggle-fullscreen' };
  }

  if (state.isDesktop && matchesShortcut(e, state.keybindings.closeAllContentTabs)) {
    return { type: 'close-all-content-tabs' };
  }
  if (state.isDesktop && matchesShortcut(e, state.keybindings.closeContentTabsToRight)) {
    return { type: 'close-content-tabs-to-right' };
  }
  if (state.isDesktop && matchesShortcut(e, state.keybindings.closeOtherContentTabs)) {
    return { type: 'close-other-content-tabs' };
  }
  if (state.isDesktop && matchesShortcut(e, state.keybindings.closeContentTab)) {
    return { type: 'close-content-tab' };
  }

  if (state.hasOnSidebarCursorModeToggle && matchesShortcut(e, state.keybindings.sidebarCursorMode)) {
    return { type: 'sidebar-cursor-mode-toggle' };
  }

  if (e.key === 'Escape') {
    if (state.isSidebarCursorMode && state.hasOnSidebarCursorModeClose) {
      return { type: 'close-sidebar-cursor-mode' };
    }
    if (state.isSearchOpen) {
      return { type: 'close-search' };
    }
    if (state.isFindOpen && state.hasOnFindClose) {
      return { type: 'close-find' };
    }
    if (state.isSettingsOpen) {
      return { type: 'close-settings' };
    }
  }

  if (state.isDesktopLike && state.hasOnCrossTabSearchOpen && matchesShortcut(e, state.keybindings.searchAllTabs)) {
    return { type: 'cross-tab-search-toggle' };
  }

  const isCurrentSearchShortcut = state.isDesktopLike
    ? matchesShortcut(e, state.keybindings.searchCurrent)
    : (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k';

  if (isCurrentSearchShortcut) {
    return { type: 'current-search-toggle' };
  }

  if (
    state.hasOnFindOpen &&
    !state.isSearchOpen &&
    !state.isEditableTarget &&
    matchesShortcut(e, state.keybindings.findCurrentFile)
  ) {
    return { type: 'find-toggle' };
  }

  if (matchesShortcut(e, state.keybindings.back)) {
    return { type: 'back' };
  }

  if (matchesShortcut(e, state.keybindings.forward)) {
    return { type: 'forward' };
  }

  if (matchesShortcut(e, state.keybindings.welcome)) {
    return { type: 'welcome' };
  }

  if (matchesShortcut(e, state.keybindings.settings)) {
    return { type: 'settings-toggle' };
  }

  if (matchesShortcut(e, state.keybindings.toggleTheme)) {
    if (state.isRepeat) return null;
    return { type: 'toggle-theme' };
  }

  if (state.hasOnToggleToc && matchesShortcut(e, state.keybindings.toggleToc)) {
    if (state.isRepeat) return null;
    return { type: 'toggle-toc' };
  }

  if (state.hasOnLocateFile && !state.isEditableTarget && matchesShortcut(e, state.keybindings.locateFile)) {
    return { type: 'locate-file' };
  }

  if (
    state.isDesktop &&
    state.hasOnOpenCurrentDocumentLocation &&
    !state.isEditableTarget &&
    matchesShortcut(e, state.keybindings.openCurrentDocumentLocation)
  ) {
    return { type: 'open-current-document-location' };
  }

  if (state.hasOnToggleFocusMode && matchesShortcut(e, state.keybindings.toggleFocusMode)) {
    if (state.isRepeat) return null;
    return { type: 'toggle-focus-mode' };
  }

  if (state.isDesktop && state.hasOnToggleDesktopViewMode && matchesShortcut(e, state.keybindings.toggleDesktopViewMode)) {
    if (state.isRepeat) return null;
    return { type: 'toggle-desktop-view-mode' };
  }

  if (state.activeHtmlDocument && state.onToggleActiveHtmlDocumentPreview && matchesShortcut(e, state.keybindings.toggleHtmlPreview)) {
    if (state.isRepeat) return null;
    return { type: 'toggle-active-html-document-preview' };
  }

  if (!state.isVscode && matchesShortcut(e, state.keybindings.workspaceSelection)) {
    return { type: 'workspace-selection' };
  }

  if (matchesShortcut(e, state.keybindings.toggleSidebar)) {
    if (state.isRepeat) return null;
    return { type: 'toggle-sidebar' };
  }

  if (state.isDesktopLike) {
    if (matchesShortcut(e, state.keybindings.refresh)) {
      return { type: 'refresh' };
    }
    if (matchesShortcut(e, state.keybindings.collapseAll)) {
      return { type: 'collapse-all' };
    }
    if (matchesShortcut(e, state.keybindings.expandAll)) {
      return { type: 'expand-all' };
    }
  }

  return null;
}
