import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboard } from '../../../../ui/src/hooks/useKeyboard';
import { createEditableDocumentSession, documentSessionKey, replaceWorkingSource } from '../../../../ui/src/editor/documentSession';

const mockPostMessage = vi.fn();
const guardUnsavedChanges = vi.fn();
let sessions: Record<string, unknown> = {};

vi.mock('../../../../ui/src/contexts/NavigationContext', () => ({
  useNavigation: () => ({ back: vi.fn(), forward: vi.fn(), canGoBack: true, canGoForward: true, push: vi.fn(), setScope: vi.fn() }),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: { settings: { keybindings: { workspaceSelection: 'ctrl+shift+w' } }, documentSessions: sessions },
    navigate: vi.fn(),
    refresh: vi.fn(),
    toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    guardUnsavedChanges,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: mockPostMessage, onMessage: vi.fn(), getState: vi.fn(), setState: vi.fn(), copyToClipboard: vi.fn() }),
}));

const baseProps = {
  onSearchOpen: vi.fn(), onSearchClose: vi.fn(), onSettingsOpen: vi.fn(), onSettingsClose: vi.fn(),
  onExpandAll: vi.fn(), onCollapseAll: vi.fn(), isSearchOpen: false, isSettingsOpen: false, isModalOpen: false,
  isTermsOpen: false, isFindOpen: false, isSidebarCursorMode: false, activeSearchScope: 'current' as const,
  onFindOpen: vi.fn(), onFindClose: vi.fn(),
};

function pressWorkspaceSelection() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
}

describe('workspace-selection shortcut without a dedicated handler', () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
    guardUnsavedChanges.mockReset();
    sessions = {};
    (window as any).electronAPI = {};
  });
  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('closes the workspace immediately when nothing is unsaved', () => {
    renderHook(() => useKeyboard(baseProps));
    pressWorkspaceSelection();
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'closeWorkspace' });
    expect(guardUnsavedChanges).not.toHaveBeenCalled();
  });

  it('holds the close behind the unsaved-changes prompt when a document is dirty', () => {
    const filePath = '/docs/a.md';
    sessions = { [documentSessionKey(filePath)]: replaceWorkingSource(createEditableDocumentSession(filePath, '# A', '1:3'), '# B') };
    let commit: (() => void) | null = null;
    guardUnsavedChanges.mockImplementation((_paths: string[], next: () => void) => { commit = next; });

    renderHook(() => useKeyboard(baseProps));
    pressWorkspaceSelection();

    expect(guardUnsavedChanges).toHaveBeenCalledWith([filePath], expect.any(Function), undefined);
    expect(mockPostMessage).not.toHaveBeenCalledWith({ command: 'closeWorkspace' });
    commit?.();
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'closeWorkspace' });
  });
});
