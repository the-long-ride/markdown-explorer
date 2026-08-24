import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCOPE_NAVIGATION_REQUEST_EVENT,
  SCOPE_NAVIGATION_STATE_EVENT,
} from '../../../../ui/src/components/Modal/scopeHistory';
import { useKeyboard } from '../../../../ui/src/hooks/useKeyboard';

const mockBack = vi.fn();
const mockForward = vi.fn();

vi.mock('../../../../ui/src/contexts/NavigationContext', () => ({
  useNavigation: () => ({ back: mockBack, forward: mockForward, canGoBack: true, canGoForward: true }),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      settings: {
        keybindings: { back: 'Alt+Left', forward: 'Alt+Right' },
        disabledKeybindings: {},
      },
    },
    navigate: vi.fn(), refresh: vi.fn(), toggleTheme: vi.fn(), toggleSidebar: vi.fn(),
    openInEditor: vi.fn(), closeContentTab: vi.fn(), closeAllContentTabs: vi.fn(),
    closeContentTabsToRight: vi.fn(), closeOtherContentTabs: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: vi.fn() }),
}));

const props = {
  onSearchOpen: vi.fn(), onSearchClose: vi.fn(), onSettingsOpen: vi.fn(), onSettingsClose: vi.fn(),
  onExpandAll: vi.fn(), onCollapseAll: vi.fn(), isSearchOpen: false, isSettingsOpen: false,
  isModalOpen: false, isTermsOpen: false,
};

function fireMouse(button: number) {
  window.dispatchEvent(new MouseEvent('mouseup', { button, bubbles: true, cancelable: true }));
}

function fireKey(key: string, altKey: boolean) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, altKey, bubbles: true, cancelable: true }));
}

describe('useKeyboard Scope history routing', () => {
  const requests: string[] = [];
  const onRequest = (event: Event) => {
    const direction = (event as CustomEvent<{ direction?: string }>).detail?.direction;
    if (direction) requests.push(direction);
  };

  beforeEach(() => {
    mockBack.mockClear();
    mockForward.mockClear();
    requests.length = 0;
    window.addEventListener(SCOPE_NAVIGATION_REQUEST_EVENT, onRequest);
  });

  afterEach(() => {
    window.removeEventListener(SCOPE_NAVIGATION_REQUEST_EVENT, onRequest);
  });

  it('routes keyboard and mouse history inputs to Scope while Scope is active', () => {
    renderHook(() => useKeyboard(props));
    window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, {
      detail: { active: true, canPrevious: true, canNext: true },
    }));

    fireMouse(3);
    fireMouse(4);
    fireKey('ArrowLeft', true);
    fireKey('ArrowRight', true);

    expect(requests).toEqual(['previous', 'next', 'previous', 'next']);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockForward).not.toHaveBeenCalled();
  });

  it('routes BrowserBack/BrowserForward and Alt+Arrow fallback to Scope while active', () => {
    renderHook(() => useKeyboard(props));
    window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_STATE_EVENT, {
      detail: { active: true, canPrevious: true, canNext: true },
    }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'BrowserBack', bubbles: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'BrowserForward', bubbles: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true }));

    expect(requests).toEqual(['previous', 'next', 'previous', 'next']);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockForward).not.toHaveBeenCalled();
  });
});
