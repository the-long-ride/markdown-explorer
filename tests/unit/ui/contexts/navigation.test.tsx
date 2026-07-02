import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NavigationProvider,
  useNavigation,
} from '../../../../ui/src/contexts/NavigationContext';

const mockNavigate = vi.fn();

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    navigate: mockNavigate,
  }),
}));

describe('NavigationContext', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NavigationProvider>{children}</NavigationProvider>
  );

  describe('useNavigation outside provider', () => {
    it('throws when used outside NavigationProvider', () => {
      expect(() => {
        renderHook(() => useNavigation());
      }).toThrow('useNavigation must be used within NavigationProvider');
    });
  });

  describe('initial state', () => {
    it('canGoBack and canGoForward are false with empty history', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);
    });
  });

  describe('push', () => {
    it('adds path to history', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);

      act(() => { result.current.push('/b.md'); });
      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(false);
    });

    it('ignores duplicate consecutive paths', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/a.md'); });
      expect(result.current.canGoBack).toBe(false);

      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.push('/b.md'); });
      expect(result.current.canGoBack).toBe(true);

      act(() => { result.current.back(); });
      expect(result.current.canGoForward).toBe(true);
      act(() => { result.current.push('/b.md'); });
      expect(result.current.canGoForward).toBe(true);
    });

    it('is no-op when isNavigatingHistory is true and resets the flag', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });

      act(() => { result.current.back(); });
      expect(mockNavigate).toHaveBeenCalledWith('/a.md');

      act(() => { result.current.push('/a.md'); });
      expect(result.current.canGoForward).toBe(true);

      act(() => { result.current.push('/c.md'); });
      expect(result.current.canGoForward).toBe(false);
    });

    it('truncates forward history and pushes new path after back', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.push('/c.md'); });

      act(() => { result.current.back(); });
      expect(result.current.canGoForward).toBe(true);

      act(() => { result.current.push('/b.md'); });
      expect(result.current.canGoForward).toBe(true);

      act(() => { result.current.push('/d.md'); });
      expect(result.current.canGoForward).toBe(false);
      expect(result.current.canGoBack).toBe(true);

      act(() => { result.current.back(); });
      expect(mockNavigate).toHaveBeenLastCalledWith('/b.md');
      act(() => { result.current.back(); });
      expect(mockNavigate).toHaveBeenLastCalledWith('/a.md');
    });

    it('does not navigate on push', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('back', () => {
    it('does nothing when history has single item', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      mockNavigate.mockClear();
      act(() => { result.current.back(); });
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(result.current.canGoBack).toBe(false);
    });

    it('does nothing when index is 0', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.back(); });
      expect(result.current.canGoBack).toBe(false);
      mockNavigate.mockClear();
      act(() => { result.current.back(); });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('decrements index, sets isNavigatingHistory, and calls navigate', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.push('/c.md'); });

      mockNavigate.mockClear();
      act(() => { result.current.back(); });
      expect(mockNavigate).toHaveBeenCalledWith('/b.md');
      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(true);

      mockNavigate.mockClear();
      act(() => { result.current.back(); });
      expect(mockNavigate).toHaveBeenCalledWith('/a.md');
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(true);
    });

    it('sets isNavigatingHistory so subsequent push of the navigated path is ignored', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.push('/c.md'); });

      act(() => { result.current.back(); });
      expect(result.current.canGoForward).toBe(true);

      act(() => { result.current.push('/b.md'); });
      expect(result.current.canGoForward).toBe(true);
    });
  });

  describe('forward', () => {
    it('does nothing when no forward history', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      mockNavigate.mockClear();
      act(() => { result.current.forward(); });
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(result.current.canGoForward).toBe(false);
    });

    it('does nothing when already at end of stack', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      mockNavigate.mockClear();
      act(() => { result.current.forward(); });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('increments index, sets isNavigatingHistory, and calls navigate', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.push('/c.md'); });
      act(() => { result.current.back(); });
      act(() => { result.current.back(); });

      mockNavigate.mockClear();
      act(() => { result.current.forward(); });
      expect(mockNavigate).toHaveBeenCalledWith('/b.md');
      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(true);

      mockNavigate.mockClear();
      act(() => { result.current.forward(); });
      expect(mockNavigate).toHaveBeenCalledWith('/c.md');
      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(false);
    });

    it('sets isNavigatingHistory so subsequent push of the navigated path is ignored', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.back(); });

      act(() => { result.current.forward(); });
      expect(result.current.canGoForward).toBe(false);

      act(() => { result.current.push('/b.md'); });
      expect(result.current.canGoBack).toBe(true);
    });
  });

  describe('canGoBack / canGoForward', () => {
    it('canGoBack is true only when index > 0', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      expect(result.current.canGoBack).toBe(false);

      act(() => { result.current.push('/a.md'); });
      expect(result.current.canGoBack).toBe(false);

      act(() => { result.current.push('/b.md'); });
      expect(result.current.canGoBack).toBe(true);
    });

    it('canGoForward is true only when index < stack.length - 1', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.push('/c.md'); });

      act(() => { result.current.back(); });
      expect(result.current.canGoForward).toBe(true);
      expect(result.current.canGoBack).toBe(true);

      act(() => { result.current.back(); });
      expect(result.current.canGoForward).toBe(true);
      expect(result.current.canGoBack).toBe(false);

      act(() => { result.current.forward(); });
      expect(result.current.canGoForward).toBe(true);
      expect(result.current.canGoBack).toBe(true);

      act(() => { result.current.forward(); });
      expect(result.current.canGoForward).toBe(false);
      expect(result.current.canGoBack).toBe(true);
    });
  });

  describe('setScope', () => {
    it('creates new scope with empty history', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      expect(result.current.canGoBack).toBe(false);

      act(() => { result.current.setScope('workspace-2'); });
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);

      act(() => { result.current.push('/x.md'); });
      act(() => { result.current.push('/y.md'); });
      expect(result.current.canGoBack).toBe(true);
    });

    it('returns to existing scope state when switching back', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      expect(result.current.canGoBack).toBe(true);

      act(() => { result.current.setScope('other'); });
      expect(result.current.canGoBack).toBe(false);

      act(() => { result.current.setScope('default'); });
      expect(result.current.canGoBack).toBe(true);
    });

    it('same scope is no-op', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });

      act(() => { result.current.setScope('default'); });
      expect(result.current.canGoBack).toBe(true);
    });

    it('empty string defaults to default scope', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });

      act(() => { result.current.setScope('other'); });
      expect(result.current.canGoBack).toBe(false);

      act(() => { result.current.setScope(''); });
      expect(result.current.canGoBack).toBe(true);
    });

    it('history in different scopes is independent', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.back(); });
      expect(result.current.canGoForward).toBe(true);

      act(() => { result.current.setScope('scope-x'); });
      expect(result.current.canGoForward).toBe(false);
      expect(result.current.canGoBack).toBe(false);

      act(() => { result.current.push('/z.md'); });
      act(() => { result.current.push('/w.md'); });
      act(() => { result.current.back(); });
      expect(result.current.canGoForward).toBe(true);

      act(() => { result.current.setScope('default'); });
      expect(result.current.canGoForward).toBe(true);
    });
  });

  describe('back/forward branching', () => {
    it('push after back+forward still truncates and branches', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/a.md'); });
      act(() => { result.current.push('/b.md'); });
      act(() => { result.current.push('/c.md'); });

      act(() => { result.current.back(); });
      act(() => { result.current.forward(); });
      expect(result.current.canGoForward).toBe(false);

      act(() => { result.current.push('/c.md'); });
      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(false);

      act(() => { result.current.push('/d.md'); });
      expect(result.current.canGoForward).toBe(false);
      expect(result.current.canGoBack).toBe(true);

      act(() => { result.current.back(); });
      expect(mockNavigate).toHaveBeenLastCalledWith('/c.md');
    });

    it('multiple backs then push truncates all forward history', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });
      act(() => { result.current.push('/1.md'); });
      act(() => { result.current.push('/2.md'); });
      act(() => { result.current.push('/3.md'); });
      act(() => { result.current.push('/4.md'); });

      act(() => { result.current.back(); });
      act(() => { result.current.back(); });
      expect(result.current.canGoForward).toBe(true);

      act(() => { result.current.push('/2.md'); });
      expect(result.current.canGoForward).toBe(true);

      act(() => { result.current.push('/5.md'); });
      expect(result.current.canGoForward).toBe(false);
      expect(result.current.canGoBack).toBe(true);

      act(() => { result.current.back(); });
      expect(mockNavigate).toHaveBeenLastCalledWith('/2.md');
      act(() => { result.current.back(); });
      expect(mockNavigate).toHaveBeenLastCalledWith('/1.md');
      expect(result.current.canGoForward).toBe(true);
    });
  });
});
