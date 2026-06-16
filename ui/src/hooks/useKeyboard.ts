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
}

function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
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
}: UseKeyboardOptions) {
  const { back, forward } = useNavigation();
  const { state, toggleTheme, toggleSidebar, navigate, refresh } = useAppState();
  const bridge = usePlatform();

  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  const isDesktopLike = isElectron || isChrome;
  const keybindings = state.settings.keybindings || {};

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isElectron) {
        const isZoomIn =
          matchesShortcut(e, keybindings.zoomIn) ||
          ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.key === 'Add'));
        const isZoomOut =
          matchesShortcut(e, keybindings.zoomOut) ||
          ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_' || e.key === 'Subtract'));

        if (isZoomIn) {
          e.preventDefault();
          bridge.postMessage({ command: 'zoom-in' });
          return;
        }

        if (isZoomOut) {
          e.preventDefault();
          bridge.postMessage({ command: 'zoom-out' });
          return;
        }
      }

      if (isTermsOpen) {
        return;
      }
      if (isModalOpen) {
        return;
      }

      if (onSidebarCursorModeToggle && matchesShortcut(e, keybindings.sidebarCursorMode)) {
        e.preventDefault();
        onSidebarCursorModeToggle();
        return;
      }

      // 1. Check overlays priority Esc key
      if (e.key === 'Escape') {
        if (isSidebarCursorMode && onSidebarCursorModeClose) {
          e.preventDefault();
          onSidebarCursorModeClose();
          return;
        }
        if (isSearchOpen) {
          e.preventDefault();
          onSearchClose();
          return;
        }
        if (isFindOpen && onFindClose) {
          e.preventDefault();
          onFindClose();
          return;
        }
        if (isSettingsOpen) {
          e.preventDefault();
          onSettingsClose();
          return;
        }
      }

      // 2. Search shortcuts. Desktop is customizable; VS Code keeps Ctrl+K.
      if (isDesktopLike && onCrossTabSearchOpen && matchesShortcut(e, keybindings.searchAllTabs)) {
        e.preventDefault();
        if (isSearchOpen && activeSearchScope === 'all-tabs') {
          onSearchClose();
        } else {
          onCrossTabSearchOpen();
        }
        return;
      }

      const isCurrentSearchShortcut = isDesktopLike
        ? matchesShortcut(e, keybindings.searchCurrent)
        : (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k';

      if (isCurrentSearchShortcut) {
        e.preventDefault();
        if (isSearchOpen && activeSearchScope === 'current') {
          onSearchClose();
        } else {
          onSearchOpen();
        }
        return;
      }

      // 3. Find in the current rendered file. Bare keys must not fire while typing.
      if (
        onFindOpen &&
        !isSearchOpen &&
        !isEditableTarget(e.target) &&
        matchesShortcut(e, keybindings.findCurrentFile)
      ) {
        e.preventDefault();
        if (isFindOpen && onFindClose) {
          onFindClose();
        } else {
          onFindOpen();
        }
        return;
      }

      // 4. Back to previous file (both)
      if (matchesShortcut(e, keybindings.back)) {
        e.preventDefault();
        back();
        return;
      }

      // 5. Go to next file (both)
      if (matchesShortcut(e, keybindings.forward)) {
        e.preventDefault();
        forward();
        return;
      }

      // 6. Welcome page (both)
      if (matchesShortcut(e, keybindings.welcome)) {
        e.preventDefault();
        if (onWelcome) {
          onWelcome();
        } else {
          navigate(null);
        }
        return;
      }

      // 7. Settings Modal (both)
      if (matchesShortcut(e, keybindings.settings)) {
        e.preventDefault();
        if (isSettingsOpen) {
          onSettingsClose();
        } else {
          onSettingsOpen();
        }
        return;
      }

      // 8. Toggle Theme (both)
      if (matchesShortcut(e, keybindings.toggleTheme)) {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // Desktop specific keybindings
      if (isDesktopLike) {
        // 9. Refresh (Desktop)
        if (matchesShortcut(e, keybindings.refresh)) {
          e.preventDefault();
          refresh();
          return;
        }

        // 10. Collapse all headings (Desktop)
        if (matchesShortcut(e, keybindings.collapseAll)) {
          e.preventDefault();
          onCollapseAll();
          return;
        }

        // 11. Expand all headings (Desktop)
        if (matchesShortcut(e, keybindings.expandAll)) {
          e.preventDefault();
          onExpandAll();
          return;
        }

        // 12. Go to workspace selection page (Desktop)
        if (matchesShortcut(e, keybindings.workspaceSelection)) {
          e.preventDefault();
          bridge.postMessage({ command: 'closeWorkspace' });
          return;
        }

        // 13. Toggle sidebar (Desktop)
        if (matchesShortcut(e, keybindings.toggleSidebar)) {
          e.preventDefault();
          toggleSidebar();
          return;
        }
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

    document.addEventListener('keydown', handler);
    window.addEventListener('mouseup', mouseHandler);
    if (isElectron) {
      window.addEventListener('wheel', wheelHandler, { passive: false });
    }

    return () => {
      document.removeEventListener('keydown', handler);
      window.removeEventListener('mouseup', mouseHandler);
      if (isElectron) {
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
    isElectron,
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
  ]);
}
