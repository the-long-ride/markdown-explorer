import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { getTranslations } from '../../contexts/translations';
import type { DocumentSnapshot } from '../../export/documentSnapshot';
import type { TocEntry } from '../../types';
import { setHeadingSectionExpanded } from '../Content/enhancements/headingSectionState';

interface ScopeViewTocProps {
  entries: readonly TocEntry[];
  documentKey: string;
  language?: string;
  emptyLabel: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
}

const SCOPE_FALLBACK_ID_PREFIX = 'scope-toc-heading-';

export function extractScopeTocEntries(
  snapshot: DocumentSnapshot | null,
  body: HTMLElement | null,
): TocEntry[] {
  if (!snapshot) return [];
  if (Array.isArray(snapshot.toc)) return snapshot.toc;
  if (!body) return [];

  const entries: TocEntry[] = [];
  const headings = body.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
  headings.forEach((heading, index) => {
    const text = heading.textContent?.trim() || '';
    if (!text) return;
    const level = Number.parseInt(heading.tagName.slice(1), 10);
    const section = heading.closest<HTMLElement>('.mdn-section');
    const id = heading.id || section?.id || `${SCOPE_FALLBACK_ID_PREFIX}${index}`;
    entries.push({ id, text, level: Number.isFinite(level) ? level : 1 });
  });
  return entries;
}

function findScopeHeadingElement(body: HTMLElement | null, id: string): HTMLElement | null {
  if (!body || !id) return null;
  if (id.startsWith(SCOPE_FALLBACK_ID_PREFIX)) {
    const index = Number.parseInt(id.slice(SCOPE_FALLBACK_ID_PREFIX.length), 10);
    const headings = body.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
    return Number.isFinite(index) ? headings[index] ?? null : null;
  }
  return body.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
}

function expandParentSections(target: HTMLElement): void {
  let parent = target.closest<HTMLElement>('.mdn-section');
  while (parent) {
    setHeadingSectionExpanded(parent, true);
    parent = parent.parentElement?.closest<HTMLElement>('.mdn-section') ?? null;
  }
}

export function ScopeViewToc({
  entries,
  documentKey,
  language,
  emptyLabel,
  scrollRef,
  bodyRef,
}: ScopeViewTocProps) {
  const t = getTranslations(language || 'en');
  const [activeId, setActiveId] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    if (entries.length === 0) {
      setActiveId(null);
      return;
    }

    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      setActiveId(entries[0].id);
      return;
    }

    let rafId = 0;
    const updateActiveId = () => {
      rafId = 0;
      const threshold = scrollContainer.getBoundingClientRect().top + 96;
      let nextActiveId = entries[0].id;

      for (const entry of entries) {
        const target = findScopeHeadingElement(bodyRef.current, entry.id);
        if (!target) continue;
        if (target.getBoundingClientRect().top <= threshold) {
          nextActiveId = entry.id;
        } else {
          break;
        }
      }

      setActiveId((prev) => (prev === nextActiveId ? prev : nextActiveId));
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
  }, [entries, documentKey, scrollRef, bodyRef]);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.id === activeId) ?? entries[0],
    [activeId, entries],
  );

  const handleSelect = useCallback((id: string) => {
    const target = findScopeHeadingElement(bodyRef.current, id);
    if (!target) return;
    expandParentSections(target);
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    setActiveId(id);
  }, [bodyRef]);

  return (
    <aside className="toc-panel scope-view__toc" aria-label={t.ui.tableOfContents}>
      <div className="toc-panel__header">
        <div className="toc-panel__title-row">
          <div className="toc-panel__title-group">
            <div className="toc-panel__title">{t.toc.onThisPage}</div>
            <span className="toc-panel__count">{entries.length}</span>
          </div>
        </div>
        <div
          className="toc-panel__current"
          data-hover-tooltip={activeEntry?.text || t.toc.sections}
          data-hover-tooltip-pos="left"
        >
          {activeEntry?.text ?? t.toc.sections}
        </div>
      </div>
      <div className="toc-panel__list">
        {entries.length === 0 ? (
          <div className="scope-view__toc-empty">{emptyLabel}</div>
        ) : (
          entries.map((entry, index) => {
            const isActive = entry.id === activeId;
            return (
              <button
                type="button"
                key={`${entry.id}-${index}`}
                className={`toc-item toc-item--h${entry.level}${isActive ? ' is-active' : ''}`}
                onClick={() => handleSelect(entry.id)}
                data-hover-tooltip={entry.text}
                data-hover-tooltip-pos="left"
                aria-current={isActive ? 'location' : undefined}
              >
                <span className="toc-item__marker" aria-hidden="true" />
                <span className="toc-item__text">{entry.text}</span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
