import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useGitHubStars,
  GITHUB_STARS_STORAGE_KEY,
  GITHUB_REPO_API_URL,
  GITHUB_STARS_UPDATED_EVENT,
} from '../../../../ui/src/hooks/useGitHubStars';

describe('useGitHubStars', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  it('initializes with default fallback when no cache exists and updates when fetch succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 42 }),
    });

    const { result } = renderHook(() => useGitHubStars(15));
    expect(result.current).toBe(15);

    await waitFor(() => {
      expect(result.current).toBe(42);
    });

    const stored = JSON.parse(localStorage.getItem(GITHUB_STARS_STORAGE_KEY) || '{}');
    expect(stored.count).toBe(42);
    expect(typeof stored.timestamp).toBe('number');
  });

  it('immediately returns cached stars and triggers background fetch to refresh the count', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 120 }),
    });

    localStorage.setItem(
      GITHUB_STARS_STORAGE_KEY,
      JSON.stringify({ count: 99, timestamp: Date.now() })
    );

    const { result } = renderHook(() => useGitHubStars(15));
    // Synchronously returns the cached value on initial render
    expect(result.current).toBe(99);

    // Background fetch triggers and refreshes count
    await waitFor(() => {
      expect(result.current).toBe(120);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      GITHUB_REPO_API_URL,
      expect.objectContaining({
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github.v3+json' },
      })
    );

    const stored = JSON.parse(localStorage.getItem(GITHUB_STARS_STORAGE_KEY) || '{}');
    expect(stored.count).toBe(120);
  });

  it('refreshes the star count when enabled transitions from false to true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 77 }),
    });

    let isEnabled = false;
    const { result, rerender } = renderHook(() => useGitHubStars(15, isEnabled));

    expect(result.current).toBe(15);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    // Enable (e.g. modal opens)
    isEnabled = true;
    rerender();

    await waitFor(() => {
      expect(result.current).toBe(77);
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('syncs across components when mdn-github-stars-updated event is dispatched', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const { result } = renderHook(() => useGitHubStars(15, false));
    expect(result.current).toBe(15);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(GITHUB_STARS_UPDATED_EVENT, { detail: 150 })
      );
    });

    expect(result.current).toBe(150);
  });

  it('handles network error gracefully and retains cached value', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    localStorage.setItem(
      GITHUB_STARS_STORAGE_KEY,
      JSON.stringify({ count: 88, timestamp: Date.now() })
    );

    const { result } = renderHook(() => useGitHubStars(15));
    expect(result.current).toBe(88);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBe(88);
  });

  it('handles non-200 HTTP response gracefully and retains fallback value', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'API rate limit exceeded' }),
    });

    const { result } = renderHook(() => useGitHubStars(15));
    expect(result.current).toBe(15);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBe(15);
  });
});
