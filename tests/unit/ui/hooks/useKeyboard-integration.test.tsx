import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboard } from '../../../../ui/src/hooks/useKeyboard';

const defaultKeybindings: Record<string, string> = {
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
  sidebarCursorMode: 'ctrl+shift+s',
  refresh: 'ctrl+r',
  collapseAll: 'ctrl+shift+c',
  expandAll: 'ctrl+shift+e',
  workspaceSelection: 'ctrl+shift+w',
  toggleSidebar: 'alt+a',
};

const defaultProps = {
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
  isFindOpen: false,
  isSidebarCursorMode: false,
  activeSearchScope: 'current' as const,
  onFindOpen: vi.fn(),
  onFindClose: vi.fn(),
  onCrossTabSearchOpen: vi.fn(),
  onSidebarCursorModeToggle: vi.fn(),
  onSidebarCursorModeClose: vi.fn(),
  onWelcome: vi.fn(),
  onToggleToc: vi.fn(),
  onLocateFile: vi.fn(),
  onToggleFocusMode: vi.fn(),
  onWorkspaceSelection: vi.fn(),
};

function fireKeyDown(opts: Partial<KeyboardEventInit> & { key: string }) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
  return event;
}

function fireMouseUp(button: number) {
  const event = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    button,
  } as MouseEventInit);
  window.dispatchEvent(event);
  return event;
}

const mockBack = vi.fn();
const mockForward = vi.fn();
const mockNavigate = vi.fn();
const mockRefresh = vi.fn();
const mockToggleTheme = vi.fn();
const mockToggleSidebar = vi.fn();
const mockPostMessage = vi.fn();

vi.mock('../../../../ui/src/contexts/NavigationContext', () => ({
  useNavigation: () => ({
    back: mockBack,
    forward: mockForward,
    canGoBack: true,
    canGoForward: true,
    push: vi.fn(),
    setScope: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: { settings: { keybindings: defaultKeybindings } },
    navigate: mockNavigate,
    refresh: mockRefresh,
    toggleTheme: mockToggleTheme,
    toggleSidebar: mockToggleSidebar,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: mockPostMessage,
    onMessage: vi.fn(),
    getState: vi.fn(),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  }),
}));

describe('useKeyboard hook integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.values(defaultProps).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear();
    });
    mockBack.mockClear();
    mockForward.mockClear();
    mockNavigate.mockClear();
    mockRefresh.mockClear();
    mockToggleTheme.mockClear();
    mockToggleSidebar.mockClear();
    mockPostMessage.mockClear();
    delete (window as any).electronAPI;
    delete (window as any).__chromeExtBus;
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    delete (window as any).__chromeExtBus;
  });

  it('calls onSearchClose on Escape when search is open', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSearchOpen: true }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onSearchClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onSearchClose on Escape when search is closed', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSearchOpen: false }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onSearchClose).not.toHaveBeenCalled();
  });

  it('calls onFindClose on Escape when find is open', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isFindOpen: true, isSearchOpen: false }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onFindClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onFindClose on Escape when find is closed', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isFindOpen: false, isSearchOpen: false }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onFindClose).not.toHaveBeenCalled();
  });

  it('calls onSettingsClose on Escape when settings is open', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSettingsOpen: true, isSearchOpen: false, isFindOpen: false }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onSettingsClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onSettingsClose on Escape when settings is closed', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSettingsOpen: false, isSearchOpen: false, isFindOpen: false }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onSettingsClose).not.toHaveBeenCalled();
  });

  it('calls onSidebarCursorModeClose on Escape when sidebar cursor mode is active', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSidebarCursorMode: true }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onSidebarCursorModeClose).toHaveBeenCalledTimes(1);
  });

  it('prioritizes sidebar cursor mode close over search close on Escape', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSidebarCursorMode: true, isSearchOpen: true }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onSidebarCursorModeClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSearchClose).not.toHaveBeenCalled();
  });

  it('prioritizes search close over find close on Escape', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSearchOpen: true, isFindOpen: true }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onSearchClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onFindClose).not.toHaveBeenCalled();
  });

  it('calls onSearchOpen on Ctrl+K on non-desktop (no electronAPI, no chromeExtBus)', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'k', ctrlKey: true });
    expect(defaultProps.onSearchOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onSearchOpen on Cmd+K on non-desktop', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'k', metaKey: true });
    expect(defaultProps.onSearchOpen).toHaveBeenCalledTimes(1);
  });

  it('does not call onSearchOpen on Ctrl+Shift+K (reserved for cross-tab)', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'K', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onSearchOpen).not.toHaveBeenCalled();
  });

  it('toggles search close on Ctrl+K when search already open with current scope', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSearchOpen: true, activeSearchScope: 'current' }),
    );
    fireKeyDown({ key: 'k', ctrlKey: true });
    expect(defaultProps.onSearchClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSearchOpen).not.toHaveBeenCalled();
  });

  it('calls onCrossTabSearchOpen on Ctrl+Shift+K when desktop-like', () => {
    (window as any).__chromeExtBus = {};
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'K', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onCrossTabSearchOpen).toHaveBeenCalledTimes(1);
  });

  it('closes cross-tab search when Ctrl+Shift+K pressed and search open with all-tabs scope', () => {
    (window as any).__chromeExtBus = {};
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSearchOpen: true, activeSearchScope: 'all-tabs' }),
    );
    fireKeyDown({ key: 'K', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onSearchClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onCrossTabSearchOpen).not.toHaveBeenCalled();
  });

  it('calls onFindOpen on find shortcut key when not search open and not editable', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'f' });
    expect(defaultProps.onFindOpen).toHaveBeenCalledTimes(1);
  });

  it('does not call onFindOpen when search is open', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSearchOpen: true }),
    );
    fireKeyDown({ key: 'f', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onFindOpen).not.toHaveBeenCalled();
  });

  it('calls back on mouse button 3', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireMouseUp(3);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('calls forward on mouse button 4', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireMouseUp(4);
    expect(mockForward).toHaveBeenCalledTimes(1);
  });

  it('does not call back or forward on mouse button 0', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireMouseUp(0);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockForward).not.toHaveBeenCalled();
  });

  it('does not call back on mouse button 3 when terms open', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isTermsOpen: true }),
    );
    fireMouseUp(3);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('does not call forward on mouse button 4 when terms open', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isTermsOpen: true }),
    );
    fireMouseUp(4);
    expect(mockForward).not.toHaveBeenCalled();
  });

  it('dispatches zoom-in on pinching (ctrl+wheel up)', () => {
    (window as any).electronAPI = {};
    renderHook(() => useKeyboard(defaultProps));
    const event = new WheelEvent('wheel', {
      ctrlKey: true,
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'zoom-in' });
  });

  it('dispatches zoom-out on pinching (ctrl+wheel down)', () => {
    (window as any).electronAPI = {};
    renderHook(() => useKeyboard(defaultProps));
    const event = new WheelEvent('wheel', {
      ctrlKey: true,
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'zoom-out' });
  });

  it('does not attach wheel handler when not desktop (no electronAPI)', () => {
    renderHook(() => useKeyboard(defaultProps));
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useKeyboard(defaultProps));
    const wheelCalls = addSpy.mock.calls.filter(
      (call) => call[0] === 'wheel',
    );
    expect(wheelCalls.length).toBe(0);
    addSpy.mockRestore();
  });

  it('removes keydown and mouseup listeners on unmount', () => {
    const removeDocSpy = vi.spyOn(document, 'removeEventListener');
    const removeWinSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useKeyboard(defaultProps));
    unmount();
    expect(removeDocSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(removeWinSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    removeDocSpy.mockRestore();
    removeWinSpy.mockRestore();
  });

  it('does not fire any action on Escape when nothing is open', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isSearchOpen: false, isFindOpen: false, isSettingsOpen: false, isSidebarCursorMode: false }),
    );
    fireKeyDown({ key: 'Escape' });
    expect(defaultProps.onSearchClose).not.toHaveBeenCalled();
    expect(defaultProps.onFindClose).not.toHaveBeenCalled();
    expect(defaultProps.onSettingsClose).not.toHaveBeenCalled();
    expect(defaultProps.onSidebarCursorModeClose).not.toHaveBeenCalled();
  });

  it('calls toggleTheme on Ctrl+Shift+T keybinding match', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 't', ctrlKey: true, shiftKey: true });
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('does not call toggleTheme on repeated Ctrl+Shift+T', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 't', ctrlKey: true, shiftKey: true, repeat: true });
    expect(mockToggleTheme).not.toHaveBeenCalled();
  });

  it('calls refresh on matching keybinding across runtimes', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'r', ctrlKey: true });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not call refresh when typing in an editable target', () => {
    renderHook(() => useKeyboard(defaultProps));
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireKeyDown({ key: 'r', target: input });
    expect(mockRefresh).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('calls toggleSidebar on Alt+A (universal binding)', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'a', altKey: true });
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('calls toggleSidebar on Alt+A when desktop-like', () => {
    (window as any).__chromeExtBus = {};
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'a', altKey: true });
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('does not call toggleSidebar on repeated Alt+A', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'a', altKey: true, repeat: true });
    expect(mockToggleSidebar).not.toHaveBeenCalled();
  });

  it('calls onCollapseAll on Ctrl+Shift+C when desktop-like', () => {
    (window as any).__chromeExtBus = {};
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'c', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onCollapseAll).toHaveBeenCalledTimes(1);
  });

  it('calls onExpandAll on Ctrl+Shift+E when desktop-like', () => {
    (window as any).__chromeExtBus = {};
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'e', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onExpandAll).toHaveBeenCalledTimes(1);
  });

  it('dispatches closeWorkspace on workspace-selection action', () => {
    (window as any).__chromeExtBus = {};
    const { onWorkspaceSelection, ...legacyProps } = defaultProps;
    renderHook(() => useKeyboard(legacyProps));
    fireKeyDown({ key: 'w', ctrlKey: true, shiftKey: true });
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'closeWorkspace' });
  });

  it('calls workspace-selection callback instead of closing directly when provided', () => {
    (window as any).__chromeExtBus = {};
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'w', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onWorkspaceSelection).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).not.toHaveBeenCalledWith({ command: 'closeWorkspace' });
  });

  it('does not fire actions when isModalOpen is true', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isModalOpen: true }),
    );
    fireKeyDown({ key: 'k', ctrlKey: true });
    expect(defaultProps.onSearchOpen).not.toHaveBeenCalled();
  });

  it('does not fire actions when isTermsOpen is true', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isTermsOpen: true }),
    );
    fireKeyDown({ key: 'k', ctrlKey: true });
    expect(defaultProps.onSearchOpen).not.toHaveBeenCalled();
  });

  it('calls onWelcome on Alt+Home when provided', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'Home', altKey: true });
    expect(defaultProps.onWelcome).toHaveBeenCalledTimes(1);
  });

  it('calls navigate(null) when welcome shortcut pressed and onWelcome not provided', () => {
    const { onWelcome, ...propsWithoutWelcome } = defaultProps as any;
    renderHook(() => useKeyboard(propsWithoutWelcome));
    fireKeyDown({ key: 'Home', altKey: true });
    expect(mockNavigate).toHaveBeenCalledWith(null);
  });

  it('calls onSearchOpen on Ctrl+K toggle when search is closed (desktop-like)', () => {
    (window as any).__chromeExtBus = {};
    renderHook(() => useKeyboard({ ...defaultProps, isSearchOpen: false }));
    fireKeyDown({ key: 'k', ctrlKey: true });
    expect(defaultProps.onSearchOpen).toHaveBeenCalledTimes(1);
  });

  it('dispatches zoom-out on Ctrl+- when desktop', () => {
    (window as any).electronAPI = {};
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: '-', ctrlKey: true });
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'zoom-out' });
  });

  it('dispatches zoom-in on Ctrl+= when desktop', () => {
    (window as any).electronAPI = {};
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: '=', ctrlKey: true });
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'zoom-in' });
  });

  it('handles zoom-reset on Ctrl+0 when desktop without dispatching message', () => {
    (window as any).electronAPI = {};
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: '0', ctrlKey: true });
    expect(mockPostMessage).not.toHaveBeenCalledWith({ command: 'zoom-reset' });
  });

  it('calls onSettingsOpen on Ctrl+, when settings are closed', () => {
    renderHook(() => useKeyboard({ ...defaultProps, isSettingsOpen: false }));
    fireKeyDown({ key: ',', ctrlKey: true });
    expect(defaultProps.onSettingsOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onSettingsClose on Ctrl+, when settings are open', () => {
    renderHook(() => useKeyboard({ ...defaultProps, isSettingsOpen: true }));
    fireKeyDown({ key: ',', ctrlKey: true });
    expect(defaultProps.onSettingsClose).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleToc on Ctrl+Shift+U when provided', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'u', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onToggleToc).toHaveBeenCalledTimes(1);
  });

  it('does not call onToggleToc on repeated keydown', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'u', ctrlKey: true, shiftKey: true, repeat: true });
    expect(defaultProps.onToggleToc).not.toHaveBeenCalled();
  });

  it('calls onLocateFile on Ctrl+Shift+L when not editable target', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'l', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onLocateFile).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleFocusMode on Ctrl+Shift+F when provided', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'f', ctrlKey: true, shiftKey: true });
    expect(defaultProps.onToggleFocusMode).toHaveBeenCalledTimes(1);
  });

  it('does not call onToggleFocusMode on repeated keydown', () => {
    renderHook(() => useKeyboard(defaultProps));
    fireKeyDown({ key: 'f', ctrlKey: true, shiftKey: true, repeat: true });
    expect(defaultProps.onToggleFocusMode).not.toHaveBeenCalled();
  });

  it('find toggle closes find when already open', () => {
    renderHook(() =>
      useKeyboard({ ...defaultProps, isFindOpen: true }),
    );
    fireKeyDown({ key: 'f' });
    expect(defaultProps.onFindClose).toHaveBeenCalledTimes(1);
  });

  it('settings toggle opens on Ctrl+, when closed', () => {
    renderHook(() => useKeyboard({ ...defaultProps, isSettingsOpen: false }));
    fireKeyDown({ key: ',', ctrlKey: true });
    expect(defaultProps.onSettingsOpen).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSettingsClose).not.toHaveBeenCalled();
  });
});
