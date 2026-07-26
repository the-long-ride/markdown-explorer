import { getChart, getHighlightJs, getKatex, getMermaid } from "../../lib/renderLibs";
import { enhanceRawHtmlImageRows } from "../../markdown/rawHtmlImageRows";

interface ScheduleArgs {
  body: HTMLElement;
  state: any;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  mermaidRunIdRef: React.MutableRefObject<number>;
}

export function scheduleContentEnhancements({
  body,
  state,
  scrollRef: _scrollRef,
  handleScroll,
  mermaidRunIdRef,
}: ScheduleArgs) {
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      void (async () => {
        if (cancelled) return;

        enhanceRawHtmlImageRows(body);

        const codeBlocks = [
          ...body.querySelectorAll<HTMLElement>("pre code:not(.is-custom-highlighted)"),
        ].filter((block) => !/\blanguage-(txt|text|plain|plaintext)\b/.test(block.className));

        if (codeBlocks.length > 0) {
          try {
            const hljs = await getHighlightJs();
            if (!cancelled) {
              codeBlocks.forEach((block) => hljs.highlightElement(block));
            }
          } catch (err) {
            console.error("Highlight error:", err);
          }
        }

        const mathEls = [...body.querySelectorAll<HTMLElement>(".mdn-math[data-math]")];
        if (mathEls.length > 0) {
          try {
            const katex = await getKatex();
            if (!cancelled) {
              mathEls.forEach((el) => {
                const raw = el.dataset.math;
                if (!raw) return;
                try {
                  const tex = decodeURIComponent(raw);
                  katex.render(tex, el, {
                    displayMode: el.classList.contains("mdn-math-block"),
                    throwOnError: false,
                    strict: false,
                    trust: false,
                    output: "html",
                  });
                  el.classList.add("is-rendered");
                } catch (err) {
                  console.error("KaTeX render error:", err);
                }
              });
            }
          } catch (err) {
            console.error("KaTeX load error:", err);
          }
        }

        const mermaidEls = [...body.querySelectorAll<HTMLElement>(".mermaid")];
        if (mermaidEls.length > 0) {
          try {
            const mermaid = await getMermaid();
            if (!cancelled) {
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

              const runNodes: HTMLElement[] = [];
              mermaidEls.forEach((rawEl) => {
                if (!rawEl.dataset.originalCode) {
                  rawEl.dataset.originalCode = rawEl.textContent || "";
                }
                const alreadyRendered = !!rawEl.querySelector("svg");
                if (!alreadyRendered) {
                  rawEl.removeAttribute("data-processed");
                  rawEl.querySelectorAll("svg").forEach((svg) => svg.remove());
                  runNodes.push(rawEl);
                }
              });

              if (runNodes.length > 0 && typeof mermaid.run === "function") {
                const runId = ++mermaidRunIdRef.current;
                mermaid.run({ nodes: runNodes }).then(() => {
                  if (cancelled || runId !== mermaidRunIdRef.current) return;
                  runNodes.forEach((node) => {
                    node.querySelectorAll<SVGSVGElement>("svg").forEach((svg) => {
                      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
                    });
                  });
                }).catch((err: any) => {
                  console.error("Mermaid render error:", err);
                });
              }
            }
          } catch (err) {
            console.error("Mermaid error:", err);
          }
        }

        const tables = [...body.querySelectorAll<HTMLElement>(".mdn-table")];
        if (tables.length > 0) {
          try {
            await getChart();
          } catch (err) {
            console.error("Chart.js load error:", err);
          }
        }

        tables.forEach((table) => {
          const rows = [
            ...table.querySelectorAll<HTMLElement>("tbody tr"),
          ].filter((r) => !r.dataset.toggle);
          const total = rows.length;
          const countEl = document.getElementById(table.id + "-count");
          if (countEl) countEl.textContent = `${total} rows`;

          rows.forEach((row, index) => {
            if (index >= 15) row.classList.add("is-collapsed-row");
            else row.classList.remove("is-collapsed-row");
          });

          const btn = document.getElementById(table.id + "-toggle-btn");
          if (btn) {
            btn.style.display = total > 15 ? "" : "none";
            btn.textContent = "Show More";
          }
        });

        Promise.resolve().then(() => {
          if (cancelled) return;
          const Win = window as any;
          if (!Win.Table || tables.length === 0) return;

          if (Win.Table.states) {
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

          tables.forEach((table) => {
            Win.Table.detectChartable?.(table.id);
          });
        });

        const htmlPreviewIframes = [
          ...body.querySelectorAll<HTMLIFrameElement>(".mdn-html-preview-iframe"),
        ];
        if (htmlPreviewIframes.length > 0) {
          const isThemeDark =
            state.theme === "dark" ||
            (state.theme === "auto" &&
              window.matchMedia("(prefers-color-scheme: dark)").matches);
          htmlPreviewIframes.forEach((iframe) => {
            iframe.contentWindow?.postMessage(
              { type: "set-theme", theme: isThemeDark ? "dark" : "light" },
              "*",
            );
          });
        }

        body.querySelectorAll(".mdn-section").forEach((s) => {
          (s as HTMLElement).dataset.expanded = "true";
        });

        handleScroll();
      })();
    });

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}
