// =============================================================================
// components/Content/Content.tsx — Main content area (rendered HTML + effects)
// =============================================================================

import { useEffect, useRef, memo } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { useNavigation } from "../../contexts/NavigationContext";
import { usePlatform } from "../../contexts/PlatformContext";
import { WelcomePage } from "./WelcomePage";

declare global {
  interface Window {
    hljs?: any;
    mermaid?: any;
    Table?: any;
    Chart?: any;
  }
}

// Memoize the raw HTML container so React does NOT re-apply dangerouslySetInnerHTML
// when unrelated parent state (e.g. modalOpen) causes a re-render.
// Without this, every App re-render would overwrite the DOM with the original HTML,
// destroying SVGs that mermaid.run() injected asynchronously.
const HtmlContent = memo(function HtmlContent({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

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
  const lastRestoredFileRef = useRef<string | null>(null);
  const lastRestoredVersionRef = useRef<number | null>(null);
  const mermaidRunIdRef = useRef(0);

  // Save scroll position of previous file before switching
  useEffect(() => {
    if (lastFileRef.current && scrollRef.current) {
      scrollPositionsRef.current[lastFileRef.current] =
        scrollRef.current.scrollTop;
    }
    lastFileRef.current = state.currentFile;
  }, [state.currentFile, scrollRef]);

  // Push to navigation history when file changes
  useEffect(() => {
    if (state.currentFile) push(state.currentFile);
  }, [state.currentFile, push]);

  // Post-render effects: highlight, mermaid, table init, click handlers, sticky header
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || state.isLoading || state.notFoundHref) return;

    const hljs = (window as any).hljs;
    const mermaid = (window as any).mermaid;

    // Sticky table header (JS-based, because overflow-x:auto blocks native sticky)
    const scrollContainer = scrollRef.current;
    const handleScroll = () => {
      if (!scrollContainer) return;
      const rectScroll = scrollContainer.getBoundingClientRect();
      const stickyTop = rectScroll.top;

      scrollContainer
        .querySelectorAll<HTMLTableElement>(".mdn-table")
        .forEach((table) => {
          const thead = table.querySelector<HTMLElement>("thead");
          if (!thead) return;
          const rectTable = table.getBoundingClientRect();
          const offsetPast = stickyTop - rectTable.top;
          if (offsetPast > 0) {
            const maxTranslate = table.offsetHeight - thead.offsetHeight;
            const translateY = Math.min(offsetPast, maxTranslate);
            thead.style.transform = `translateY(${translateY}px)`;
            thead.style.position = "relative";
            thead.style.zIndex = "10";
          } else {
            thead.style.transform = "";
            thead.style.position = "";
            thead.style.zIndex = "";
          }
        });
    };

    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
    }

    // Image / mermaid click → media modal
    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const img = target.closest(".mdn-body img") as HTMLElement | null;
      if (img) {
        onImageClick(img);
        return;
      }
      const mermaidWrap = target.closest(
        ".mdn-body .mdn-mermaid-wrap",
      ) as HTMLElement | null;
      if (mermaidWrap) {
        onImageClick(mermaidWrap);
        return;
      }
    };
    body.addEventListener("click", handleClick);

    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;

      // Syntax highlighting
      if (hljs) {
        try {
          body
            .querySelectorAll<HTMLElement>(
              "pre code:not(.is-custom-highlighted)",
            )
            .forEach((block) => {
              hljs.highlightElement(block);
            });
        } catch (err) {
          console.error("Highlight error:", err);
        }
      }

      // Mermaid rendering — scope to bodyRef elements, use nodes[] to avoid stale selectors
      if (mermaid) {
        try {
          const isDark =
            state.theme === "dark" ||
            (state.theme === "auto" &&
              window.matchMedia("(prefers-color-scheme: dark)").matches);

          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "loose",
            fontFamily: "var(--font-mono)",
            theme: isDark ? "dark" : "default",
          });

          const mermaidEls = [
            ...body.querySelectorAll<HTMLElement>(".mermaid"),
          ];
          if (mermaidEls.length > 0) {
            const runNodes: HTMLElement[] = [];
            mermaidEls.forEach((rawEl) => {
              // Preserve original source on first visit; restore on re-render
              if (!rawEl.dataset.originalCode) {
                rawEl.dataset.originalCode = rawEl.textContent || "";
              }
              // Only reset if NOT already rendered (avoid flash of raw text)
              const alreadyRendered = !!rawEl.querySelector("svg");
              if (!alreadyRendered) {
                rawEl.removeAttribute("data-processed");
                // Remove any previously rendered SVG inside the wrapper
                rawEl.querySelectorAll("svg").forEach((svg) => svg.remove());
                runNodes.push(rawEl);
              }
            });

            // Use nodes[] to scope to exactly our elements (avoids querySelector global collision)
            if (runNodes.length > 0 && typeof mermaid.run === "function") {
              const runId = ++mermaidRunIdRef.current;
              mermaid.run({ nodes: runNodes }).then(() => {
                if (runId !== mermaidRunIdRef.current) return;
              }).catch((err: any) => {
                console.error("Mermaid render error:", err);
              });
            }
          }
        } catch (err) {
          console.error("Mermaid error:", err);
        }
      }

      // Table: row counts, collapse > 15 rows
      body.querySelectorAll<HTMLElement>(".mdn-table").forEach((table) => {
        // Exclude the toggle-button row from count
        const rows = [
          ...table.querySelectorAll<HTMLElement>("tbody tr"),
        ].filter((r) => !r.dataset.toggle);
        const total = rows.length;
        const countEl = document.getElementById(table.id + "-count");
        if (countEl) countEl.textContent = `${total} rows`;

        // Collapse rows beyond 15
        rows.forEach((row, index) => {
          if (index >= 15) row.classList.add("is-collapsed-row");
          else row.classList.remove("is-collapsed-row");
        });

        // Show/hide toggle button (lives OUTSIDE the table, inside mdn-table-wrap)
        const btn = document.getElementById(table.id + "-toggle-btn");
        if (btn) {
          btn.style.display = total > 15 ? "" : "none";
          btn.textContent = "Show More";
        }
      });

      // Schedule chart detection after paint is complete
      Promise.resolve().then(() => {
        if (cancelled) return;
        const Win = window as any;
        if (!Win.Table) return;

        // Reset ALL table states on each new content render (mirrors old renderContent behaviour)
        if (Win.Table.states) {
          // Destroy any existing chart instances to prevent canvas reuse errors
          Object.values(Win.Table.states as Record<string, any>).forEach(
            (s: any) => {
              if (s?.chartInstance) {
                try {
                  s.chartInstance.destroy();
                } catch (_) {
                  /* ignore */
                }
              }
            },
          );
        }
        Win.Table.states = {};

        body.querySelectorAll<HTMLElement>(".mdn-table").forEach((table) => {
          Win.Table.detectChartable?.(table.id);
        });
      });

      // Sync theme to HTML preview iframes
      const isThemeDark =
        state.theme === "dark" ||
        (state.theme === "auto" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      body
        .querySelectorAll<HTMLIFrameElement>(".mdn-html-preview-iframe")
        .forEach((iframe) => {
          iframe.contentWindow?.postMessage(
            { type: "set-theme", theme: isThemeDark ? "dark" : "light" },
            "*",
          );
        });

      // Expand all sections by default
      body.querySelectorAll(".mdn-section").forEach((s) => {
        (s as HTMLElement).dataset.expanded = "true";
      });

      // Run sticky header positioning once DOM is settled
      handleScroll();
    });

    // Restore or reset scroll position only when file/version changes
    if (
      scrollRef.current &&
      (lastRestoredFileRef.current !== state.currentFile ||
        lastRestoredVersionRef.current !== state.renderVersion)
    ) {
      const savedScroll = state.currentFile
        ? scrollPositionsRef.current[state.currentFile]
        : 0;
      scrollRef.current.scrollTop = savedScroll || 0;
      lastRestoredFileRef.current = state.currentFile;
      lastRestoredVersionRef.current = state.renderVersion;
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      body.removeEventListener("click", handleClick);
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, [
    state.renderVersion,
    state.theme,
    state.isLoading,
    state.notFoundHref,
    onImageClick,
    scrollRef,
    bridge,
  ]);

  // Frontmatter header
  const fmEntries = Object.entries(state.frontmatter);

  return (
    <main className="content" id="mainContent">
      <div className="content__scroll" id="contentScroll" ref={scrollRef}>
        {/* Loading */}
        {state.isLoading && (
          <div
            className="state-screen"
            id="loadingScreen"
            style={{ display: "flex" }}
          >
            <div className="spinner" />
            <div className="state-screen__title">Loading docs…</div>
          </div>
        )}

        {/* Not Found */}
        {state.notFoundHref && (
          <div className="state-screen">
            <div className="state-screen__icon">⚠️</div>
            <div className="state-screen__title">File not found</div>
            <div
              className="state-screen__sub"
              style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
            >
              {state.notFoundHref}
            </div>
          </div>
        )}

        {/* Empty workspace */}
        {!state.isLoading &&
          !state.notFoundHref &&
          state.fileList.length === 0 &&
          !state.contentHtml && (
            <div className="state-screen">
              <div className="state-screen__icon">📁</div>
              <div className="state-screen__title">
                No Markdown or MDX files found
              </div>
              <div className="state-screen__sub">
                Add a .md or .mdx file to your workspace to get started.
              </div>
            </div>
          )}

        {/* Welcome Page */}
        {!state.isLoading &&
          !state.notFoundHref &&
          !state.currentFile &&
          state.fileList.length > 0 && <WelcomePage />}

        {/* Content */}
        {!state.isLoading &&
          !state.notFoundHref &&
          state.currentFile &&
          state.contentHtml && (
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
              <HtmlContent html={state.contentHtml} />
            </div>
          )}
      </div>
    </main>
  );
}
