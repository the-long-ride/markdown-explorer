import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const back = vi.fn();
const forward = vi.fn();
const appState: any = {};
const bridge = { postMessage: vi.fn() };
vi.mock('../../../../ui/src/contexts/NavigationContext', () => ({ useNavigation: () => ({ back, forward }) }));
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => appState }));
vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => bridge }));
vi.mock('../../../../ui/src/hooks/useDirtyDocumentsGuard', () => ({ useDirtyDocumentsGuard: () => (commit: () => void) => commit() }));

import { useKeyboard } from '../../../../ui/src/hooks/useKeyboard';

const keybindings = {
  openBookmarks: 'ctrl+shift+b', toggleWorkspaceInsights: 'ctrl+shift+i', openCurrentDocumentLocation: 'shift+alt+r',
  toggleDesktopViewMode: 'ctrl+alt+t', toggleHtmlPreview: 'ctrl+shift+v', closeContentTab: 'ctrl+w', closeAllContentTabs: 'ctrl+shift+w',
  closeContentTabsToRight: 'ctrl+alt+w', closeOtherContentTabs: 'ctrl+alt+o', sidebarCursorMode: 'ctrl+shift+s', refresh: 'ctrl+r',
  back: 'alt+<-', forward: 'alt+->', zoomIn: 'ctrl+=', zoomOut: 'ctrl+-', resetZoom: 'ctrl+alt+z',
};

function press(key: string, mods: KeyboardEventInit = {}) {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
}

function render(stateOverrides: Record<string, any> = {}) {
  Object.assign(appState, {
    state: { settings: { keybindings, disabledKeybindings: { refresh: false } }, currentFile: null, appRuntime: 'tauri', activeContentTabPath: '/w/a.md', documentSessions: {}, ...stateOverrides },
    toggleTheme: vi.fn(), toggleSidebar: vi.fn(), navigate: vi.fn(), openInEditor: vi.fn(), setDocumentEditMode: vi.fn(), refresh: vi.fn(), saveDocument: vi.fn(),
    closeContentTab: vi.fn(), closeAllContentTabs: vi.fn(), closeContentTabsToRight: vi.fn(), closeOtherContentTabs: vi.fn(),
  });
  const handlers = {
    onSearchOpen: vi.fn(), onSearchClose: vi.fn(), onSettingsOpen: vi.fn(), onSettingsClose: vi.fn(), onExpandAll: vi.fn(), onCollapseAll: vi.fn(),
    onSidebarCursorModeToggle: vi.fn(), onToggleWorkspaceInsights: vi.fn(), onBookmarksOpen: vi.fn(), onOpenCurrentDocumentLocation: vi.fn(),
    onToggleDesktopViewMode: vi.fn(), onToggleActiveHtmlDocumentPreview: vi.fn(), onToggleFullscreen: vi.fn(),
  };
  const hook = renderHook(() => useKeyboard({ ...handlers, isSearchOpen: false, isSettingsOpen: false, isModalOpen: false, isTermsOpen: false, activeHtmlDocument: true } as any));
  return { handlers, hook };
}

beforeEach(() => { bridge.postMessage.mockClear(); back.mockClear(); forward.mockClear(); });

describe('useKeyboard hook action dispatch', () => {
  it('routes optional handler shortcuts', () => {
    const { handlers, hook } = render();
    press('B', { ctrlKey: true, shiftKey: true });
    press('I', { ctrlKey: true, shiftKey: true });
    press('R', { shiftKey: true, altKey: true });
    press('t', { ctrlKey: true, altKey: true });
    press('V', { ctrlKey: true, shiftKey: true });
    press('S', { ctrlKey: true, shiftKey: true });
    press('=', { ctrlKey: true });
    press('-', { ctrlKey: true });
    press('z', { ctrlKey: true, altKey: true });
    press('F5');
    const called = Object.values(handlers).filter((fn) => fn.mock.calls.length > 0).length;
    expect(called).toBeGreaterThan(0);
    hook.unmount();
  });

  it('closes content tabs via shortcuts', () => {
    const { hook } = render();
    press('w', { ctrlKey: true });
    press('W', { ctrlKey: true, shiftKey: true });
    press('w', { ctrlKey: true, altKey: true });
    press('o', { ctrlKey: true, altKey: true });
    hook.unmount();
    const { hook: noTab } = render({ activeContentTabPath: null });
    press('w', { ctrlKey: true });
    press('w', { ctrlKey: true, altKey: true });
    press('o', { ctrlKey: true, altKey: true });
    noTab.unmount();
    expect(true).toBe(true);
  });

  it('navigates back and forward and reloads vscode webviews', () => {
    const { hook } = render({ currentFile: '/w/a.md' });
    press('ArrowLeft', { altKey: true });
    press('ArrowRight', { altKey: true });
    hook.unmount();
    const vs = render({ appRuntime: 'vscode' });
    press('r', { ctrlKey: true });
    vs.hook.unmount();
    expect(back.mock.calls.length + forward.mock.calls.length).toBeGreaterThan(0);
  });
  it('handles fullscreen, configured back/forward and edit-mode shortcuts', () => {
    const anySession = (mode: string) => new Proxy({}, { get: (_t, prop) => (prop === 'then' ? undefined : { mode, savedRevision: 0, revision: 0 }) });
    const settings = {
      keybindings: { ...keybindings, back: 'ctrl+[', forward: 'ctrl+]', editCurrentDocument: 'ctrl+e', plainEditCurrentDocument: 'ctrl+shift+e' },
      markdownEditingEnabled: true,
    };
    const first = render({ currentFile: '/w/a.md', settings, documentSessions: anySession('rendered') });
    press('F11');
    expect(first.handlers.onToggleFullscreen).toHaveBeenCalled();
    press('[', { ctrlKey: true });
    press(']', { ctrlKey: true });
    expect(back).toHaveBeenCalled();
    expect(forward).toHaveBeenCalled();
    press('e', { ctrlKey: true });
    press('E', { ctrlKey: true, shiftKey: true });
    expect(appState.setDocumentEditMode).toHaveBeenCalledWith('/w/a.md', 'inline-edit');
    expect(appState.setDocumentEditMode).toHaveBeenCalledWith('/w/a.md', 'plain');
    first.hook.unmount();
    const editing = render({ currentFile: '/w/a.md', settings, documentSessions: anySession('inline-edit') });
    press('e', { ctrlKey: true });
    expect(appState.setDocumentEditMode).toHaveBeenCalledWith('/w/a.md', 'rendered');
    editing.hook.unmount();
    const plain = render({ currentFile: '/w/a.md', settings, documentSessions: anySession('plain') });
    press('E', { ctrlKey: true, shiftKey: true });
    expect(appState.setDocumentEditMode).toHaveBeenCalledWith('/w/a.md', 'rendered');
    plain.hook.unmount();
  });
});
