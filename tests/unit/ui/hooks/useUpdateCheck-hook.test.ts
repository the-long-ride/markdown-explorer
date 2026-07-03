import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useUpdateCheck,
  CHANGELOG_URL,
  VSCODE_MARKETPLACE_URL,
} from '../../../../ui/src/hooks/useUpdateCheck';

const RELEASE_FALLBACK_URL = 'https://github.com/the-long-ride/markdown-explorer/releases/latest';

describe('useUpdateCheck hook', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      ...response,
      json: response.json ?? (() => Promise.resolve({})),
    } as Response);
  }

  async function advanceDelay() {
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('returns idle when currentVersion is empty', () => {
    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.currentVersion).toBe('');
    expect(result.current.downloadUrl).toBe(RELEASE_FALLBACK_URL);
  });

  it('starts checking when currentVersion is provided', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );
    expect(result.current.status).toBe('checking');
  });

  it('transitions to current when versions match', async () => {
    mockFetch({ json: () => Promise.resolve({ tag_name: 'v1.0.0' }) });

    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );

    await advanceDelay();

    expect(result.current.status).toBe('current');
    expect(result.current.latestVersion).toBe('v1.0.0');
    expect(result.current.hasUpdate).toBe(false);
    expect(result.current.releaseUrl).toBe(RELEASE_FALLBACK_URL);
    expect(result.current.changelogUrl).toBe(CHANGELOG_URL);
  });

  it('transitions to available when newer version exists', async () => {
    mockFetch({
      json: () =>
        Promise.resolve({
          tag_name: 'v2.0.0',
          name: 'Release 2.0.0',
          html_url: 'https://example.com/release',
        }),
    });

    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );

    await advanceDelay();

    expect(result.current.status).toBe('available');
    expect(result.current.latestVersion).toBe('v2.0.0');
    expect(result.current.hasUpdate).toBe(true);
    expect(result.current.releaseUrl).toBe('https://example.com/release');
  });

  it('uses VSCode marketplace URL for vscode runtime', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'vscode', hostPlatform: 'windows', hostArch: 'x64' }),
    );
    expect(result.current.downloadUrl).toBe(VSCODE_MARKETPLACE_URL);
  });

  it('picks best desktop asset by score', async () => {
    mockFetch({
      json: () =>
        Promise.resolve({
          tag_name: 'v2.0.0',
          assets: [
            { name: 'app-2.0.0.zip', browser_download_url: 'https://example.com/app.zip' },
            { name: 'app-2.0.0-setup.exe', browser_download_url: 'https://example.com/app-setup.exe' },
          ],
        }),
    });

    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );

    await advanceDelay();

    expect(result.current.status).toBe('available');
    expect(result.current.downloadUrl).toBe('https://example.com/app-setup.exe');
  });

  it('falls back to html_url when no matching asset', async () => {
    mockFetch({
      json: () =>
        Promise.resolve({
          tag_name: 'v2.0.0',
          html_url: 'https://example.com/release-html',
          assets: [{ name: 'unknown.txt', browser_download_url: 'https://example.com/unknown.txt' }],
        }),
    });

    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );

    await advanceDelay();

    expect(result.current.downloadUrl).toBe('https://example.com/release-html');
  });

  it('transitions to error when response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );

    await advanceDelay();

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('GitHub returned 500');
  });

  it('transitions to error when fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );

    await advanceDelay();

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Network failure');
  });

  it('handles non-Error rejection gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue('string error');

    const { result } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );

    await advanceDelay();

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Unable to check for updates');
  });

  it('does not fetch before delay elapses', () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );

    act(() => { vi.advanceTimersByTime(7000); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts in-flight fetch on unmount', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { unmount } = renderHook(() =>
      useUpdateCheck({ currentVersion: '1.0.0', runtime: 'desktop', hostPlatform: 'windows', hostArch: 'x64' }),
    );

    await act(async () => { vi.advanceTimersByTime(8000); });

    unmount();

    resolveFetch({ ok: true, status: 200, json: () => Promise.resolve({ tag_name: 'v2.0.0' }) } as Response);
    await act(async () => { await Promise.resolve(); });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
