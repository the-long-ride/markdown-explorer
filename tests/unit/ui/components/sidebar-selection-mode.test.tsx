import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSidebarSelectionMode } from '../../../../ui/src/components/Sidebar/useSidebarSelectionMode';

describe('useSidebarSelectionMode', () => {
  it('toggles keys, calls onEnter, clears on exit and workspace change', () => {
    const onEnter = vi.fn();
    const { result, rerender } = renderHook((props) => useSidebarSelectionMode(props), { initialProps: { workspaceKey: 'a', onEnter } });
    act(() => result.current.enter());
    expect(onEnter).toHaveBeenCalledOnce();
    act(() => result.current.toggle('file', 'x.md'));
    act(() => result.current.toggle('folder', 'docs'));
    act(() => result.current.toggle('file', 'x.md'));
    expect([...result.current.selected]).toEqual(['folder:docs']);
    expect(result.current.isSelected('folder:docs')).toBe(true);
    expect(result.current.isSelected('file:x.md')).toBe(false);
    rerender({ workspaceKey: 'b', onEnter });
    expect(result.current.active).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });
  it('exits on Escape', () => {
    const { result } = renderHook(() => useSidebarSelectionMode({ workspaceKey: 'a', onEnter: vi.fn() }));
    act(() => result.current.enter());
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(result.current.active).toBe(false);
  });
  it('ignores an Escape that another handler already consumed', () => {
    const { result } = renderHook(() => useSidebarSelectionMode({ workspaceKey: 'a', onEnter: vi.fn() }));
    act(() => result.current.enter());
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })); });
    expect(result.current.active).toBe(false);
    act(() => result.current.enter());
    const consumed = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    consumed.preventDefault();
    act(() => { window.dispatchEvent(consumed); });
    expect(result.current.active).toBe(true);
  });
  it('bumps the selection epoch on every enter and exit but not on toggle', () => {
    const { result } = renderHook(() => useSidebarSelectionMode({ workspaceKey: 'a', onEnter: vi.fn() }));
    const initial = result.current.getEpoch();
    act(() => result.current.enter());
    const entered = result.current.getEpoch();
    expect(entered).toBeGreaterThan(initial);
    act(() => result.current.toggle('file', 'x.md'));
    expect(result.current.getEpoch()).toBe(entered);
    act(() => result.current.exit());
    const exited = result.current.getEpoch();
    expect(exited).toBeGreaterThan(entered);
    act(() => result.current.enter());
    expect(result.current.getEpoch()).toBeGreaterThan(exited);
  });
  it('exit clears the selection and leaves selection mode', () => {
    const { result } = renderHook(() => useSidebarSelectionMode({ workspaceKey: 'a', onEnter: vi.fn() }));
    act(() => result.current.enter());
    act(() => result.current.toggle('file', 'x.md'));
    act(() => result.current.exit());
    expect(result.current.active).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });
});
