// =============================================================================
// hooks/useKeyboard.ts — Global keyboard shortcuts & mouse navigation
// =============================================================================

import { useEffect } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAppState } from '../contexts/AppStateContext';
import { usePlatform } from '../contexts/PlatformContext';

interface UseKeyboardOptions {
  onSearchOpen: () => void;
  onCrossTabSearchOpen?: () => void;
  onSearchClose: () => void;
  onFindOpen?: () => void;
  onFindClose?: () => void;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  onWelcome?: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onSidebarCursorModeToggle?: () => void;
  onSidebarCursorModeClose?: () => void;
  isSearchOpen: boolean;
  isFindOpen?: boolean;
  activeSearchScope?: 'current' | 'all-tabs';
  isSidebarCursorMode?: boolean;
  isSettingsOpen: boolean;
  isModalOpen: boolean;
  isTermsOpen: boolean;
  onToggleToc?: () => void;
  onLocateFile?: () => void;
  onToggleFocusMode?: () => void;
}

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
  | { type: 'toggle-focus-mode' }
  | { type: 'refresh' }
  | { type: 'collapse-all' }
  | { type: 'expand-all' }
  | { type: 'workspace-selection' }
  | { type: 'toggle-sidebar' }
  | null;

export interface KeyboardState {
  isDesktop: boolean;
  isDesktopLike: boolean;
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
  hasOnToggleFocusMode: boolean;
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

  if (state.hasOnToggleFocusMode && matchesShortcut(e, state.keybindings.toggleFocusMode)) {
    if (state.isRepeat) return null;
    return { type: 'toggle-focus-mode' };
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
    if (matchesShortcut(e, state.keybindings.workspaceSelection)) {
      return { type: 'workspace-selection' };
    }
    if (matchesShortcut(e, state.keybindings.toggleSidebar)) {
      if (state.isRepeat) return null;
      return { type: 'toggle-sidebar' };
    }
  }

  return null;
}

export function useKeyboard({
  onSearchOpen,
  onCrossTabSearchOpen,
  onSearchClose,
  onFindOpen,
  onFindClose,
  onSettingsOpen,
  onSettingsClose,
  onWelcome,
  onExpandAll,
  onCollapseAll,
  onSidebarCursorModeToggle,
  onSidebarCursorModeClose,
  isSearchOpen,
  isFindOpen = false,
  activeSearchScope = 'current',
  isSidebarCursorMode = false,
  isSettingsOpen,
  isModalOpen,
  isTermsOpen,
  onToggleToc,
  onLocateFile,
  onToggleFocusMode,
}: UseKeyboardOptions) {
  const { back, forward } = useNavigation();
  const { state, toggleTheme, toggleSidebar, navigate, refresh } = useAppState();
  const bridge = usePlatform();

  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isDesktop = isElectron;
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  const isDesktopLike = isDesktop || isChrome;
  const keybindings = state.settings.keybindings || {};

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const action = resolveKeyboardAction(e, {
        isDesktop,
        isDesktopLike,
        isTermsOpen,
        isModalOpen,
        isSearchOpen,
        isFindOpen: !!isFindOpen,
        isSettingsOpen,
        isSidebarCursorMode,
        activeSearchScope,
        keybindings,
        hasOnCrossTabSearchOpen: !!onCrossTabSearchOpen,
        hasOnFindOpen: !!onFindOpen,
        hasOnSidebarCursorModeToggle: !!onSidebarCursorModeToggle,
        hasOnSidebarCursorModeClose: !!onSidebarCursorModeClose,
        hasOnWelcome: !!onWelcome,
        hasOnToggleToc: !!onToggleToc,
        hasOnLocateFile: !!onLocateFile,
        hasOnToggleFocusMode: !!onToggleFocusMode,
        hasOnFindClose: !!onFindClose,
        isRepeat: e.repeat,
        isEditableTarget: isEditableTarget(e.target),
      });

      if (!action) return;
      e.preventDefault();

      switch (action.type) {
        case 'zoom-in':
          bridge.postMessage({ command: 'zoom-in' });
          break;
        case 'zoom-out':
          bridge.postMessage({ command: 'zoom-out' });
          break;
        case 'zoom-reset':
          break;
        case 'sidebar-cursor-mode-toggle':
          onSidebarCursorModeToggle?.();
          break;
        case 'close-sidebar-cursor-mode':
          onSidebarCursorModeClose?.();
          break;
        case 'close-search':
          onSearchClose();
          break;
        case 'close-find':
          onFindClose?.();
          break;
        case 'close-settings':
          onSettingsClose();
          break;
        case 'cross-tab-search-toggle':
          if (isSearchOpen && activeSearchScope === 'all-tabs') {
            onSearchClose();
          } else {
            onCrossTabSearchOpen?.();
          }
          break;
        case 'current-search-toggle':
          if (isSearchOpen && activeSearchScope === 'current') {
            onSearchClose();
          } else {
            onSearchOpen();
          }
          break;
        case 'find-toggle':
          if (isFindOpen && onFindClose) {
            onFindClose();
          } else {
            onFindOpen?.();
          }
          break;
        case 'back':
          back();
          break;
        case 'forward':
          forward();
          break;
        case 'welcome':
          if (onWelcome) {
            onWelcome();
          } else {
            navigate(null);
          }
          break;
        case 'settings-toggle':
          if (isSettingsOpen) {
            onSettingsClose();
          } else {
            onSettingsOpen();
          }
          break;
        case 'toggle-theme':
          toggleTheme();
          break;
        case 'toggle-toc':
          onToggleToc?.();
          break;
        case 'locate-file':
          onLocateFile?.();
          break;
        case 'toggle-focus-mode':
          onToggleFocusMode?.();
          break;
        case 'refresh':
          refresh();
          break;
        case 'collapse-all':
          onCollapseAll();
          break;
        case 'expand-all':
          onExpandAll();
          break;
        case 'workspace-selection':
          bridge.postMessage({ command: 'closeWorkspace' });
          break;
        case 'toggle-sidebar':
          toggleSidebar();
          break;
      }
    };

    const mouseHandler = (e: MouseEvent) => {
      if (isTermsOpen) return;
      // e.button: 3 is back mouse button, 4 is forward mouse button
      if (e.button === 3) {
        e.preventDefault();
        back();
      } else if (e.button === 4) {
        e.preventDefault();
        forward();
      }
    };

    const wheelHandler = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          bridge.postMessage({ command: 'zoom-in' });
        } else if (e.deltaY > 0) {
          bridge.postMessage({ command: 'zoom-out' });
        }
      }
    };

    document.addEventListener('keydown', handler, true);
    window.addEventListener('mouseup', mouseHandler);
    if (isDesktop) {
      window.addEventListener('wheel', wheelHandler, { passive: false });
    }

    return () => {
      document.removeEventListener('keydown', handler, true);
      window.removeEventListener('mouseup', mouseHandler);
      if (isDesktop) {
        window.removeEventListener('wheel', wheelHandler);
      }
    };
  }, [
    back,
    forward,
    navigate,
    refresh,
    toggleTheme,
    toggleSidebar,
    bridge,
    keybindings,
    isDesktop,
    onSearchOpen,
    onCrossTabSearchOpen,
    onSearchClose,
    onFindOpen,
    onFindClose,
    onSettingsOpen,
    onSettingsClose,
    onWelcome,
    onExpandAll,
    onCollapseAll,
    onSidebarCursorModeToggle,
    onSidebarCursorModeClose,
    isSearchOpen,
    isFindOpen,
    activeSearchScope,
    isSidebarCursorMode,
    isSettingsOpen,
    isModalOpen,
    isTermsOpen,
    onToggleToc,
    onLocateFile,
  ]);
}


