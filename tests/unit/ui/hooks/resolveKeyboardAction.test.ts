import { describe, it, expect } from 'vitest';
import { resolveKeyboardAction, type KeyboardState } from '../../../../ui/src/hooks/useKeyboard';

function mkEvent(opts: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', opts);
}

const defaultBindings: Record<string, string> = {
  zoomIn: 'ctrl+=',
  zoomOut: 'ctrl+-',
  searchAllTabs: 'ctrl+shift+k',
  searchCurrent: 'ctrl+k',
  findCurrentFile: 'f',
  back: 'alt+<-',
  forward: 'alt+->',
  welcome: 'alt+home',
  settings: 'ctrl+,',
  toggleTheme: 'ctrl+shift+t',
  toggleToc: 'ctrl+shift+u',
  locateFile: 'ctrl+shift+l',
  toggleFocusMode: 'ctrl+shift+f',
  toggleDesktopViewMode: 'ctrl+alt+t',
  sidebarCursorMode: 'ctrl+shift+s',
  refresh: 'ctrl+r',
  collapseAll: 'ctrl+shift+c',
  expandAll: 'ctrl+shift+e',
  workspaceSelection: 'ctrl+shift+w',
  toggleSidebar: 'ctrl+b',
};

function defaultState(overrides: Partial<KeyboardState> = {}): KeyboardState {
  return {
    isDesktop: false,
    isDesktopLike: false,
    isTermsOpen: false,
    isModalOpen: false,
    isSearchOpen: false,
    isFindOpen: false,
    isSettingsOpen: false,
    isSidebarCursorMode: false,
    activeSearchScope: 'current',
    keybindings: { ...defaultBindings },
    hasOnCrossTabSearchOpen: false,
    hasOnFindOpen: true,
    hasOnSidebarCursorModeToggle: false,
    hasOnSidebarCursorModeClose: false,
    hasOnWelcome: false,
    hasOnToggleToc: true,
    hasOnLocateFile: true,
    hasOnToggleFocusMode: true,
    hasOnToggleDesktopViewMode: false,
    hasOnFindClose: true,
    isRepeat: false,
    isEditableTarget: false,
    ...overrides,
  };
}

describe('resolveKeyboardAction', () => {
  describe('zoom in', () => {
    it('returns zoom-in on custom keybinding match', () => {
      const e = mkEvent({ key: '=', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-in' });
    });

    it('returns zoom-in on Ctrl+=', () => {
      const e = mkEvent({ key: '=', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-in' });
    });

    it('returns zoom-in on Ctrl++', () => {
      const e = mkEvent({ key: '+', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-in' });
    });

    it('returns zoom-in on Add key (numpad)', () => {
      const e = mkEvent({ key: 'Add', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-in' });
    });

    it('returns null for zoom-in when not desktop', () => {
      const e = mkEvent({ key: '=', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: false, isDesktopLike: false }));
      expect(result).toBeNull();
    });
  });

  describe('zoom out', () => {
    it('returns zoom-out on custom keybinding match', () => {
      const e = mkEvent({ key: '-', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-out' });
    });

    it('returns zoom-out on Ctrl+-', () => {
      const e = mkEvent({ key: '-', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-out' });
    });

    it('returns zoom-out on Ctrl+_', () => {
      const e = mkEvent({ key: '_', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-out' });
    });

    it('returns zoom-out on Subtract key (numpad)', () => {
      const e = mkEvent({ key: 'Subtract', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-out' });
    });
  });

  describe('zoom reset', () => {
    it('returns zoom-reset on Ctrl+0', () => {
      const e = mkEvent({ key: '0', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-reset' });
    });

    it('returns null for Ctrl+0 when not desktop', () => {
      const e = mkEvent({ key: '0', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: false, isDesktopLike: false }));
      expect(result).toBeNull();
    });

    it('returns null for 0 without ctrl', () => {
      const e = mkEvent({ key: '0' });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toBeNull();
    });
  });

  describe('terms guard', () => {
    it('returns null when isTermsOpen is true', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({ isTermsOpen: true }));
      expect(result).toBeNull();
    });

    it('returns null when isTermsOpen is true even for desktop zoom', () => {
      const e = mkEvent({ key: '=', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true, isTermsOpen: true }));
      expect(result).toEqual({ type: 'zoom-in' });
    });
  });

  describe('modal guard', () => {
    it('returns null when isModalOpen is true', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({ isModalOpen: true }));
      expect(result).toBeNull();
    });

    it('returns action when isModalOpen is false', () => {
      const e = mkEvent({ key: 'k', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isModalOpen: false, isDesktopLike: true }));
      expect(result).toEqual({ type: 'current-search-toggle' });
    });
  });

  describe('sidebar cursor mode toggle', () => {
    it('returns sidebar-cursor-mode-toggle when callback exists and keybinding matches', () => {
      const e = mkEvent({ key: 's', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnSidebarCursorModeToggle: true }));
      expect(result).toEqual({ type: 'sidebar-cursor-mode-toggle' });
    });

    it('returns null when callback does not exist', () => {
      const e = mkEvent({ key: 's', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnSidebarCursorModeToggle: false }));
      expect(result).toBeNull();
    });
  });

  describe('escape cascade', () => {
    it('close-sidebar-cursor-mode has highest priority', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({
        isSidebarCursorMode: true,
        hasOnSidebarCursorModeClose: true,
        isSearchOpen: true,
        isFindOpen: true,
        isSettingsOpen: true,
      }));
      expect(result).toEqual({ type: 'close-sidebar-cursor-mode' });
    });

    it('close-search has second priority', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({
        isSidebarCursorMode: false,
        isSearchOpen: true,
        isFindOpen: true,
        isSettingsOpen: true,
      }));
      expect(result).toEqual({ type: 'close-search' });
    });

    it('close-find has third priority', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({
        isSearchOpen: false,
        isFindOpen: true,
        hasOnFindClose: true,
        isSettingsOpen: true,
      }));
      expect(result).toEqual({ type: 'close-find' });
    });

    it('close-settings has lowest priority', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({
        isSearchOpen: false,
        isFindOpen: false,
        isSettingsOpen: true,
      }));
      expect(result).toEqual({ type: 'close-settings' });
    });

    it('returns null for Escape when nothing is open', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({
        isSearchOpen: false,
        isFindOpen: false,
        isSettingsOpen: false,
        isSidebarCursorMode: false,
      }));
      expect(result).toBeNull();
    });

    it('does not close-find when hasOnFindClose is false', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({
        isSearchOpen: false,
        isFindOpen: true,
        hasOnFindClose: false,
        isSettingsOpen: true,
      }));
      expect(result).toEqual({ type: 'close-settings' });
    });

    it('does not close-sidebar-cursor-mode when hasOnSidebarCursorModeClose is false', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({
        isSidebarCursorMode: true,
        hasOnSidebarCursorModeClose: false,
        isSearchOpen: true,
      }));
      expect(result).toEqual({ type: 'close-search' });
    });
  });

  describe('cross-tab search toggle', () => {
    it('returns cross-tab-search-toggle when not open', () => {
      const e = mkEvent({ key: 'k', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktopLike: true,
        hasOnCrossTabSearchOpen: true,
        isSearchOpen: false,
      }));
      expect(result).toEqual({ type: 'cross-tab-search-toggle' });
    });

    it('returns cross-tab-search-toggle when search is open with current scope', () => {
      const e = mkEvent({ key: 'k', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktopLike: true,
        hasOnCrossTabSearchOpen: true,
        isSearchOpen: true,
        activeSearchScope: 'current',
      }));
      expect(result).toEqual({ type: 'cross-tab-search-toggle' });
    });

    it('returns cross-tab-search-toggle when search is open with all-tabs scope (close)', () => {
      const e = mkEvent({ key: 'k', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktopLike: true,
        hasOnCrossTabSearchOpen: true,
        isSearchOpen: true,
        activeSearchScope: 'all-tabs',
      }));
      expect(result).toEqual({ type: 'cross-tab-search-toggle' });
    });

    it('returns null when hasOnCrossTabSearchOpen is false', () => {
      const e = mkEvent({ key: 'k', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktopLike: true,
        hasOnCrossTabSearchOpen: false,
      }));
      expect(result).toBeNull();
    });

    it('returns null when not desktopLike', () => {
      const e = mkEvent({ key: 'k', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktopLike: false,
        hasOnCrossTabSearchOpen: true,
      }));
      expect(result).toBeNull();
    });
  });

  describe('current search toggle', () => {
    it('returns current-search-toggle on desktop keybinding match', () => {
      const e = mkEvent({ key: 'k', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: true }));
      expect(result).toEqual({ type: 'current-search-toggle' });
    });

    it('returns current-search-toggle on non-desktop Ctrl+K', () => {
      const e = mkEvent({ key: 'k', metaKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: false }));
      expect(result).toEqual({ type: 'current-search-toggle' });
    });

    it('returns null on non-desktop Ctrl+Shift+K (shift prevents)', () => {
      const e = mkEvent({ key: 'k', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: false }));
      expect(result).toBeNull();
    });

    it('returns null on non-desktop plain k', () => {
      const e = mkEvent({ key: 'k' });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: false }));
      expect(result).toBeNull();
    });
  });

  describe('find toggle', () => {
    it('returns find-toggle when search not open and not editable', () => {
      const e = mkEvent({ key: 'f' });
      const result = resolveKeyboardAction(e, defaultState({
        hasOnFindOpen: true,
        isSearchOpen: false,
        isEditableTarget: false,
      }));
      expect(result).toEqual({ type: 'find-toggle' });
    });

    it('returns null when search is open', () => {
      const e = mkEvent({ key: 'f' });
      const result = resolveKeyboardAction(e, defaultState({
        hasOnFindOpen: true,
        isSearchOpen: true,
      }));
      expect(result).toBeNull();
    });

    it('returns null when target is editable', () => {
      const e = mkEvent({ key: 'f' });
      const result = resolveKeyboardAction(e, defaultState({
        hasOnFindOpen: true,
        isSearchOpen: false,
        isEditableTarget: true,
      }));
      expect(result).toBeNull();
    });

    it('returns null when hasOnFindOpen is false', () => {
      const e = mkEvent({ key: 'f' });
      const result = resolveKeyboardAction(e, defaultState({
        hasOnFindOpen: false,
        isSearchOpen: false,
        isEditableTarget: false,
      }));
      expect(result).toBeNull();
    });
  });

  describe('back shortcut', () => {
    it('returns back on keybinding match', () => {
      const e = mkEvent({ key: 'ArrowLeft', altKey: true });
      const result = resolveKeyboardAction(e, defaultState());
      expect(result).toEqual({ type: 'back' });
    });

    it('returns null when keybinding does not match', () => {
      const e = mkEvent({ key: 'ArrowUp', altKey: true });
      const result = resolveKeyboardAction(e, defaultState());
      expect(result).toBeNull();
    });
  });

  describe('forward shortcut', () => {
    it('returns forward on keybinding match', () => {
      const e = mkEvent({ key: 'ArrowRight', altKey: true });
      const result = resolveKeyboardAction(e, defaultState());
      expect(result).toEqual({ type: 'forward' });
    });
  });

  describe('welcome', () => {
    it('returns welcome on keybinding match', () => {
      const e = mkEvent({ key: 'Home', altKey: true });
      const result = resolveKeyboardAction(e, defaultState());
      expect(result).toEqual({ type: 'welcome' });
    });

    it('returns welcome regardless of hasOnWelcome flag', () => {
      const e = mkEvent({ key: 'Home', altKey: true });
      const resultWith = resolveKeyboardAction(e, defaultState({ hasOnWelcome: true }));
      const resultWithout = resolveKeyboardAction(e, defaultState({ hasOnWelcome: false }));
      expect(resultWith).toEqual({ type: 'welcome' });
      expect(resultWithout).toEqual({ type: 'welcome' });
    });
  });

  describe('settings toggle', () => {
    it('returns settings-toggle when keybinding matches', () => {
      const e = mkEvent({ key: ',', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState());
      expect(result).toEqual({ type: 'settings-toggle' });
    });
  });

  describe('toggle theme', () => {
    it('returns toggle-theme on keybinding match', () => {
      const e = mkEvent({ key: 't', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState());
      expect(result).toEqual({ type: 'toggle-theme' });
    });

    it('returns null on repeat', () => {
      const e = mkEvent({ key: 't', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isRepeat: true }));
      expect(result).toBeNull();
    });

    it('returns toggle-theme on first press', () => {
      const e = mkEvent({ key: 't', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isRepeat: false }));
      expect(result).toEqual({ type: 'toggle-theme' });
    });
  });

  describe('toggle TOC', () => {
    it('returns toggle-toc when callback exists and keybinding matches', () => {
      const e = mkEvent({ key: 'u', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnToggleToc: true }));
      expect(result).toEqual({ type: 'toggle-toc' });
    });

    it('returns null on repeat', () => {
      const e = mkEvent({ key: 'u', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnToggleToc: true, isRepeat: true }));
      expect(result).toBeNull();
    });

    it('returns null when hasOnToggleToc is false', () => {
      const e = mkEvent({ key: 'u', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnToggleToc: false }));
      expect(result).toBeNull();
    });
  });

  describe('locate file', () => {
    it('returns locate-file when callback exists and not editable', () => {
      const e = mkEvent({ key: 'l', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnLocateFile: true, isEditableTarget: false }));
      expect(result).toEqual({ type: 'locate-file' });
    });

    it('returns null when target is editable', () => {
      const e = mkEvent({ key: 'l', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnLocateFile: true, isEditableTarget: true }));
      expect(result).toBeNull();
    });

    it('returns null when hasOnLocateFile is false', () => {
      const e = mkEvent({ key: 'l', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnLocateFile: false }));
      expect(result).toBeNull();
    });
  });

  describe('focus mode toggle', () => {
    it('returns toggle-focus-mode when callback exists and keybinding matches', () => {
      const e = mkEvent({ key: 'f', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnToggleFocusMode: true }));
      expect(result).toEqual({ type: 'toggle-focus-mode' });
    });

    it('returns null on repeat', () => {
      const e = mkEvent({ key: 'f', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnToggleFocusMode: true, isRepeat: true }));
      expect(result).toBeNull();
    });

    it('returns null when hasOnToggleFocusMode is false', () => {
      const e = mkEvent({ key: 'f', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnToggleFocusMode: false }));
      expect(result).toBeNull();
    });
  });

  describe('fullscreen toggle', () => {
    it('returns toggle-fullscreen for fixed F11 on desktop', () => {
      const e = mkEvent({ key: 'F11' });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktop: true,
        isDesktopLike: true,
        hasOnToggleFullscreen: true,
      }));
      expect(result).toEqual({ type: 'toggle-fullscreen' });
    });

    it('does not expose fixed F11 outside desktop runtimes', () => {
      const e = mkEvent({ key: 'F11' });
      const result = resolveKeyboardAction(e, defaultState({
        hasOnToggleFullscreen: true,
      }));
      expect(result).toBeNull();
    });

    it('does not repeat fullscreen toggle while F11 is held', () => {
      const e = mkEvent({ key: 'F11' });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktop: true,
        isDesktopLike: true,
        hasOnToggleFullscreen: true,
        isRepeat: true,
      }));
      expect(result).toBeNull();
    });
  });

  describe('desktop-only shortcuts', () => {
    const desktopState = (overrides: Partial<KeyboardState> = {}): KeyboardState =>
      defaultState({ isDesktop: true, isDesktopLike: true, ...overrides });

    it('refresh: returns refresh on keybinding match', () => {
      const e = mkEvent({ key: 'r', ctrlKey: true });
      const result = resolveKeyboardAction(e, desktopState());
      expect(result).toEqual({ type: 'refresh' });
    });

    it('collapse-all: returns collapse-all on keybinding match', () => {
      const e = mkEvent({ key: 'c', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, desktopState());
      expect(result).toEqual({ type: 'collapse-all' });
    });

    it('expand-all: returns expand-all on keybinding match', () => {
      const e = mkEvent({ key: 'e', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, desktopState());
      expect(result).toEqual({ type: 'expand-all' });
    });

    it('workspace-selection: returns workspace-selection on keybinding match', () => {
      const e = mkEvent({ key: 'w', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, desktopState());
      expect(result).toEqual({ type: 'workspace-selection' });
    });

    it('toggle-sidebar: returns toggle-sidebar on keybinding match', () => {
      const e = mkEvent({ key: 'b', ctrlKey: true });
      const result = resolveKeyboardAction(e, desktopState());
      expect(result).toEqual({ type: 'toggle-sidebar' });
    });

    it('toggle-desktop-view-mode: returns action on Ctrl+Alt+T', () => {
      const e = mkEvent({ key: 't', ctrlKey: true, altKey: true });
      const result = resolveKeyboardAction(e, desktopState({ hasOnToggleDesktopViewMode: true }));
      expect(result).toEqual({ type: 'toggle-desktop-view-mode' });
    });

    it('toggle-desktop-view-mode returns null outside the desktop app', () => {
      const e = mkEvent({ key: 't', ctrlKey: true, altKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktopLike: true,
        hasOnToggleDesktopViewMode: true,
      }));
      expect(result).toBeNull();
    });
  });

  describe('desktop-only shortcuts return null when not isDesktopLike', () => {
    it('refresh returns null when not isDesktopLike', () => {
      const e = mkEvent({ key: 'r', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: false }));
      expect(result).toBeNull();
    });

    it('collapse-all returns null when not isDesktopLike', () => {
      const e = mkEvent({ key: 'c', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: false }));
      expect(result).toBeNull();
    });

    it('expand-all returns null when not isDesktopLike', () => {
      const e = mkEvent({ key: 'e', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: false }));
      expect(result).toBeNull();
    });

    it('workspace-selection works on other platforms with Ctrl+Alt+W', () => {
      const e = mkEvent({ key: 'w', ctrlKey: true, altKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktopLike: false,
        keybindings: { ...defaultState().keybindings, workspaceSelection: 'ctrl+alt+w' },
      }));
      expect(result).toEqual({ type: 'workspace-selection' });
    });

    it('toggle-sidebar returns null when not isDesktopLike', () => {
      const e = mkEvent({ key: 'b', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: false }));
      expect(result).toBeNull();
    });
  });

  describe('e.repeat guard', () => {
    it('toggle-sidebar returns null on repeat', () => {
      const e = mkEvent({ key: 'b', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: true, isRepeat: true }));
      expect(result).toBeNull();
    });

    it('toggle-sidebar returns action on first press', () => {
      const e = mkEvent({ key: 'b', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: true, isRepeat: false }));
      expect(result).toEqual({ type: 'toggle-sidebar' });
    });

    it('toggle-theme returns null on repeat', () => {
      const e = mkEvent({ key: 't', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isRepeat: true }));
      expect(result).toBeNull();
    });

    it('toggle-toc returns null on repeat', () => {
      const e = mkEvent({ key: 'u', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnToggleToc: true, isRepeat: true }));
      expect(result).toBeNull();
    });

    it('toggle-focus-mode returns null on repeat', () => {
      const e = mkEvent({ key: 'f', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({ hasOnToggleFocusMode: true, isRepeat: true }));
      expect(result).toBeNull();
    });

    it('refresh does not block on repeat (no repeat guard)', () => {
      const e = mkEvent({ key: 'r', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: true, isRepeat: true }));
      expect(result).toEqual({ type: 'refresh' });
    });
  });

  describe('non-matching key', () => {
    it('returns null for unbound key', () => {
      const e = mkEvent({ key: 'z' });
      const result = resolveKeyboardAction(e, defaultState());
      expect(result).toBeNull();
    });

    it('returns null for random key with no modifiers', () => {
      const e = mkEvent({ key: 'q' });
      const result = resolveKeyboardAction(e, defaultState());
      expect(result).toBeNull();
    });

    it('returns null for key that partially matches a shortcut', () => {
      const e = mkEvent({ key: 'k' });
      const result = resolveKeyboardAction(e, defaultState({ isDesktopLike: true }));
      expect(result).toBeNull();
    });
  });

  describe('zoom takes priority over other shortcuts', () => {
    it('zoom-in fires before terms/modal guard on desktop', () => {
      const e = mkEvent({ key: '=', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true, isTermsOpen: true }));
      expect(result).toEqual({ type: 'zoom-in' });
    });

    it('zoom-in fires before modal guard on desktop', () => {
      const e = mkEvent({ key: '=', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true, isModalOpen: true }));
      expect(result).toEqual({ type: 'zoom-in' });
    });
  });

  describe('custom keybindings', () => {
    it('zoom-in matches custom keybinding', () => {
      const e = mkEvent({ key: 'z', ctrlKey: true, shiftKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktop: true,
        isDesktopLike: true,
        keybindings: { ...defaultBindings, zoomIn: 'ctrl+shift+z' },
      }));
      expect(result).toEqual({ type: 'zoom-in' });
    });

    it('zoom-out matches custom keybinding', () => {
      const e = mkEvent({ key: 'z', altKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        isDesktop: true,
        isDesktopLike: true,
        keybindings: { ...defaultBindings, zoomOut: 'alt+z' },
      }));
      expect(result).toEqual({ type: 'zoom-out' });
    });

    it('sidebar-cursor-mode toggle matches custom keybinding', () => {
      const e = mkEvent({ key: 'x', ctrlKey: true });
      const result = resolveKeyboardAction(e, defaultState({
        hasOnSidebarCursorModeToggle: true,
        keybindings: { ...defaultBindings, sidebarCursorMode: 'ctrl+x' },
      }));
      expect(result).toEqual({ type: 'sidebar-cursor-mode-toggle' });
    });
  });

  describe('empty keybinding strings', () => {
    it('returns null for empty back keybinding', () => {
      const e = mkEvent({ key: 'ArrowLeft', altKey: true });
      const result = resolveKeyboardAction(e, defaultState({ keybindings: { ...defaultBindings, back: '' } }));
      expect(result).toBeNull();
    });

    it('returns null for empty forward keybinding', () => {
      const e = mkEvent({ key: 'ArrowRight', altKey: true });
      const result = resolveKeyboardAction(e, defaultState({ keybindings: { ...defaultBindings, forward: '' } }));
      expect(result).toBeNull();
    });
  });

  describe('close-find escape only when find is open', () => {
    it('does not return close-find when find is not open', () => {
      const e = mkEvent({ key: 'Escape' });
      const result = resolveKeyboardAction(e, defaultState({
        isSearchOpen: false,
        isFindOpen: false,
        hasOnFindClose: true,
        isSettingsOpen: true,
      }));
      expect(result).toEqual({ type: 'close-settings' });
    });
  });

  describe('find-toggle when find is already open', () => {
    it('returns find-toggle even when find is already open (hook decides close vs open)', () => {
      const e = mkEvent({ key: 'f' });
      const result = resolveKeyboardAction(e, defaultState({
        hasOnFindOpen: true,
        isSearchOpen: false,
        isEditableTarget: false,
        isFindOpen: true,
      }));
      expect(result).toEqual({ type: 'find-toggle' });
    });
  });

  describe('meta key zoom on desktop', () => {
    it('zoom-in matches with metaKey', () => {
      const e = mkEvent({ key: '=', metaKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-in' });
    });

    it('zoom-out matches with metaKey', () => {
      const e = mkEvent({ key: '-', metaKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-out' });
    });

    it('zoom-reset matches with metaKey', () => {
      const e = mkEvent({ key: '0', metaKey: true });
      const result = resolveKeyboardAction(e, defaultState({ isDesktop: true, isDesktopLike: true }));
      expect(result).toEqual({ type: 'zoom-reset' });
    });
  });
});
