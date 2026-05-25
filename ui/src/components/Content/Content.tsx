// =============================================================================
// components/Content/Content.tsx — Main content area (rendered HTML + effects)
// =============================================================================

import { useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { usePlatform } from '../../contexts/PlatformContext';

declare global {
  interface Window {
    hljs?: any;
    mermaid?: any;
    Table?: any;
    Chart?: any;
  }
}

const hljs = (window as any).hljs;
const mermaid = (window as any).mermaid;

interface ContentProps {
  onImageClick: (el: HTMLElement) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function Content({ onImageClick, scrollRef }: ContentProps) {
  const { state } = useAppState();
  const { push } = useNavigation();
  const bridge = usePlatform();
  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollPositionsRef = useRef<Record<string, number>>({});
  const lastFileRef = useRef<string | null>(null);

  // Save scroll position of previous file before switching
  useEffect(() => {
    if (lastFileRef.current && scrollRef.current) {
      scrollPositionsRef.current[lastFileRef.current] = scrollRef.current.scrollTop;
    }
    lastFileRef.current = state.currentFile;
  }, [state.currentFile, scrollRef]);

  // Push to navigation history when file changes
  useEffect(() => {
    if (state.currentFile) push(state.currentFile);
  }, [state.currentFile, push]);

  // Post-render effects: highlight, mermaid, table init, click handlers
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || state.isLoading || state.notFoundHref) return;

    // Syntax highlighting
    if (hljs) {
      try {
        body.querySelectorAll<HTMLElement>('pre code:not(.is-custom-highlighted)').forEach((block) => {
          hljs.highlightElement(block);
        });
      } catch (err) {
        console.error('Highlight error:', err);
      }
    }

    // Mermaid rendering
    if (mermaid) {
      try {
        const isDark =
          state.theme === 'dark' ||
          (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          fontFamily: 'monospace',
          theme: isDark ? 'dark' : 'default',
        });

        const mermaidEls = body.querySelectorAll('.mermaid');
        if (mermaidEls.length > 0) {
          if (typeof mermaid.run === 'function') {
            mermaid.run({ querySelector: '.mermaid' });
          }
        }
      } catch (err) {
        console.error('Mermaid error:', err);
      }
    }

    // Table row counts & chart detection
    body.querySelectorAll<HTMLElement>('.mdn-table').forEach((table) => {
      const total = table.querySelectorAll('tbody tr').length;
      const countEl = document.getElementById(table.id + '-count');
      if (countEl) countEl.textContent = `${total} rows`;

      // Collapsible rows (> 15)
      if (total > 15) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
          if (index >= 15) row.classList.add('is-collapsed-row');
        });
        const btn = document.getElementById(table.id + '-toggle-btn');
        if (btn) {
          btn.style.display = '';
          btn.textContent = 'Show More';
        }
      }

      // Initialize table state and detect if it is chartable
      if ((window as any).Table) {
        (window as any).Table.detectChartable?.(table.id);
      }
    });

    // Expand all sections by default
    body.querySelectorAll('.mdn-section').forEach((s) => {
      (s as HTMLElement).dataset.expanded = 'true';
    });

    // Image click → media modal
    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const img = target.closest('.mdn-body img') as HTMLElement | null;
      if (img) { onImageClick(img); return; }
      const mermaidWrap = target.closest('.mdn-body .mdn-mermaid-wrap') as HTMLElement | null;
      if (mermaidWrap) { onImageClick(mermaidWrap); return; }
    };
    body.addEventListener('click', handleClick);

    // Restore or reset scroll position
    if (scrollRef.current) {
      const savedScroll = state.currentFile ? scrollPositionsRef.current[state.currentFile] : 0;
      scrollRef.current.scrollTop = savedScroll || 0;
    }

    return () => {
      body.removeEventListener('click', handleClick);
    };
  }, [state.renderVersion, state.theme, state.isLoading, state.notFoundHref, onImageClick, scrollRef, bridge]);

  // Frontmatter header
  const fmEntries = Object.entries(state.frontmatter);

  return (
    <main className="content" id="mainContent">
      <div className="content__scroll" id="contentScroll" ref={scrollRef}>
        {/* Loading */}
        {state.isLoading && (
          <div className="state-screen" id="loadingScreen" style={{ display: 'flex' }}>
            <div className="spinner" />
            <div className="state-screen__title">Loading docs…</div>
          </div>
        )}

        {/* Not Found */}
        {state.notFoundHref && (
          <div className="state-screen">
            <div className="state-screen__icon">⚠️</div>
            <div className="state-screen__title">File not found</div>
            <div className="state-screen__sub" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {state.notFoundHref}
            </div>
          </div>
        )}

        {/* Empty workspace */}
        {!state.isLoading && !state.notFoundHref && state.fileList.length === 0 && !state.contentHtml && (
          <div className="state-screen">
            <div className="state-screen__icon">📁</div>
            <div className="state-screen__title">No Markdown or MDX files found</div>
            <div className="state-screen__sub">
              Add a .md or .mdx file to your workspace to get started.
            </div>
          </div>
        )}

        {/* Content */}
        {!state.isLoading && !state.notFoundHref && state.contentHtml && (
          <div
            className="mdn-body"
            id="mdBody"
            ref={bodyRef}
            aria-live="polite"
          >
            {fmEntries.length > 0 && (
              <div className="mdn-frontmatter">
                {fmEntries.map(([k, v]) => (
                  <span key={k}>
                    <strong>{k}</strong>: {v}
                  </span>
                ))}
              </div>
            )}
            <div dangerouslySetInnerHTML={{ __html: state.contentHtml }} />
          </div>
        )}
      </div>
    </main>
  );
}
