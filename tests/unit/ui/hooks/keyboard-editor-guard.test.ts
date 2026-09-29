import { afterEach, describe, expect, it } from 'vitest';
import { resolveKeyboardAction, type KeyboardState } from '../../../../ui/src/hooks/useKeyboard';

const keybindings: Record<string, string> = {
  searchCurrent: 'ctrl+k',
  settings: 'ctrl+i',
  toggleSidebar: 'ctrl+b',
};

function state(overrides: Partial<KeyboardState> = {}): KeyboardState {
  return {
    isDesktop: false, isDesktopLike: true, isVscode: false, isTermsOpen: false, isModalOpen: false,
    isSearchOpen: false, isFindOpen: false, isSettingsOpen: false, isSidebarCursorMode: false,
    activeSearchScope: 'current', keybindings: { ...keybindings }, hasOnCrossTabSearchOpen: false,
    hasOnFindOpen: false, hasOnSidebarCursorModeToggle: false, hasOnSidebarCursorModeClose: false,
    hasOnWelcome: false, hasOnToggleToc: false, hasOnLocateFile: false, hasOnOpenBookmarks: false,
    hasOnToggleFocusMode: false, hasOnToggleDesktopViewMode: false, hasOnFindClose: false,
    isRepeat: false, isEditableTarget: true,
    ...overrides,
  } as KeyboardState;
}

function eventOn(target: EventTarget, init: KeyboardEventInit & { key: string }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', init);
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

function editorChild(className: string): HTMLElement {
  const editor = document.createElement('div');
  editor.className = className;
  const child = document.createElement('textarea');
  editor.appendChild(child);
  document.body.appendChild(editor);
  return child;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('resolveKeyboardAction inside Markdown editors', () => {
  it('leaves Mod+B/I/K formatting chords to the editor', () => {
    const target = editorChild('markdown-source-editor');
    expect(resolveKeyboardAction(eventOn(target, { key: 'b', ctrlKey: true }), state())).toBeNull();
    expect(resolveKeyboardAction(eventOn(target, { key: 'i', ctrlKey: true }), state())).toBeNull();
    expect(resolveKeyboardAction(eventOn(target, { key: 'k', ctrlKey: true }), state())).toBeNull();
  });

  it('keeps the global shortcuts everywhere else', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(resolveKeyboardAction(eventOn(input, { key: 'b', ctrlKey: true }), state())).toEqual({ type: 'toggle-sidebar' });
    expect(resolveKeyboardAction(eventOn(input, { key: 'k', ctrlKey: true }), state())).toEqual({ type: 'current-search-toggle' });
  });

  it('leaves Escape to the inline block editor only', () => {
    const inline = editorChild('markdown-inline-editor');
    const plain = editorChild('markdown-source-editor');
    expect(resolveKeyboardAction(eventOn(inline, { key: 'Escape' }), state({ isSearchOpen: true }))).toBeNull();
    expect(resolveKeyboardAction(eventOn(plain, { key: 'Escape' }), state({ isSearchOpen: true }))).not.toBeNull();
  });
});
