// =============================================================================
// components/TOC/TableOfContents.tsx
// =============================================================================

import { useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext';

export function TableOfContents() {
  const { state } = useAppState();

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

  return (
    <aside className="toc-panel" id="tocPanel" aria-label="Table of contents">
      <div className="toc-panel__title">On This Page</div>
      <div id="tocItems">
        {state.toc.map((entry) => (
          <div
            key={entry.id}
            className={`toc-item toc-item--h${entry.level}`}
            onClick={() => scrollTo(entry.id)}
            title={entry.text}
          >
            {entry.text}
          </div>
        ))}
      </div>
    </aside>
  );
}
