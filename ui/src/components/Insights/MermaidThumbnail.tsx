import { useEffect, useRef, useState } from 'react';
import { renderMermaidToSvg } from '../Content/enhancements/mermaidRenderToSvg.ts';

export interface MermaidThumbnailProps {
  readonly code?: string;
  readonly label: string;
  readonly status?: 'valid' | 'invalid';
  readonly onOpenMedia?: (svgHtml?: string) => void;
}

const mermaidThumbnailCache = new Map<string, string>();

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
    const cached = mermaidThumbnailCache.get(cacheKey);
    if (cached) {
      setSvgHtml(cached);
      return;
    }

    let cancelled = false;
    renderMermaidToSvg({ source: code, isDark })
      .then(({ svgHtml: rendered }) => {
        if (cancelled) return;
        mermaidThumbnailCache.set(cacheKey, rendered);
        setSvgHtml(rendered);
      })
      .catch(() => {
        // Fall back gracefully to placeholder icon on syntax failure
      });

    return () => {
      cancelled = true;
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
        title={label}
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
