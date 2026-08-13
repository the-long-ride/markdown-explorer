import { describe, it, expect } from 'vitest';
import { matchesShortcut, isEditableTarget, resolveKeyboardAction } from '../../../../ui/src/hooks/useKeyboard';
import { getDefaultKeybindings } from '../../../../ui/src/contexts/appStateConstants';

function mockKeyboardEvent(opts: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', opts);
}

describe('useKeyboard pure functions', () => {
  const keyboardState = (isDesktop: boolean, workspaceSelection: string) => ({
    isDesktop,
    isDesktopLike: isDesktop,
    isVscode: !isDesktop,
    isTermsOpen: false,
    isModalOpen: false,
    isSearchOpen: false,
    isFindOpen: false,
    isSettingsOpen: false,
    isSidebarCursorMode: false,
    activeSearchScope: 'current' as const,
    keybindings: { workspaceSelection },
    hasOnCrossTabSearchOpen: false,
    hasOnFindOpen: false,
    hasOnSidebarCursorModeToggle: false,
    hasOnSidebarCursorModeClose: false,
    hasOnWelcome: false,
    hasOnEditCurrentDocument: false,
    hasOnToggleToc: false,
    hasOnLocateFile: false,
    hasOnOpenBookmarks: false,
    hasOnToggleFocusMode: false,
    hasOnToggleDesktopViewMode: false,
    hasOnToggleFullscreen: false,
    hasOnFindClose: false,
    isRepeat: false,
    isEditableTarget: false,
  });

  it('uses Ctrl+N as desktop workspace-selection default', () => {
    expect(getDefaultKeybindings(true).workspaceSelection).toBe('Ctrl+N');
  });

  it('uses Ctrl+Alt+W as non-desktop workspace-selection default', () => {
    expect(getDefaultKeybindings(false).workspaceSelection).toBe('Ctrl+Alt+W');
  });

  it('resolves desktop Ctrl+N to workspace selection', () => {
    expect(resolveKeyboardAction(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }), keyboardState(true, 'Ctrl+N')))
      .toEqual({ type: 'workspace-selection' });
  });

  it('resolves non-desktop Ctrl+Alt+W to workspace selection', () => {
    expect(resolveKeyboardAction(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, altKey: true }), keyboardState(false, 'Ctrl+Alt+W')))
      .toEqual({ type: 'workspace-selection' });
  });

  it('resolves Edit only when the host exposes openInEditor', () => {
    const state = {
      ...keyboardState(true, 'Ctrl+N'),
      keybindings: { editCurrentDocument: 'Ctrl+E' },
      hasOnEditCurrentDocument: true,
    };
    const event = new KeyboardEvent('keydown', { key: 'e', ctrlKey: true });
    expect(resolveKeyboardAction(event, state)).toEqual({ type: 'edit-current-document' });
    expect(resolveKeyboardAction(event, { ...state, hasOnEditCurrentDocument: false })).toBeNull();
  });

  it('does not intercept Edit while typing in an editable target', () => {
    const state = {
      ...keyboardState(false, 'Ctrl+Alt+W'),
      keybindings: { editCurrentDocument: 'Ctrl+Alt+E' },
      hasOnEditCurrentDocument: true,
      isEditableTarget: true,
    };
    expect(resolveKeyboardAction(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, altKey: true }), state)).toBeNull();
  });

  describe('matchesShortcut', () => {
    it('matches simple key', () => {
      const e = mockKeyboardEvent({ key: 'Escape' });
      expect(matchesShortcut(e, 'escape')).toBe(true);
    });

    it('matches with ctrl modifier', () => {
      const e = mockKeyboardEvent({ key: 'f', ctrlKey: true });
      expect(matchesShortcut(e, 'ctrl+f')).toBe(true);
    });

    it('does not match without required ctrl', () => {
      const e = mockKeyboardEvent({ key: 'f' });
      expect(matchesShortcut(e, 'ctrl+f')).toBe(false);
    });

    it('matches with cmd modifier (maps to meta)', () => {
      const e = mockKeyboardEvent({ key: 'f', metaKey: true });
      expect(matchesShortcut(e, 'cmd+f')).toBe(true);
    });

    it('matches ctrl as cmd', () => {
      const e = mockKeyboardEvent({ key: 'p', ctrlKey: true });
      expect(matchesShortcut(e, 'cmd+p')).toBe(true);
    });

    it('matches with shift modifier', () => {
      const e = mockKeyboardEvent({ key: 'f', ctrlKey: true, shiftKey: true });
      expect(matchesShortcut(e, 'ctrl+shift+f')).toBe(true);
    });

    it('does not match when extra modifier is present', () => {
      const e = mockKeyboardEvent({ key: 'f', ctrlKey: true, shiftKey: true });
      expect(matchesShortcut(e, 'ctrl+f')).toBe(false);
    });

    it('matches with alt modifier', () => {
      const e = mockKeyboardEvent({ key: 's', altKey: true });
      expect(matchesShortcut(e, 'alt+s')).toBe(true);
    });

    it('matches arrow left with <- alias', () => {
      const e = mockKeyboardEvent({ key: 'ArrowLeft', altKey: true });
      expect(matchesShortcut(e, 'alt+<-')).toBe(true);
    });

    it('matches arrow right with -> alias', () => {
      const e = mockKeyboardEvent({ key: 'ArrowRight', altKey: true });
      expect(matchesShortcut(e, 'alt+->')).toBe(true);
    });

    it('matches arrow left with left alias', () => {
      const e = mockKeyboardEvent({ key: 'ArrowLeft', altKey: true });
      expect(matchesShortcut(e, 'alt+left')).toBe(true);
    });

    it('matches arrow right with right alias', () => {
      const e = mockKeyboardEvent({ key: 'ArrowRight' });
      expect(matchesShortcut(e, 'right')).toBe(true);
    });

    it('returns false for empty shortcut', () => {
      const e = mockKeyboardEvent({ key: 'a' });
      expect(matchesShortcut(e, '')).toBe(false);
    });

    it('is case-insensitive', () => {
      const e = mockKeyboardEvent({ key: 'F', ctrlKey: true });
      expect(matchesShortcut(e, 'Ctrl+F')).toBe(true);
    });

    it('matches multi-modifier shortcut', () => {
      const e = mockKeyboardEvent({ key: 'k', ctrlKey: true, shiftKey: true, altKey: true });
      expect(matchesShortcut(e, 'ctrl+shift+alt+k')).toBe(true);
    });
  });

  describe('isEditableTarget', () => {
    it('returns false for null target', () => {
      expect(isEditableTarget(null)).toBe(false);
    });

    it('returns true for contentEditable element', () => {
      const el = document.createElement('div');
      el.setAttribute('contenteditable', 'true');
      Object.defineProperty(el, 'isContentEditable', { value: true });
      expect(isEditableTarget(el)).toBe(true);
    });

    it('returns true for input element', () => {
      const el = document.createElement('input');
      expect(isEditableTarget(el)).toBe(true);
    });

    it('returns true for textarea element', () => {
      const el = document.createElement('textarea');
      expect(isEditableTarget(el)).toBe(true);
    });

    it('returns true for select element', () => {
      const el = document.createElement('select');
      expect(isEditableTarget(el)).toBe(true);
    });

    it('returns false for div element', () => {
      const el = document.createElement('div');
      expect(isEditableTarget(el)).toBe(false);
    });

    it('returns false for button element', () => {
      const el = document.createElement('button');
      expect(isEditableTarget(el)).toBe(false);
    });
  });
});
