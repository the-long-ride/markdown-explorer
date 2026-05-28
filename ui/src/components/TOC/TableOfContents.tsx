// =============================================================================
// components/TOC/TableOfContents.tsx
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import type { TocEntry } from '../../types';
import { ChevronUpIcon } from '../shared/icons';

interface TableOfContentsProps {
  variant?: 'panel' | 'compact';
}

function useActiveTocId(toc: readonly TocEntry[], renderVersion: number) {
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);

  useEffect(() => {
    if (toc.length === 0) {
      setActiveId(null);
      return;
    }

    const scrollContainer = document.getElementById('contentScroll');
    if (!scrollContainer) {
      setActiveId(toc[0].id);
      return;
    }

    let rafId = 0;
    const updateActiveId = () => {
      rafId = 0;
      const scrollRect = scrollContainer.getBoundingClientRect();
      const threshold = scrollRect.top + 96;
      let nextActiveId = toc[0].id;

      for (const entry of toc) {
        const target = document.getElementById(entry.id);
        if (!target) continue;
        if (target.getBoundingClientRect().top <= threshold) {
          nextActiveId = entry.id;
        } else {
          break;
        }
      }

      setActiveId((previous) =>
        previous === nextActiveId ? previous : nextActiveId,
      );
    };

    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(updateActiveId);
    };

    scheduleUpdate();
    scrollContainer.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      scrollContainer.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [toc, renderVersion]);

  return activeId;
}

export function TableOfContents({ variant = 'panel' }: TableOfContentsProps) {
  const { state } = useAppState();
  const [compactOpen, setCompactOpen] = useState(false);
  const activeId = useActiveTocId(state.toc, state.renderVersion);

  const activeEntry = useMemo(
    () => state.toc.find((entry) => entry.id === activeId) ?? state.toc[0],
    [activeId, state.toc],
  );

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Expand parent sections
    let parent = el.closest('.mdn-section') as HTMLElement | null;
    while (parent) {
      parent.dataset.expanded = 'true';
      parent = (parent.parentElement?.closest('.mdn-section') as HTMLElement | null) ?? null;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToTop = useCallback(() => {
    const scrollContainer = document.getElementById('contentScroll');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setCompactOpen(false);
  }, []);

  useEffect(() => {
    setCompactOpen(false);
  }, [state.currentFile, state.renderVersion]);

  if (state.toc.length === 0) return null;

  const renderItems = (closeOnSelect = false) =>
    state.toc.map((entry, index) => {
      const isActive = entry.id === activeId;
      return (
        <button
          type="button"
          key={`${entry.id}-${index}`}
          className={`toc-item toc-item--h${entry.level}${isActive ? ' is-active' : ''}`}
          onClick={() => {
            scrollTo(entry.id);
            if (closeOnSelect) setCompactOpen(false);
          }}
          title={entry.text}
          aria-current={isActive ? 'location' : undefined}
        >
          <span className="toc-item__marker" aria-hidden="true" />
          <span className="toc-item__text">{entry.text}</span>
        </button>
      );
    });

  if (variant === 'compact') {
    return (
      <nav className={`toc-compact${compactOpen ? ' is-open' : ''}`} aria-label="Table of contents">
        <button
          type="button"
          className="toc-compact__toggle"
          aria-expanded={compactOpen}
          onClick={() => setCompactOpen((open) => !open)}
          title={activeEntry?.text}
        >
          <span className="toc-compact__label">On this page</span>
          <ChevronUpIcon size={14} className="toc-compact__chevron" />
        </button>
        <div className="toc-compact__menu" hidden={!compactOpen}>
          <button
            type="button"
            className="toc-item toc-item--top"
            onClick={scrollToTop}
          >
            Return to top
          </button>
          {renderItems(true)}
        </div>
      </nav>
    );
  }

  return (
    <aside className="toc-panel" id="tocPanel" aria-label="Table of contents">
      <div className="toc-panel__header">
        <div className="toc-panel__title-row">
          <div className="toc-panel__title">On This Page</div>
          <span className="toc-panel__count">{state.toc.length}</span>
        </div>
        <div className="toc-panel__current" title={activeEntry?.text}>
          {activeEntry?.text ?? 'Sections'}
        </div>
      </div>
      <div className="toc-panel__list" id="tocItems">
        {renderItems()}
      </div>
    </aside>
  );
}
