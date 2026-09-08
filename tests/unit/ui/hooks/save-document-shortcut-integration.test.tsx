import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboard } from '../../../../ui/src/hooks/useKeyboard';
import { createEditableDocumentSession, documentSessionKey, replaceWorkingSource } from '../../../../ui/src/editor/documentSession';

const saveDocument = vi.fn();
const filePath = '/docs/a.md';
let state: any;

vi.mock('../../../../ui/src/contexts/NavigationContext', () => ({
  useNavigation: () => ({ back: vi.fn(), forward: vi.fn() }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: vi.fn() }),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state,
    saveDocument,
    toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    navigate: vi.fn(),
    openInEditor: vi.fn(),
    refresh: vi.fn(),
    closeContentTab: vi.fn(),
    closeAllContentTabs: vi.fn(),
    closeContentTabsToRight: vi.fn(),
    closeOtherContentTabs: vi.fn(),
  }),
}));

const props = {
  onSearchOpen: vi.fn(),
  onSearchClose: vi.fn(),
  onSettingsOpen: vi.fn(),
  onSettingsClose: vi.fn(),
  onExpandAll: vi.fn(),
  onCollapseAll: vi.fn(),
  isSearchOpen: false,
  isSettingsOpen: false,
  isModalOpen: false,
  isTermsOpen: false,
};

function fireSave(target: EventTarget = document) {
  const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
}

describe('global Save current document shortcut', () => {
  beforeEach(() => {
    saveDocument.mockClear();
    const session = replaceWorkingSource(createEditableDocumentSession(filePath, '# A', '1:3'), '# B');
    state = {
      appRuntime: 'web',
      currentFile: filePath,
      activeContentTabPath: null,
      documentSessions: { [documentSessionKey(filePath)]: session },
      contentTabs: [],
      settings: { keybindings: { saveCurrentDocument: 'Ctrl+S' }, disabledKeybindings: {} },
    };
  });

  it('saves the dirty writable active Markdown document with file tabs disabled', () => {
    renderHook(() => useKeyboard(props));
    fireSave();
    expect(saveDocument).toHaveBeenCalledWith(filePath);
  });

  it('allows Save for a permission-gated editable session', () => {
    renderHook(() => useKeyboard(props));
    fireSave();
    expect(saveDocument).toHaveBeenCalledWith(filePath);
  });

  it('does not save a clean document', () => {
    state.documentSessions[documentSessionKey(filePath)] = createEditableDocumentSession(filePath, '# A', '1:3');
    renderHook(() => useKeyboard(props));
    fireSave();
    expect(saveDocument).not.toHaveBeenCalled();
  });

  it('does not save when no editable session exists', () => {
    state.documentSessions = {};
    renderHook(() => useKeyboard(props));
    fireSave();
    expect(saveDocument).not.toHaveBeenCalled();
  });
});
