import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSidebarPinnedSorting } from '../../../../ui/src/components/Sidebar/useSidebarPinnedSorting';

const pins = [
  { kind: 'file', path: 'C:\\ws\\a.md' },
  { kind: 'folder', path: 'docs' },
  { kind: 'file', path: 'C:\\ws\\docs\\b.md' },
] as const;

function setup(pinned: readonly any[] = pins) {
  const updateSettings = vi.fn();
  const settings: any = { sidebarPinnedItems: { ws: [...pinned] }, maxPinnedItems: 10 };
  const { result } = renderHook(() => useSidebarPinnedSorting({ tree: null, workspaceKey: 'ws', settings, updateSettings }));
  return { result, updateSettings };
}

describe('useSidebarPinnedSorting.removePins', () => {
  it('keeps only pins the predicate does not match', () => {
    const { result, updateSettings } = setup();
    act(() => result.current.removePins((pin) => pin.kind === 'file'));
    expect(updateSettings).toHaveBeenCalledOnce();
    expect(updateSettings).toHaveBeenCalledWith({ sidebarPinnedItems: { ws: [{ kind: 'folder', path: 'docs' }] } });
  });
  it('drops the workspace entry when every pin is removed', () => {
    const { result, updateSettings } = setup();
    act(() => result.current.removePins(() => true));
    expect(updateSettings).toHaveBeenCalledWith({ sidebarPinnedItems: {} });
  });
  it('does not write settings when nothing matches', () => {
    const { result, updateSettings } = setup();
    act(() => result.current.removePins(() => false));
    expect(updateSettings).not.toHaveBeenCalled();
  });
  it('reads the latest pins through a stale callback and keeps its identity', () => {
    const updateSettings = vi.fn();
    const make = (items: readonly any[]) => ({ sidebarPinnedItems: { ws: [...items] }, maxPinnedItems: 10 }) as any;
    const { result, rerender } = renderHook(
      ({ settings }) => useSidebarPinnedSorting({ tree: null, workspaceKey: 'ws', settings, updateSettings }),
      { initialProps: { settings: make(pins) } },
    );
    const stale = result.current.removePins;
    const added = { kind: 'file', path: 'C:\\ws\\later.md' };
    rerender({ settings: make([...pins, added]) });
    expect(result.current.removePins).toBe(stale);
    act(() => stale((pin) => pin.path === 'C:\\ws\\a.md'));
    expect(updateSettings).toHaveBeenCalledOnce();
    expect(updateSettings).toHaveBeenCalledWith({ sidebarPinnedItems: { ws: [pins[1], pins[2], added] } });
  });
  it('uses the latest updateSettings and workspace key through a stale callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const settings: any = { sidebarPinnedItems: { ws: [...pins], other: [{ kind: 'folder', path: 'x' }] }, maxPinnedItems: 10 };
    const { result, rerender } = renderHook(
      ({ workspaceKey, updateSettings }) => useSidebarPinnedSorting({ tree: null, workspaceKey, settings, updateSettings }),
      { initialProps: { workspaceKey: 'ws', updateSettings: first } },
    );
    const stale = result.current.removePins;
    rerender({ workspaceKey: 'other', updateSettings: second });
    act(() => stale(() => true));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ sidebarPinnedItems: { ws: [...pins] } });
  });
});
