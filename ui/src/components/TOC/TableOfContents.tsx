// =============================================================================
// components/TOC/TableOfContents.tsx
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import type { TocEntry } from '../../types';
import { ChevronUpIcon } from '../shared/icons';
import { getTranslations } from '../../contexts/translations';
import { getActiveDocumentBody, getActiveDocumentScroll, getDocumentRoot, type DocumentRootId } from '../../document/activeDocumentRoot';

interface TableOfContentsProps {
  variant?: 'panel' | 'compact';
  entries?: readonly TocEntry[];
  rootId?: DocumentRootId;
}

function tocScrollContainer(rootId: DocumentRootId | undefined): HTMLElement | null {
  return rootId ? getDocumentRoot(rootId)?.scroll ?? null : getActiveDocumentScroll();
}

function findHeading(rootId: DocumentRootId | undefined, id: string): HTMLElement | null {
  const body = rootId ? getDocumentRoot(rootId)?.body : getActiveDocumentBody();
  const scoped = body?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) ?? null;
  return scoped ?? (rootId ? null : document.getElementById(id));
}

function useActiveTocId(toc: readonly TocEntry[], renderVersion: number, rootId?: DocumentRootId) {
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);

  useEffect(() => {
    if (toc.length === 0) {
      setActiveId(null);
      return;
    }

    const scrollContainer = tocScrollContainer(rootId);
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
        const target = findHeading(rootId, entry.id);
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
  }, [toc, renderVersion, rootId]);

  return activeId;
}

export function TableOfContents({ variant = 'panel', entries, rootId }: TableOfContentsProps) {
  const { state } = useAppState();
  const toc = entries ?? state.toc;
  const [compactOpen, setCompactOpen] = useState(false);
  const activeId = useActiveTocId(toc, state.renderVersion, rootId);
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);

  const activeEntry = useMemo(
    () => toc.find((entry) => entry.id === activeId) ?? toc[0],
    [activeId, toc],
  );

  const scrollTo = useCallback((id: string) => {
    const el = findHeading(rootId, id);
    if (!el) return;
    // Expand parent sections
    let parent = el.closest('.mdn-section') as HTMLElement | null;
    while (parent) {
      parent.dataset.expanded = 'true';
      parent = (parent.parentElement?.closest('.mdn-section') as HTMLElement | null) ?? null;
    }
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    el.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [rootId]);

  const scrollToTop = useCallback(() => {
    const scrollContainer = tocScrollContainer(rootId);
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setCompactOpen(false);
  }, [rootId]);

  useEffect(() => {
    setCompactOpen(false);
  }, [state.currentFile, state.renderVersion]);

  if (toc.length === 0) return null;

  const renderItems = (closeOnSelect = false) =>
    toc.map((entry, index) => {
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
      <nav className={`toc-compact${compactOpen ? ' is-open' : ''}`} aria-label={t.ui.tableOfContents}>
        <button
          type="button"
          className="toc-compact__toggle"
          aria-expanded={compactOpen}
          onClick={() => setCompactOpen((open) => !open)}
          title={activeEntry?.text}
        >
          <span className="toc-compact__label">{t.toc.onThisPage}</span>
          <ChevronUpIcon size={14} className="toc-compact__chevron" />
        </button>
        <div className="toc-compact__menu" hidden={!compactOpen}>
          <button
            type="button"
            className="toc-item toc-item--top"
            onClick={scrollToTop}
          >
            {t.toc.returnToTop}
          </button>
          {renderItems(true)}
        </div>
      </nav>
    );
  }

  return (
    <aside className={`toc-panel${state.tocCollapsed ? ' is-collapsed' : ''}`} id="tocPanel" aria-label={t.ui.tableOfContents}>
      <div className="toc-panel__header">
        <div className="toc-panel__title-row">
          <div className="toc-panel__title-group">
            <div className="toc-panel__title">{t.toc.onThisPage}</div>
            <span className="toc-panel__count">{toc.length}</span>
          </div>
        </div>
        <div className="toc-panel__current" title={activeEntry?.text}>
          {activeEntry?.text ?? t.toc.sections}
        </div>
      </div>
      <div className="toc-panel__list" id="tocItems">
        {renderItems()}
      </div>
    </aside>
  );
}
