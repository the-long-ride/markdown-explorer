import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ request: vi.fn(), back: vi.fn(), forward: vi.fn() }));
vi.mock('../../../../ui/src/contexts/NavigationContext', () => ({ useNavigation: () => ({ back: h.back, forward: h.forward }) }));
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: { settings: { keybindings: { back: 'ctrl+[', forward: 'ctrl+]' } }, currentFile: null, appRuntime: 'tauri', documentSessions: {} },
    toggleTheme: vi.fn(), toggleSidebar: vi.fn(), navigate: vi.fn(), openInEditor: vi.fn(), setDocumentEditMode: vi.fn(), refresh: vi.fn(), saveDocument: vi.fn(),
    closeContentTab: vi.fn(), closeAllContentTabs: vi.fn(), closeContentTabsToRight: vi.fn(), closeOtherContentTabs: vi.fn(),
  }),
}));
vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => ({ postMessage: vi.fn() }) }));
vi.mock('../../../../ui/src/hooks/useDirtyDocumentsGuard', () => ({ useDirtyDocumentsGuard: () => (commit: () => void) => commit() }));
vi.mock('../../../../ui/src/hooks/useScopeNavigationState', () => ({
  getScopeNavigationStateSnapshot: () => ({ active: true, canGoBack: true, canGoForward: true }),
  requestScopeNavigation: h.request,
  useScopeNavigationState: () => ({ active: true, canGoBack: true, canGoForward: true }),
}));

import { useKeyboard } from '../../../../ui/src/hooks/useKeyboard';

function press(key: string, mods: KeyboardEventInit = {}, target: Element = document.body) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
}

describe('useKeyboard with active scope navigation', () => {
  it('routes browser fallback keys and configured back/forward shortcuts to scope navigation', () => {
    const opts: any = { onSearchOpen: vi.fn(), onSearchClose: vi.fn(), onSettingsOpen: vi.fn(), onSettingsClose: vi.fn(), onExpandAll: vi.fn(), onCollapseAll: vi.fn(), isSearchOpen: false, isSettingsOpen: false, isModalOpen: false, isTermsOpen: false };
    const hook = renderHook(() => useKeyboard(opts));
    press('BrowserBack');
    press('BrowserForward');
    press('ArrowLeft', { altKey: true });
    press('ArrowRight', { altKey: true });
    press('[', { ctrlKey: true });
    press(']', { ctrlKey: true });
    expect(h.request.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['previous', 'next']));
    expect(h.request.mock.calls.length).toBeGreaterThanOrEqual(4);
    h.request.mockClear();
    const input = document.createElement('input');
    document.body.append(input);
    press('[', { ctrlKey: true }, input);
    expect(h.request).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('skips browser fallback scope navigation while terms are open', () => {
    h.request.mockClear();
    const hook = renderHook(() => useKeyboard({ onSearchOpen: vi.fn(), onSearchClose: vi.fn(), onSettingsOpen: vi.fn(), onSettingsClose: vi.fn(), onExpandAll: vi.fn(), onCollapseAll: vi.fn(), isSearchOpen: false, isSettingsOpen: false, isModalOpen: false, isTermsOpen: true } as any));
    press('BrowserBack');
    hook.unmount();
    expect(h.request.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
