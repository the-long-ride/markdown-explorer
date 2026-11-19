import { useEffect, useRef, useState } from 'react';
import { renderMermaidToSvg } from '../Content/enhancements/mermaidRenderToSvg.ts';

export interface MermaidThumbnailProps {
  readonly code?: string;
  readonly label: string;
  readonly status?: 'valid' | 'invalid';
  readonly onOpenMedia?: (svgHtml?: string) => void;
}

const MAX_CACHE_ENTRIES = 60;
const mermaidThumbnailCache = new Map<string, string>();

function getCachedMermaidSvg(key: string): string | undefined {
  const value = mermaidThumbnailCache.get(key);
  if (value !== undefined) {
    mermaidThumbnailCache.delete(key);
    mermaidThumbnailCache.set(key, value);
  }
  return value;
}

function setCachedMermaidSvg(key: string, svg: string): void {
  if (mermaidThumbnailCache.has(key)) {
    mermaidThumbnailCache.delete(key);
  } else if (mermaidThumbnailCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = mermaidThumbnailCache.keys().next().value;
    if (oldestKey !== undefined) {
      mermaidThumbnailCache.delete(oldestKey);
    }
  }
  mermaidThumbnailCache.set(key, svg);
}

const MAX_CONCURRENT_MERMAID_RENDERS = 2;
let activeMermaidRenders = 0;
type MermaidTask = () => void;
const mermaidRenderQueue: MermaidTask[] = [];

function pumpMermaidQueue(): void {
  while (activeMermaidRenders < MAX_CONCURRENT_MERMAID_RENDERS && mermaidRenderQueue.length > 0) {
    const task = mermaidRenderQueue.shift();
    if (task) {
      activeMermaidRenders++;
      task();
    }
  }
}

function isDocumentDark(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.documentElement.classList.contains('dark') ||
    document.documentElement.dataset.themeMode === 'dark' ||
    document.body.classList.contains('dark') ||
    (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  );
}

export function MermaidThumbnail({ code, label, status, onOpenMedia }: MermaidThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible || !code || status === 'invalid') return;
    const element = containerRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [code, isVisible, status]);

  useEffect(() => {
    if (!isVisible || !code || status === 'invalid') return;
    const isDark = isDocumentDark();
    const cacheKey = `${code}:${isDark ? 'dark' : 'light'}`;
    const cached = getCachedMermaidSvg(cacheKey);
    if (cached) {
      setSvgHtml(cached);
      return;
    }

    let cancelled = false;

    const task: MermaidTask = () => {
      if (cancelled) {
        activeMermaidRenders--;
        pumpMermaidQueue();
        return;
      }

      renderMermaidToSvg({ source: code, isDark })
        .then(({ svgHtml: rendered }) => {
          if (cancelled) return;
          setCachedMermaidSvg(cacheKey, rendered);
          setSvgHtml(rendered);
        })
        .catch(() => {
          // Fall back gracefully to placeholder icon on syntax failure
        })
        .finally(() => {
          activeMermaidRenders--;
          pumpMermaidQueue();
        });
    };

    mermaidRenderQueue.push(task);
    pumpMermaidQueue();

    return () => {
      cancelled = true;
      const idx = mermaidRenderQueue.indexOf(task);
      if (idx !== -1) {
        mermaidRenderQueue.splice(idx, 1);
      }
    };
  }, [code, isVisible, status]);

  if (svgHtml) {
    return (
      <div
        ref={containerRef}
        className="insights-card__thumb insights-card__thumb--diagram insights-card__thumb--mermaid-rendered"
        onClick={onOpenMedia ? e => { e.stopPropagation(); onOpenMedia(svgHtml); } : undefined}
        data-testid="mermaid-thumbnail-rendered"
        aria-label={label}
        data-hover-tooltip={label}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="insights-card__thumb insights-card__thumb--diagram"
      onClick={onOpenMedia ? e => { e.stopPropagation(); onOpenMedia(); } : undefined}
      data-testid="mermaid-thumbnail-placeholder"
      aria-label={label}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="9" y="15" width="6" height="6" rx="1" />
        <path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9" /><path d="M12 12v3" />
      </svg>
      <span className="insights-card__thumb-badge">Mermaid</span>
    </div>
  );
}
