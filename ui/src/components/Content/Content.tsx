// =============================================================================
// components/Content/Content.tsx — Main content area (rendered HTML + effects)
// =============================================================================

import { useEffect, useRef, memo } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { useNavigation } from "../../contexts/NavigationContext";
import { usePlatform } from "../../contexts/PlatformContext";
import { getTranslations } from "../../contexts/translations";
import { getChart, getHighlightJs, getKatex, getMermaid } from "../../lib/renderLibs";
import { WelcomePage } from "./WelcomePage";
import { AlertTriangleIcon, FolderIcon, TrashIcon } from "../shared/icons";

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

function isWorkspaceNavigationHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#" || trimmed.startsWith("#")) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return false;
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  );
}

function formatPreviewDuration(durationMs: number | undefined): string {
  if (!Number.isFinite(durationMs) || !durationMs) return "";
  if (durationMs < 1000) return `${Math.max(1, Math.round(durationMs))} ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}

const DEFAULT_CONVERSION_WARNING =
  "This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file.";
const DEFAULT_CONVERSION_FAILURE_WARNING =
  "Markdown Explorer could not convert this file. The details are shown below.";

function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

interface ContentProps {
  onImageClick: (el: HTMLElement) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  suppressWelcome?: boolean;
}

export function Content({
  onImageClick,
  scrollRef,
  suppressWelcome = false,
}: ContentProps) {
  const { state, navigate, updateSettings } = useAppState();
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);
  const { push } = useNavigation();
  const bridge = usePlatform();
  const bodyRef = useRef<HTMLDivElement>(null);
  const workspaceUnavailablePath = state.workspaceUnavailablePath;
  const previewInfo = state.previewInfo;
  const previewDuration = formatPreviewDuration(previewInfo?.durationMs);
  const previewCopy = t.documentPreview;
  const previewTitle = previewInfo
    ? formatTemplate(
        previewInfo.kind === "converted"
          ? previewCopy.convertedTitle
          : previewCopy.textTitle,
        { sourceLabel: previewInfo.sourceLabel },
      )
    : "";
  const previewWarning =
    previewInfo?.qualityWarning === DEFAULT_CONVERSION_FAILURE_WARNING
      ? previewCopy.conversionFailedWarning
      : previewInfo?.qualityWarning &&
          previewInfo.qualityWarning !== DEFAULT_CONVERSION_WARNING
        ? previewInfo.qualityWarning
        : previewInfo?.kind === "converted"
          ? previewCopy.convertedWarning
          : previewCopy.textWarning;
  const previewMeta = previewInfo && previewDuration
    ? formatTemplate(previewCopy.durationMeta, {
        status: previewInfo.fromCache
          ? previewCopy.loadedCachedConversion
          : previewCopy.preparedLocally,
        duration: previewDuration,
      })
    : "";
  const isDesktopTabView =
    typeof (window as any).electronAPI !== "undefined" &&
    state.settings.desktopViewMode === "tabs";
  const isUnavailableWorkspaceInHistory = workspaceUnavailablePath
    ? state.recentWorkspaces.some((item) => item.path === workspaceUnavailablePath)
    : false;

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

  useEffect(() => {
    const win = window as any;
    if (!win.UI) win.UI = {};
    win.UI.currentMarkdownSource = state.markdownSource;
    return () => {
      if (win.UI?.currentMarkdownSource === state.markdownSource) {
        win.UI.currentMarkdownSource = null;
      }
    };
  }, [state.markdownSource]);

  useEffect(() => {
    const win = window as any;
    if (!win.Nav) win.Nav = {};
    const previousGo = win.Nav.go;
    const go = (fsPath: string | null) => {
      if (!fsPath) return;
      navigate(String(fsPath));
    };

    win.Nav.go = go;
    return () => {
      if (win.Nav?.go === go) {
        win.Nav.go = previousGo;
      }
    };
  }, [navigate]);

  // Post-render effects: highlight, mermaid, table init, click handlers, sticky header
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || state.isLoading || state.notFoundHref || state.workspaceUnavailablePath) return;

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

      // Chromium Extension Manifest V3 CSP Event Delegation for inline handlers
      const isChrome = typeof (window as any).__chromeExtBus !== "undefined";
      if (isChrome) {
        // 1. Copy Section button
        const copySectionBtn = target.closest(".mdn-section-copy-btn") as HTMLElement | null;
        if (copySectionBtn) {
          e.preventDefault();
          e.stopPropagation();
          const win = window as any;
          if (win.UI?.copySection) {
            win.UI.copySection(copySectionBtn, e);
          }
          return;
        }

        // 2. Copy Code button
        const copyCodeBtn = target.closest(".mdn-copy-btn") as HTMLElement | null;
        if (copyCodeBtn) {
          e.preventDefault();
          e.stopPropagation();
          const win = window as any;
          if (win.UI?.copyCode) {
            win.UI.copyCode(copyCodeBtn);
          }
          return;
        }

        // 3. Section header toggle (Expand/Collapse)
        const sectionHeader = target.closest(".mdn-section-header") as HTMLElement | null;
        if (sectionHeader) {
          if (target.closest(".mdn-anchor") || target.closest(".mdn-section-copy-btn")) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          const win = window as any;
          if (win.UI?.toggleSection) {
            win.UI.toggleSection(sectionHeader);
          }
          return;
        }

        // 4. Code block HTML preview toggle
        const togglePreviewBtn = target.closest(".mdn-toggle-preview-btn") as HTMLElement | null;
        if (togglePreviewBtn) {
          e.preventDefault();
          e.stopPropagation();
          const win = window as any;
          if (win.UI?.toggleHtmlMode) {
            win.UI.toggleHtmlMode(togglePreviewBtn);
          }
          return;
        }

        // 5. Code block collapse toggle button (Show More / Show Less)
        const codeblockToggleBtn = target.closest(".mdn-codeblock-toggle-btn") as HTMLElement | null;
        if (codeblockToggleBtn) {
          e.preventDefault();
          e.stopPropagation();
          const win = window as any;
          if (win.UI?.toggleCodeCollapse) {
            win.UI.toggleCodeCollapse(codeblockToggleBtn);
          }
          return;
        }

        // 6. Table Sort / Filter menu trigger click on TH or filter button
        const th = target.closest(".mdn-th") as HTMLElement | null;
        if (th) {
          const filterBtn = target.closest(".mdn-table-filter-btn") as HTMLElement | null;
          if (filterBtn) {
            e.preventDefault();
            e.stopPropagation();
            const table = th.closest("table") as HTMLTableElement | null;
            const colIdx = th.dataset.col ? parseInt(th.dataset.col, 10) : null;
            const win = window as any;
            if (table && colIdx !== null && win.Table?.showFilterMenu) {
              win.Table.showFilterMenu(table.id, colIdx, filterBtn);
            }
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          const table = th.closest("table") as HTMLTableElement | null;
          const colIdx = th.dataset.col ? parseInt(th.dataset.col, 10) : null;
          const win = window as any;
          if (table && colIdx !== null && win.Table?.sort) {
            win.Table.sort(table.id, colIdx);
          }
          return;
        }

        // 7. Table collapse toggle button
        const tableToggleBtn = target.closest(".mdn-table-toggle-btn") as HTMLElement | null;
        if (tableToggleBtn) {
          e.preventDefault();
          e.stopPropagation();
          const tableId = tableToggleBtn.id.replace("-toggle-btn", "");
          const win = window as any;
          if (win.Table?.toggleCollapse) {
            win.Table.toggleCollapse(tableId);
          }
          return;
        }

        // 8. Table wrap toggle button
        const tableWrapToggle = target.closest(".mdn-table-wrap-toggle") as HTMLElement | null;
        if (tableWrapToggle) {
          e.preventDefault();
          e.stopPropagation();
          const tableId = tableWrapToggle.id.replace("-wrap-toggle", "");
          const win = window as any;
          if (win.Table?.toggleWrap) {
            win.Table.toggleWrap(tableId);
          }
          return;
        }

        // 9. Table view switcher dropdown triggers
        const selectBtn = target.closest(".mdn-table-view-select") as HTMLElement | null;
        if (selectBtn) {
          e.preventDefault();
          e.stopPropagation();
          const dropdownEl = selectBtn.closest(".mdn-table-view-dropdown") as HTMLElement | null;
          if (dropdownEl && dropdownEl.id) {
            const tableId = dropdownEl.id.replace("-view-dropdown", "");
            const win = window as any;
            if (win.Table?.toggleViewDropdown) {
              win.Table.toggleViewDropdown(tableId, e);
            }
          }
          return;
        }

        // 9b. Table view switcher option clicks
        const optionBtn = target.closest(".mdn-table-view-menu__option") as HTMLElement | null;
        if (optionBtn) {
          e.preventDefault();
          e.stopPropagation();
          const dropdownEl = optionBtn.closest(".mdn-table-view-dropdown") as HTMLElement | null;
          const val = optionBtn.getAttribute("data-value");
          if (dropdownEl && dropdownEl.id && val) {
            const tableId = dropdownEl.id.replace("-view-dropdown", "");
            const win = window as any;
            if (win.Table?.switchView) {
              win.Table.switchView(tableId, val);
            }
            if (win.Table?.closeViewDropdown) {
              win.Table.closeViewDropdown(tableId);
            }
          }
          return;
        }

        // 10. Internal document link clicks
        const internalLink = target.closest(".mdn-link--internal") as HTMLElement | null;
        if (internalLink) {
          e.preventDefault();
          e.stopPropagation();
          const onclickAttr = internalLink.getAttribute("onclick") || "";
          const match = onclickAttr.match(/Nav\.go\('([^']+)'\)/);
          if (match) {
            const path = match[1];
            navigate(path);
          }
          return;
        }

        // 11. Anchor hashtag copy-link clicks
        const anchorLink = target.closest(".mdn-anchor") as HTMLElement | null;
        if (anchorLink) {
          e.stopPropagation();
          // let normal click event navigate/focus the hash tag
        }
      }

      // Table view switcher dropdown (runs in all environments: Electron + Chrome)
      const selectBtn = target.closest(".mdn-table-view-select") as HTMLElement | null;
      if (selectBtn) {
        e.preventDefault();
        e.stopPropagation();
        const dropdownEl = selectBtn.closest(".mdn-table-view-dropdown") as HTMLElement | null;
        if (dropdownEl && dropdownEl.id) {
          const tableId = dropdownEl.id.replace("-view-dropdown", "");
          const win = window as any;
          if (win.Table?.toggleViewDropdown) {
            win.Table.toggleViewDropdown(tableId, e);
          }
        }
        return;
      }

      // Table view switcher menu option clicks (runs in all environments)
      const optionBtn = target.closest(".mdn-table-view-menu__option") as HTMLElement | null;
      if (optionBtn) {
        e.preventDefault();
        e.stopPropagation();
        const dropdownEl = optionBtn.closest(".mdn-table-view-dropdown") as HTMLElement | null;
        const val = optionBtn.getAttribute("data-value");
        if (dropdownEl && dropdownEl.id && val) {
          const tableId = dropdownEl.id.replace("-view-dropdown", "");
          const win = window as any;
          if (win.Table?.switchView) win.Table.switchView(tableId, val);
          if (win.Table?.closeViewDropdown) win.Table.closeViewDropdown(tableId);
        }
        return;
      }

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
      const link = target.closest<HTMLAnchorElement>(".mdn-body a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (link && isWorkspaceNavigationHref(href)) {
        e.preventDefault();
        e.stopPropagation();
        navigate(href);
      } else if (link && href.startsWith("#") && href.length > 1) {
        // Hash anchor: prevent default top-scroll and center the target instead
        e.preventDefault();
        const targetId = decodeURIComponent(href.slice(1));
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          // Expand collapsed sections if needed
          let section = targetEl.closest<HTMLElement>(".mdn-section");
          while (section) {
            section.setAttribute("data-expanded", "true");
            section = section.parentElement?.closest<HTMLElement>(".mdn-section") ?? null;
          }
          targetEl.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "center",
          });
        }
      }
    };
    body.addEventListener("click", handleClick);

    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      void (async () => {
        if (cancelled) return;

        const codeBlocks = [
          ...body.querySelectorAll<HTMLElement>("pre code:not(.is-custom-highlighted)"),
        ].filter((block) => !/\blanguage-(text|plain|plaintext)\b/.test(block.className));

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
    state.themeStyle,
    state.isLoading,
    state.notFoundHref,
    state.workspaceUnavailablePath,
    onImageClick,
    navigate,
    scrollRef,
    bridge,
  ]);

  // Frontmatter header
  const fmEntries = Object.entries(state.frontmatter);

  const handleOpenWorkspaceAgain = () => {
    bridge.postMessage({ command: "openFolder", openFirstFile: isDesktopTabView });
  };

  const handleDeleteUnavailableWorkspace = () => {
    if (!workspaceUnavailablePath) return;
    bridge.postMessage({ command: "deleteRecentWorkspace", path: workspaceUnavailablePath });
  };

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
            <div className="state-screen__title">{state.loadingLabel || "Loading docs..."}</div>
            {state.loadingDetail && (
              <div className="state-screen__sub">{state.loadingDetail}</div>
            )}
          </div>
        )}

        {/* Workspace unavailable */}
        {!state.isLoading && workspaceUnavailablePath && (
          <div className="state-screen state-screen--workspace-unavailable">
            <div className="state-screen__icon state-screen__icon--warning">
              <AlertTriangleIcon size={34} />
            </div>
            <div className="state-screen__title">Workspace not found</div>
            <div className="state-screen__sub">
              The current path no longer exists or is locked. Please open the workspace again.
            </div>
            <div className="state-screen__path">{workspaceUnavailablePath}</div>
            {isDesktopTabView && (
              <div className="state-screen__hint">
                Tab view: close this tab after deleting it from history, then open the workspace again.
              </div>
            )}
            <div className="state-screen__actions">
              <button
                type="button"
                className="state-screen__button state-screen__button--primary"
                onClick={handleOpenWorkspaceAgain}
              >
                <FolderIcon size={14} />
                <span>Open Workspace Again</span>
              </button>
              <button
                type="button"
                className="state-screen__button state-screen__button--danger"
                onClick={handleDeleteUnavailableWorkspace}
                disabled={!isUnavailableWorkspaceInHistory}
              >
                <TrashIcon size={14} />
                <span>
                  {isUnavailableWorkspaceInHistory ? "Delete from History" : "Removed from History"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Not Found */}
        {!workspaceUnavailablePath && state.notFoundHref && (
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
          !workspaceUnavailablePath &&
          state.fileList.length === 0 &&
          !state.contentHtml && (
            <div className="state-screen">
              <div className="state-screen__icon">📁</div>
              <div className="state-screen__title">
                {state.settings.documentConversion
                  ? "No supported documents found"
                  : "No Markdown, MDX, or TXT files found"}
              </div>
              <div className="state-screen__sub">
                {state.settings.documentConversion
                  ? "Add Markdown, DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, RTF, or TXT files to this workspace."
                  : "Add a .md, .mdx, or .txt file, or turn on document conversion to preview DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, and RTF files."}
              </div>
              {!state.settings.documentConversion && (
                <button
                  type="button"
                  className="state-screen__button state-screen__button--primary"
                  onClick={() => updateSettings({ documentConversion: true })}
                >
                  Enable document conversion
                </button>
              )}
            </div>
          )}

        {/* Welcome Page */}
        {!state.isLoading &&
          !state.notFoundHref &&
          !workspaceUnavailablePath &&
          !suppressWelcome &&
          !state.currentFile &&
          state.fileList.length > 0 && <WelcomePage />}

        {/* Content */}
        {!state.isLoading &&
          !state.notFoundHref &&
          !workspaceUnavailablePath &&
          state.currentFile &&
          state.contentHtml && (
            <div
              className="mdn-body"
              id="mdBody"
              ref={bodyRef}
              aria-live="polite"
            >
              {previewInfo && (
                <div
                  className={`document-preview-notice document-preview-notice--${previewInfo.kind}`}
                  role="note"
                >
                  <AlertTriangleIcon size={16} />
                  <div className="document-preview-notice__body">
                    <div className="document-preview-notice__title">
                      {previewTitle}
                    </div>
                    <div className="document-preview-notice__text">
                      {previewWarning}
                    </div>
                    {previewMeta && (
                      <div className="document-preview-notice__meta">
                        {previewMeta}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {fmEntries.length > 0 && (
                <div className="mdn-frontmatter" aria-label="Document properties">
                  {fmEntries.map(([k, v]) => (
                    <div className="mdn-frontmatter-field" key={k}>
                      <span className="mdn-frontmatter-key">{k}</span>
                      <span className="mdn-frontmatter-value">{v || '\u00a0'}</span>
                    </div>
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
