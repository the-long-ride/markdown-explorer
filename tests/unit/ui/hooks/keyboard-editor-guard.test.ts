import { afterEach, describe, expect, it } from 'vitest';
import { resolveKeyboardAction, type KeyboardState } from '../../../../ui/src/hooks/useKeyboard';

const keybindings: Record<string, string> = {
  searchCurrent: 'ctrl+k',
  settings: 'ctrl+i',
  toggleSidebar: 'ctrl+b',
  toggleTheme: 'ctrl+l',
  editCurrentDocument: 'ctrl+e',
};

function state(overrides: Partial<KeyboardState> = {}): KeyboardState {
  return {
    isDesktop: false, isDesktopLike: true, isVscode: false, isTermsOpen: false, isModalOpen: false,
    isSearchOpen: false, isFindOpen: false, isSettingsOpen: false, isSidebarCursorMode: false,
    activeSearchScope: 'current', keybindings: { ...keybindings }, hasOnCrossTabSearchOpen: false,
    hasOnFindOpen: false, hasOnSidebarCursorModeToggle: false, hasOnSidebarCursorModeClose: false,
    hasOnWelcome: false, hasOnToggleToc: false, hasOnLocateFile: false, hasOnOpenBookmarks: false,
    hasOnToggleFocusMode: false, hasOnToggleDesktopViewMode: false, hasOnFindClose: false,
    hasOnEditCurrentDocument: true,
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

  it('yields for ANY active Markdown editor shortcut overlapping with app-level shortcuts in source and inline editors', () => {
    for (const editorClass of ['markdown-source-editor', 'markdown-inline-editor']) {
      const target = editorChild(editorClass);

      // Ctrl+B: editorBold vs toggleSidebar
      expect(resolveKeyboardAction(eventOn(target, { key: 'b', ctrlKey: true }), state())).toBeNull();

      // Ctrl+K: editorLink vs searchCurrent
      expect(resolveKeyboardAction(eventOn(target, { key: 'k', ctrlKey: true }), state())).toBeNull();

      // Ctrl+E: custom editorInlineCode: 'Ctrl+E' vs editCurrentDocument
      const inlineCodeConflictState = state({
        isEditableTarget: false,
        keybindings: { ...keybindings, editorInlineCode: 'Ctrl+E' },
      });
      expect(resolveKeyboardAction(eventOn(target, { key: 'e', ctrlKey: true }), inlineCodeConflictState)).toBeNull();

      // Default: Ctrl+E is not swallowed by inline code, resolves to edit-current-document
      expect(resolveKeyboardAction(eventOn(target, { key: 'e', ctrlKey: true }), state({ isEditableTarget: false }))).toEqual({ type: 'edit-current-document' });

      // Ctrl+L: custom editorBold: 'Ctrl+L' vs toggleTheme: 'Ctrl+L'
      const customState = state({
        keybindings: { ...keybindings, editorBold: 'Ctrl+L' },
      });
      expect(resolveKeyboardAction(eventOn(target, { key: 'l', ctrlKey: true }), customState)).toBeNull();
    }
  });

  it('keeps the global shortcuts everywhere outside the editor', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(resolveKeyboardAction(eventOn(input, { key: 'b', ctrlKey: true }), state())).toEqual({ type: 'toggle-sidebar' });
    expect(resolveKeyboardAction(eventOn(input, { key: 'k', ctrlKey: true }), state())).toEqual({ type: 'current-search-toggle' });
    expect(resolveKeyboardAction(eventOn(input, { key: 'l', ctrlKey: true }), state())).toEqual({ type: 'toggle-theme' });

    const nonEditable = document.createElement('div');
    document.body.appendChild(nonEditable);
    expect(resolveKeyboardAction(eventOn(nonEditable, { key: 'e', ctrlKey: true }), state({ isEditableTarget: false }))).toEqual({ type: 'edit-current-document' });
  });

  it('falls back to global shortcut when the editor shortcut is disabled', () => {
    const target = editorChild('markdown-source-editor');
    const disabledState = state({
      disabledKeybindings: { editorBold: true },
    });
    // With editorBold disabled, Ctrl+B falls through to toggleSidebar
    expect(resolveKeyboardAction(eventOn(target, { key: 'b', ctrlKey: true }), disabledState)).toEqual({ type: 'toggle-sidebar' });
  });

  it('leaves Escape to the inline block editor only', () => {
    const inline = editorChild('markdown-inline-editor');
    const plain = editorChild('markdown-source-editor');
    expect(resolveKeyboardAction(eventOn(inline, { key: 'Escape' }), state({ isSearchOpen: true }))).toBeNull();
    expect(resolveKeyboardAction(eventOn(plain, { key: 'Escape' }), state({ isSearchOpen: true }))).not.toBeNull();
  });

  it('yields for editor font-size shortcuts instead of desktop zoom', () => {
    for (const editorClass of ['markdown-source-editor', 'markdown-inline-editor']) {
      const target = editorChild(editorClass);
      const desktopState = state({
        isDesktop: true,
        keybindings: { ...keybindings, zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-' },
      });
      expect(resolveKeyboardAction(eventOn(target, { key: '=', ctrlKey: true }), desktopState)).toBeNull();
      expect(resolveKeyboardAction(eventOn(target, { key: '-', ctrlKey: true }), desktopState)).toBeNull();
    }
  });
});
