import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePersistedRevisionSelections } from '../../../../ui/src/contexts/usePersistedRevisionSelections';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

function createBridge(initial: Record<string, unknown>) {
  let stored = initial;
  const bridge: PlatformBridge = {
    postMessage: vi.fn(),
    onMessage: vi.fn(() => () => undefined),
    getState: vi.fn(() => JSON.parse(JSON.stringify(stored))) as PlatformBridge['getState'],
    setState: vi.fn((next: unknown) => { stored = next as Record<string, unknown>; }) as PlatformBridge['setState'],
    copyToClipboard: vi.fn(),
  };
  return bridge;
}

describe('usePersistedRevisionSelections', () => {
  it('reads bridge state once per workspace and keeps a stable selections identity across renders', () => {
    const bridge = createBridge({ repositoryRevisionSelections: { '/repo': { oid: 'a'.repeat(40) } } });
    const { result, rerender } = renderHook(({ key }) => usePersistedRevisionSelections(bridge, key), { initialProps: { key: '/repo' } });
    const first = result.current.selections;
    for (let index = 0; index < 5; index += 1) rerender({ key: '/repo' });

    expect(result.current.selections).toBe(first);
    expect(bridge.getState).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ '/repo': { oid: 'a'.repeat(40) } });

    rerender({ key: '/other' });
    expect(bridge.getState).toHaveBeenCalledTimes(2);
  });

  it('writes through to bridge state and updates the local copy', () => {
    const bridge = createBridge({ theme: 'dark' });
    const { result } = renderHook(() => usePersistedRevisionSelections(bridge, '/repo'));
    const next = { '/repo': { oid: 'b'.repeat(40) } };

    act(() => result.current.update(next));

    expect(result.current.selections).toEqual(next);
    expect(bridge.setState).toHaveBeenCalledWith({ theme: 'dark', repositoryRevisionSelections: next });
  });
});
