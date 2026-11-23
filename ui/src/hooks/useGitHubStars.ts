import { useEffect, useState } from 'react';

interface GitHubStarCache {
  count: number;
  timestamp: number;
}

export const GITHUB_STARS_STORAGE_KEY = 'mdn_github_stars_cache';
export const GITHUB_STARS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const GITHUB_REPO_API_URL = 'https://api.github.com/repos/the-long-ride/markdown-explorer';
export const DEFAULT_FALLBACK_STARS = 15;
export const GITHUB_STARS_UPDATED_EVENT = 'mdn-github-stars-updated';

export function readCachedStars(): number | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(GITHUB_STARS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GitHubStarCache>;
    if (typeof parsed?.count === 'number' && Number.isFinite(parsed.count)) {
      return parsed.count;
    }
  } catch {
    // Ignore parse or storage errors
  }
  return null;
}

export function useGitHubStars(
  initialFallback: number = DEFAULT_FALLBACK_STARS,
  enabled: boolean = true
): number {
  const [stars, setStars] = useState<number>(() => {
    const cached = readCachedStars();
    return cached ?? initialFallback;
  });

  // Listen to cross-component star update events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleUpdated = (event: Event) => {
      const custom = event as CustomEvent<number>;
      if (typeof custom.detail === 'number') {
        setStars(custom.detail);
      }
    };
    window.addEventListener(GITHUB_STARS_UPDATED_EVENT, handleUpdated);
    return () => {
      window.removeEventListener(GITHUB_STARS_UPDATED_EVENT, handleUpdated);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let controller: AbortController | null = null;

    const fetchLatestStars = () => {
      controller?.abort();
      controller = new AbortController();
      fetch(GITHUB_REPO_API_URL, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
          return res.json();
        })
        .then((data: { stargazers_count?: unknown }) => {
          if (typeof data?.stargazers_count === 'number') {
            const count = data.stargazers_count;
            setStars(count);
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem(
                  GITHUB_STARS_STORAGE_KEY,
                  JSON.stringify({
                    count,
                    timestamp: Date.now(),
                  })
                );
              }
            } catch {
              // Storage quota or sandboxed
            }
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent(GITHUB_STARS_UPDATED_EVENT, { detail: count })
              );
            }
          }
        })
        .catch(() => {
          // Keep current stars on failure / abort
        });
    };

    fetchLatestStars();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLatestStars();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      controller?.abort();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [enabled]);

  return stars;
}
