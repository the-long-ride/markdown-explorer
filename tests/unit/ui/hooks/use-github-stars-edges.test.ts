import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GITHUB_STARS_STORAGE_KEY, GITHUB_STARS_UPDATED_EVENT, readCachedStars, useGitHubStars } from '../../../../ui/src/hooks/useGitHubStars';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('useGitHubStars edges', () => {
  it('ignores invalid caches and non-numeric update events', () => {
    localStorage.setItem(GITHUB_STARS_STORAGE_KEY, JSON.stringify({ count: 'x' }));
    expect(readCachedStars()).toBeNull();
    localStorage.setItem(GITHUB_STARS_STORAGE_KEY, '{bad');
    expect(readCachedStars()).toBeNull();
    const { result } = renderHook(() => useGitHubStars(7, false));
    act(() => { window.dispatchEvent(new CustomEvent(GITHUB_STARS_UPDATED_EVENT, { detail: 'nope' })); });
    expect(result.current).toBe(7);
    act(() => { window.dispatchEvent(new CustomEvent(GITHUB_STARS_UPDATED_EVENT, { detail: 9 })); });
    expect(result.current).toBe(9);
  });

  it('keeps stars on API errors, refetches when visible and tolerates storage failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ stargazers_count: 42 }) })
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() => useGitHubStars(5, true));
    await flush();
    expect(result.current).toBe(5);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await flush();
    expect(result.current).toBe(42);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    unmount();
  });
});
