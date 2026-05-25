// =============================================================================
// hooks/useKeyboard.ts — Global keyboard shortcuts & mouse navigation
// =============================================================================

import { useEffect } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAppState } from '../contexts/AppStateContext';
import { usePlatform } from '../contexts/PlatformContext';

interface UseKeyboardOptions {
  onSearchOpen: () => void;
  onSearchClose: () => void;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  isSearchOpen: boolean;
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

export function useKeyboard({
  onSearchOpen,
  onSearchClose,
  onSettingsOpen,
  onSettingsClose,
  onExpandAll,
  onCollapseAll,
  isSearchOpen,
  isSettingsOpen,
  isModalOpen,
  isTermsOpen,
}: UseKeyboardOptions) {
  const { back, forward } = useNavigation();
  const { state, toggleTheme, toggleSidebar, navigate, refresh } = useAppState();
  const bridge = usePlatform();

  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const keybindings = state.settings.keybindings || {};

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTermsOpen) {
        return;
      }
      if (isModalOpen) {
        return;
      }

      // 1. Check overlays priority Esc key
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          e.preventDefault();
          onSearchClose();
          return;
        }
        if (isSettingsOpen) {
          e.preventDefault();
          onSettingsClose();
          return;
        }
      }

      // 2. Ctrl+K -> Search overlay (both)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isSearchOpen) {
          onSearchClose();
        } else {
          onSearchOpen();
        }
        return;
      }

      // 3. Back to previous file (both)
      if (matchesShortcut(e, keybindings.back)) {
        e.preventDefault();
        back();
        return;
      }

      // 4. Go to next file (both)
      if (matchesShortcut(e, keybindings.forward)) {
        e.preventDefault();
        forward();
        return;
      }

      // 5. Welcome page (both)
      if (matchesShortcut(e, keybindings.welcome)) {
        e.preventDefault();
        navigate(null);
        return;
      }

      // 6. Settings Modal (both)
      if (matchesShortcut(e, keybindings.settings)) {
        e.preventDefault();
        if (isSettingsOpen) {
          onSettingsClose();
        } else {
          onSettingsOpen();
        }
        return;
      }

      // 7. Toggle Theme (both)
      if (matchesShortcut(e, keybindings.toggleTheme)) {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // Desktop specific keybindings
      if (isElectron) {
        // Zoom in (Desktop)
        if (matchesShortcut(e, keybindings.zoomIn) || ((e.ctrlKey || e.metaKey) && e.key === '+')) {
          e.preventDefault();
          bridge.postMessage({ command: 'zoom-in' });
          return;
        }

        // Zoom out (Desktop)
        if (matchesShortcut(e, keybindings.zoomOut)) {
          e.preventDefault();
          bridge.postMessage({ command: 'zoom-out' });
          return;
        }

        // 8. Refresh (Desktop)
        if (matchesShortcut(e, keybindings.refresh)) {
          e.preventDefault();
          refresh();
          return;
        }

        // 9. Collapse all headings (Desktop)
        if (matchesShortcut(e, keybindings.collapseAll)) {
          e.preventDefault();
          onCollapseAll();
          return;
        }

        // 10. Expand all headings (Desktop)
        if (matchesShortcut(e, keybindings.expandAll)) {
          e.preventDefault();
          onExpandAll();
          return;
        }

        // 11. Go to workspace selection page (Desktop)
        if (matchesShortcut(e, keybindings.workspaceSelection)) {
          e.preventDefault();
          bridge.postMessage({ command: 'closeWorkspace' });
          return;
        }

        // 12. Toggle sidebar (Desktop)
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
      if (isTermsOpen || isModalOpen) return;
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
    onSearchClose,
    onSettingsOpen,
    onSettingsClose,
    onExpandAll,
    onCollapseAll,
    isSearchOpen,
    isSettingsOpen,
    isModalOpen,
    isTermsOpen,
  ]);
}
