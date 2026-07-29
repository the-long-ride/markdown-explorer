import { describe, it, expect } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '../../../ui/src/contexts/appStateConstants';
import { ACTIONS_LIST } from '../../../ui/src/components/Settings/settingsActions';
import { resolveKeyboardAction } from '../../../ui/src/hooks/keyboardUtils';

describe('VS Code and Chromium shortcut bindings contract', () => {
  it('defines correct default keybindings for Alt+A (toggle sidebar) and Alt+C (toggle TOC)', () => {
    expect(DEFAULT_KEYBINDINGS.toggleSidebar).toBe('Alt+A');
    expect(DEFAULT_KEYBINDINGS.toggleToc).toBe('Alt+C');
    expect(DEFAULT_KEYBINDINGS.sidebarCursorMode).toBe('Alt+Z');
    expect(DEFAULT_KEYBINDINGS.locateFile).toBe('Alt+Q');
  });

  it('configures proper action scoping for non-desktop vs desktop environments', () => {
    const toggleSidebar = ACTIONS_LIST.find((a) => a.id === 'toggleSidebar');
    const searchAllTabs = ACTIONS_LIST.find((a) => a.id === 'searchAllTabs');
    const workspaceSelection = ACTIONS_LIST.find((a) => a.id === 'workspaceSelection');

    expect(toggleSidebar?.scope).toBe('both');
    expect(searchAllTabs?.scope).toBe('desktop');
    expect(workspaceSelection?.scope).toBe('non-vscode');
  });

  it('resolves workspaceSelection on Web demo and Chrome extension runtimes', () => {
    const e = { key: 'w', ctrlKey: true, altKey: true, shiftKey: false, metaKey: false } as KeyboardEvent;
    const webState = {
      isDesktop: false,
      isDesktopLike: false,
      appRuntime: 'web' as const,
      isTermsOpen: false,
      isModalOpen: false,
      isSearchOpen: false,
      isFindOpen: false,
      isSettingsOpen: false,
      isSidebarCursorMode: false,
      keybindings: {
        workspaceSelection: 'ctrl+alt+w',
      },
    } as any;

    const action = resolveKeyboardAction(e, webState);
    expect(action).toEqual({ type: 'workspace-selection' });
  });

  it('resolves Alt+A to toggle-sidebar on non-desktop platforms', () => {
    const e = { key: 'a', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false } as KeyboardEvent;
    const state = {
      isDesktop: false,
      isDesktopLike: false,
      appRuntime: 'vscode' as const,
      isTermsOpen: false,
      isModalOpen: false,
      isSearchOpen: false,
      isFindOpen: false,
      isSettingsOpen: false,
      isSidebarCursorMode: false,
      hasOnToggleSidebar: true,
      keybindings: {
        toggleSidebar: 'alt+a',
        toggleToc: 'alt+c',
      },
    } as any;

    const action = resolveKeyboardAction(e, state);
    expect(action).toEqual({ type: 'toggle-sidebar' });
  });

  it('resolves Alt+C to toggle-toc on non-desktop platforms', () => {
    const e = { key: 'c', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false } as KeyboardEvent;
    const state = {
      isDesktop: false,
      isDesktopLike: false,
      appRuntime: 'vscode' as const,
      isTermsOpen: false,
      isModalOpen: false,
      isSearchOpen: false,
      isFindOpen: false,
      isSettingsOpen: false,
      isSidebarCursorMode: false,
      hasOnToggleToc: true,
      keybindings: {
        toggleSidebar: 'alt+a',
        toggleToc: 'alt+c',
      },
    } as any;

    const action = resolveKeyboardAction(e, state);
    expect(action).toEqual({ type: 'toggle-toc' });
  });

  it('ignores workspaceSelection keyboard shortcut in VS Code runtime', () => {
    const e = { key: 'w', ctrlKey: true, altKey: true, shiftKey: false, metaKey: false } as KeyboardEvent;
    const state = {
      isDesktop: false,
      isDesktopLike: false,
      isVscode: true,
      isTermsOpen: false,
      isModalOpen: false,
      isSearchOpen: false,
      isFindOpen: false,
      isSettingsOpen: false,
      isSidebarCursorMode: false,
      keybindings: {
        workspaceSelection: 'ctrl+alt+w',
      },
    } as any;

    const action = resolveKeyboardAction(e, state);
    expect(action).toBeNull();
  });
});
