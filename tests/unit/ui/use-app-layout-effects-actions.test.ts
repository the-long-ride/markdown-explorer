import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let keyboardOpts: any = null;
let snapshot: any = { repositoryView: { mode: 'revision' }, activeToc: [{}] };
const expandAll = vi.fn();
const collapseAll = vi.fn();
const requestShellLocation = vi.fn();
vi.mock('../../../ui/src/hooks/useKeyboard', () => ({ useKeyboard: (o: any) => { keyboardOpts = o; } }));
vi.mock('../../../ui/src/hooks/useResize', () => ({ useResize: () => undefined }));
vi.mock('../../../ui/src/hooks/useDirtyDocumentsGuard', () => ({ useDirtyDocumentsGuard: () => (commit: () => void) => commit() }));
vi.mock('../../../ui/src/contexts/RepositorySnapshotContext', () => ({ useRepositorySnapshot: () => snapshot }));
vi.mock('../../../ui/src/dom/globalHandlers', () => ({ expandAll: () => expandAll(), collapseAll: () => collapseAll() }));
vi.mock('../../../ui/src/desktop/shellLocation', () => ({ supportsShellLocation: () => true, requestShellLocation: (...a: any[]) => requestShellLocation(...a) }));

import { useAppLayoutEffects } from '../../../ui/src/useAppLayoutEffects';

function render(stateOverrides: Record<string, any> = {}, argOverrides: Record<string, any> = {}) {
  const args: any = {
    state: { workspaceName: 'W', sidebarCollapsed: true, currentFile: '/w/a.md', markdownSource: '# A', appRuntime: 'electron', toc: [], settings: { bookmarksEnabled: true, insightsEnabled: true }, ...stateOverrides },
    bridge: { postMessage: vi.fn(), copyToClipboard: vi.fn() }, dispatch: vi.fn(), termsAccepted: true, themeOnboardingComplete: true,
    setSidebarCursorMode: vi.fn(), sidebarCursorMode: false, searchOpen: false, findOpen: false, settingsOpen: false, modalOpen: false,
    toggleSidebar: vi.fn(), isTabView: false, createNewWorkspaceTab: vi.fn(), setWorkspaceSelectionConfirmOpen: vi.fn(), openSidebarSearch: vi.fn(),
    openSearch: vi.fn(), closeSearch: vi.fn(), canUseCrossTabSearch: true, openFind: vi.fn(), closeFind: vi.fn(), setSettingsOpen: vi.fn(),
    activateTab: vi.fn(), searchScope: 'current', toggleToc: vi.fn(), toggleFocusMode: vi.fn(), toggleDesktopViewMode: vi.fn(),
    activeHtmlDocument: false, onToggleActiveHtmlDocumentPreview: vi.fn(), toggleFullscreen: vi.fn(), ...argOverrides,
  };
  const hook = renderHook(() => useAppLayoutEffects(args));
  return { args, result: hook.result };
}

beforeEach(() => { vi.useRealTimers(); localStorage.clear(); keyboardOpts = null; });

describe('useAppLayoutEffects actions', () => {
  it('toggles sidebar cursor mode across guard states', () => {
    const open = render();
    act(() => open.result.current.toggleSidebarCursorMode());
    expect(open.args.toggleSidebar).toHaveBeenCalled();
    expect(open.args.setSidebarCursorMode).toHaveBeenCalledWith(true);
    act(() => open.result.current.closeSidebarCursorMode());
    const active = render({ sidebarCollapsed: false }, { sidebarCursorMode: true });
    act(() => active.result.current.toggleSidebarCursorMode());
    expect(active.args.setSidebarCursorMode).toHaveBeenCalledWith(false);
    const blocked = render({ workspaceName: null });
    act(() => blocked.result.current.toggleSidebarCursorMode());
    expect(blocked.args.setSidebarCursorMode).not.toHaveBeenCalledWith(true);
  });

  it('applies stored panel widths and wires keyboard callbacks', () => {
    localStorage.setItem('markdown-explorer-sidebar-width', '300');
    vi.useFakeTimers();
    const { args, result } = render();
    act(() => {
      result.current.expandAll();
      result.current.collapseAll();
      keyboardOpts.onSettingsOpen();
      keyboardOpts.onSettingsClose();
      keyboardOpts.onCrossTabSearchOpen();
      keyboardOpts.onFilesOpen();
      keyboardOpts.onBookmarksOpen();
      keyboardOpts.onToggleWorkspaceInsights?.();
      keyboardOpts.onLocateFile?.();
      keyboardOpts.onOpenCurrentDocumentLocation?.();
      keyboardOpts.onWorkspaceSelection();
      vi.advanceTimersByTime(100);
    });
    expect(expandAll).toHaveBeenCalled();
    expect(collapseAll).toHaveBeenCalled();
    expect(args.setSettingsOpen).toHaveBeenCalledWith(true);
    expect(args.openSearch).toHaveBeenCalledWith('all-tabs');
    expect(args.setWorkspaceSelectionConfirmOpen).toHaveBeenCalledWith(true);
    expect(keyboardOpts.onWelcome).toBeUndefined();
  });

  it('handles disabled bookmarks, tab-view welcome and copy fallbacks', () => {
    vi.useFakeTimers();
    snapshot = { repositoryView: { mode: 'live' } };
    const ui = { markCopyButtonCopied: vi.fn(), copyDocument: vi.fn() };
    (window as any).UI = ui;
    const { args, result } = render({ settings: { bookmarksEnabled: false, insightsEnabled: false }, sidebarCollapsed: false }, { isTabView: true });
    act(() => { result.current.openSidebarBookmarks(); vi.advanceTimersByTime(100); });
    expect(args.setSettingsOpen).toHaveBeenCalledWith(true);
    act(() => { keyboardOpts.onWelcome(); result.current.copyCurrentFileContent(null); result.current.requestWorkspaceSelection(); });
    expect(args.activateTab).toHaveBeenCalledWith('home');
    expect(args.bridge.copyToClipboard).toHaveBeenCalledWith('# A');
    const empty = render({ currentFile: null, markdownSource: null });
    act(() => { empty.result.current.copyCurrentFileContent(null); empty.result.current.closeWorkspaceToSelection(); });
    expect(ui.copyDocument).toHaveBeenCalled();
    const noSource = render({ markdownSource: null });
    act(() => noSource.result.current.copyCurrentFileContent(null));
    delete (window as any).UI;
  });
});
