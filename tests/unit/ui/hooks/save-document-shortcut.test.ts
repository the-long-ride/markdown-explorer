import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '../../../../ui/src/contexts/appStateConstants';
import { ACTIONS_LIST } from '../../../../ui/src/components/Settings/settingsActions';
import { resolveKeyboardAction, type KeyboardState } from '../../../../ui/src/hooks/keyboardUtils';

function state(overrides: Partial<KeyboardState> = {}): KeyboardState {
  return {
    isDesktop: false,
    isDesktopLike: false,
    isVscode: false,
    isTermsOpen: false,
    isModalOpen: false,
    isSearchOpen: false,
    isFindOpen: false,
    isSettingsOpen: false,
    isSidebarCursorMode: false,
    activeSearchScope: 'current',
    keybindings: { ...DEFAULT_KEYBINDINGS },
    hasOnCrossTabSearchOpen: false,
    hasOnFindOpen: false,
    hasOnSidebarCursorModeToggle: false,
    hasOnSidebarCursorModeClose: false,
    hasOnWelcome: false,
    hasOnToggleToc: false,
    hasOnLocateFile: false,
    hasOnOpenBookmarks: false,
    hasOnToggleFocusMode: false,
    hasOnToggleDesktopViewMode: false,
    hasOnToggleFullscreen: false,
    hasOnFindClose: false,
    hasOnSaveCurrentDocument: true,
    isRepeat: false,
    isEditableTarget: false,
    ...overrides,
  } as KeyboardState;
}

describe('Save current document shortcut', () => {
  it('registers Ctrl+S without replacing external Edit', () => {
    expect(DEFAULT_KEYBINDINGS.saveCurrentDocument).toBe('Ctrl+S');
    expect(ACTIONS_LIST.some((action) => action.id === 'saveCurrentDocument')).toBe(true);
    expect(ACTIONS_LIST.some((action) => action.id === 'editCurrentDocument')).toBe(true);
  });

  it('resolves Ctrl/Cmd+S when an in-app save target exists', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    expect(resolveKeyboardAction(event, state())).toEqual({ type: 'save-current-document' });
  });

  it('does not globally intercept Ctrl+S inside the native editor', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    expect(resolveKeyboardAction(event, state({ isEditableTarget: true }))).toBeNull();
  });

  it('does not intercept Ctrl+S when there is no save target', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    expect(resolveKeyboardAction(event, state({ hasOnSaveCurrentDocument: false }))).toBeNull();
  });
});
