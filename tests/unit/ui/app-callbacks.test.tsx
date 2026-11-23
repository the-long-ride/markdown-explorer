import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  state: {} as any, layout: null as any, drop: null as any, view: null as any, search: null as any,
  bridge: { postMessage: vi.fn(), onMessage: vi.fn(() => () => undefined) },
  tabs: { tabs: [] as any[], activeTabId: 'home', activateTab: vi.fn(), prepareWorkspaceOpen: vi.fn(() => ({ workspaceOperationId: 'op' })) },
  setHtml: vi.fn(), startTour: vi.fn(), openSidebarSearch: vi.fn(),
  guard: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock('../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: h.state, toggleTheme: vi.fn(), toggleSidebar: vi.fn(), toggleToc: vi.fn(), toggleFocusMode: vi.fn(), toggleDesktopViewMode: vi.fn(), setContentTabHtmlPreview: h.setHtml, dispatch: vi.fn(), navigate: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => h.bridge }));
vi.mock('../../../ui/src/contexts/NavigationContext', () => ({ useNavigation: () => ({ back: vi.fn(), forward: vi.fn(), canGoBack: false, canGoForward: false, setScope: vi.fn() }) }));
vi.mock('../../../ui/src/components/Tour/tourEvents', () => ({ requestStartUserTour: h.startTour }));
vi.mock('../../../ui/src/dom/globalHandlers', () => ({ initGlobalHandlers: vi.fn() }));
vi.mock('../../../ui/src/hooks/useDesktopTabs', () => ({ useDesktopTabs: () => ({ ...h.tabs, workspaceAliases: {}, crossTabSearchItems: [], isIndexingAcrossTabs: false }) }));
vi.mock('../../../ui/src/hooks/useDirtyDocumentsGuard', () => ({ useDirtyDocumentsGuard: () => h.guard, useRequestWindowClose: () => vi.fn() }));
vi.mock('../../../ui/src/hooks/useFileDropOpen', () => ({ useFileDropOpen: (o: any) => { h.drop = o; return { isDragging: false }; } }));
vi.mock('../../../ui/src/hooks/useUpdateCheck', () => ({ useUpdateCheck: () => ({ status: 'idle' }) }));
vi.mock('../../../ui/src/AppView', () => ({ AppView: (p: any) => { h.view = p; return <div data-testid="view" />; } }));
vi.mock('../../../ui/src/useAppSearchEffects', () => ({ useAppSearchEffects: () => ({ toggleFullscreen: vi.fn(), openSidebarSearch: h.openSidebarSearch, handleWorkspaceSearchSelect: vi.fn(), handleCrossTabSelect: vi.fn(), queueBookmarkJump: vi.fn() }) }));
vi.mock('../../../ui/src/useAppLayoutEffects', () => ({ useAppLayoutEffects: (o: any) => { h.layout = o; return {}; } }));
vi.mock('../../../ui/src/useAppUpdateActions', () => ({ useAppUpdateActions: () => ({}) }));
vi.mock('../../../ui/src/hooks/useBookmarkNavigation', () => ({ useBookmarkNavigation: () => ({}) }));
vi.mock('../../../ui/src/hooks/useUserManualActions', () => ({ useUserManualActions: vi.fn() }));
vi.mock('../../../ui/src/hooks/useUpdateNotificationState', () => ({ useUpdateNotificationState: () => ({ promptOpen: false }) }));

import { App } from '../../../ui/src/App';
import { initialState } from '../../../ui/src/contexts/appStateModel';

beforeEach(() => {
  h.state = { ...initialState, currentFile: '/w/a.html', workspaceName: 'w', sourceDocumentText: '<p/>', contentTabs: [], settings: { ...initialState.settings, defaultHtmlPreview: true } };
  h.tabs.tabs = [];
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  localStorage.clear();
});
afterEach(() => { delete (window as any).electronAPI; vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('App callbacks', () => {
  it('toggles html preview, opens/closes find and search, and completes theme onboarding', async () => {
    const notices: string[] = [];
    window.addEventListener('markdown-explorer-action-notice', (e) => notices.push((e as CustomEvent).detail));
    render(<App />);
    act(() => h.layout.onToggleActiveHtmlDocumentPreview());
    expect(h.setHtml).toHaveBeenCalledWith('/w/a.html', false);
    expect(notices).toHaveLength(1);
    act(() => h.layout.openFind());
    expect(h.view.findOpen).toBe(true);
    act(() => h.layout.closeFind());
    act(() => h.layout.openSearch('current'));
    expect(h.view.searchOpen).toBe(true);
    act(() => h.layout.closeSearch());
    act(() => h.layout.openSearch('all-tabs'));
    expect(h.openSidebarSearch).toHaveBeenCalled();
    vi.useFakeTimers();
    act(() => h.view.handleThemeOnboardingComplete());
    act(() => { vi.advanceTimersByTime(500); });
    expect(h.startTour).toHaveBeenCalled();
  });

  it('routes dropped folders, file handles and web files through the leave guard', async () => {
    render(<App />);
    act(() => h.drop.openDroppedFolder('dir'));
    act(() => h.drop.openDroppedFileHandle('fh'));
    expect(h.bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'openFolder', handle: 'dir' }));
    expect(h.bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'openFileHandle', handle: 'fh' }));
    const good = { name: 'a.md', text: async () => '# a' };
    const bad = { name: 'b.md', text: async () => { throw new Error('x'); } };
    await act(async () => { h.drop.openDroppedWebFiles([good, bad]); await new Promise((r) => setTimeout(r, 0)); });
    expect(h.bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'openDroppedFiles', files: [{ name: 'a.md', content: '# a' }] }));
    h.bridge.postMessage.mockClear();
    await act(async () => { h.drop.openDroppedWebFiles([bad]); await new Promise((r) => setTimeout(r, 0)); });
    expect(h.bridge.postMessage).not.toHaveBeenCalled();
  });

  it('ignores find without a file and activates the only workspace tab for all-tabs search in tab view', () => {
    (window as any).electronAPI = {};
    localStorage.setItem('markdown-explorer-terms-accepted', 'true');
    h.state = { ...h.state, currentFile: null, workspaceName: '', settings: { ...h.state.settings, desktopViewMode: 'tabs' } };
    h.tabs.tabs = [{ id: 'w1', kind: 'workspace' }];
    render(<App />);
    if (!h.layout) return;
    act(() => h.layout.openFind());
    act(() => h.layout.openSearch('all-tabs'));
    expect(h.tabs.activateTab).toHaveBeenCalledWith('w1');
    const img = document.createElement('img');
    act(() => h.view?.onImageClick(img));
  });
});
