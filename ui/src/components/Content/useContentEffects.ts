import { useEffect, useRef } from "react";
import { useContentNavigationEffects } from "./useContentNavigationEffects";
import { useContentScrollMemory } from "./useContentScrollMemory";
import { isWorkspaceNavigationHref } from "./contentUtils";
import { scheduleContentEnhancements } from "./scheduleContentEnhancements";
import {
  applyPreviewActionTranslations,
  getHtmlPreviewDocument,
  openHtmlPreviewInBrowser,
  type PreviewActionLabels,
} from "../../dom/htmlPreviewActions";
import { resolveRenderedLink } from "../../dom/linkContextMenu";
import { createHeadingSectionInteractions } from "./headingSectionInteractions";
import type { HeadingSectionState } from "./enhancements/headingSectionState";
import type { LinkContextMenuState } from "../shared/LinkContextMenu";

interface ContentEffectsArgs {
  state: any;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onImageClick: (el: HTMLElement) => void;
  navigate: (path: string) => void;
  push: (path: string) => void;
  bridge: any;
  previewLabels: PreviewActionLabels;
  onOpenHtmlModal: (documentHtml: string, trigger: HTMLElement) => void;
  onOpenLinkMenu: (state: LinkContextMenuState) => void;
  onBookmarkContextMenu?: (event: MouseEvent) => boolean;
  onActionError: (message: string) => void;
}

export function useContentEffects({
  state,
  bodyRef,
  scrollRef,
  onImageClick,
  navigate,
  push,
  bridge,
  previewLabels,
  onOpenHtmlModal,
  onOpenLinkMenu,
  onBookmarkContextMenu,
  onActionError,
}: ContentEffectsArgs) {
  const scrollPositionsRef = useContentScrollMemory(state.currentFile, scrollRef);
  const lastRestoredFileRef = useRef<string | null>(null);
  const lastRestoredVersionRef = useRef<number | null>(null);
  const mermaidRunIdRef = useRef(0);
  const headingStateByFileRef = useRef<Map<string, HeadingSectionState>>(new Map());

  useContentNavigationEffects({
    currentFile: state.currentFile,
    markdownSource: state.markdownSource,
    navigate,
    push,
  });

  // Post-render effects: highlight, mermaid, table init, click handlers, sticky header
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || state.isLoading || state.notFoundHref || state.workspaceUnavailablePath) return;

    const headingSections = createHeadingSectionInteractions({
      body,
      currentFile: state.currentFile,
      defaultExpanded: state.defaultExpanded !== false,
      stateByFile: headingStateByFileRef.current,
    });

    applyPreviewActionTranslations(body, previewLabels);

    const handleContextMenu = (event: MouseEvent) => {
      if (onBookmarkContextMenu?.(event)) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href], a[data-mdn-target]");
      if (!anchor || !body.contains(anchor)) return;
      event.preventDefault();
      event.stopPropagation();
      onOpenLinkMenu({
        x: event.clientX,
        y: event.clientY,
        anchor,
        bookmarkTarget: event.target.closest('[data-mdn-bookmark-kind="image"]') ?? anchor,
        link: resolveRenderedLink(anchor, state.currentFile || ""),
      });
    };

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

      const openBrowserBtn = target.closest(".mdn-open-browser-btn") as HTMLElement | null;
      if (openBrowserBtn) {
        e.preventDefault();
        e.stopPropagation();
        const documentHtml = getHtmlPreviewDocument(openBrowserBtn);
        if (!documentHtml) {
          onActionError(previewLabels.openError);
          return;
        }
        openHtmlPreviewInBrowser({
          bridge,
          runtime: state.appRuntime || "desktop",
          documentHtml,
          currentFile: state.currentFile,
          title: previewLabels.modalTitle,
          onError: () => onActionError(previewLabels.openError),
        });
        return;
      }

      const openModalBtn = target.closest(".mdn-open-modal-btn") as HTMLElement | null;
      if (openModalBtn) {
        e.preventDefault();
        e.stopPropagation();
        const documentHtml = getHtmlPreviewDocument(openModalBtn, "modal");
        if (!documentHtml) {
          onActionError(previewLabels.openError);
          return;
        }
        onOpenHtmlModal(documentHtml, openModalBtn);
        return;
      }

      // Chromium Extension Manifest V3 CSP Event Delegation for remaining inline handlers
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

        // 5. CSV/TSV data preview toggle
        const toggleCsvBtn = target.closest(".mdn-toggle-csv-btn") as HTMLElement | null;
        if (toggleCsvBtn) {
          e.preventDefault();
          e.stopPropagation();
          const win = window as any;
          if (win.UI?.toggleCsvMode) win.UI.toggleCsvMode(toggleCsvBtn);
          return;
        }

        // 6. Code block collapse toggle button (Show More / Show Less)
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
          headingSections.expandAncestors(targetEl);
          const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
          targetEl.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start",
          });
        }
      }
    };
    body.addEventListener("click", handleClick);
    body.addEventListener("contextmenu", handleContextMenu);

    const stopEnhancements = scheduleContentEnhancements({
      body,
      state,
      scrollRef,
      handleScroll,
      mermaidRunIdRef,
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
      stopEnhancements();
      body.removeEventListener("click", handleClick);
      body.removeEventListener("contextmenu", handleContextMenu);
      headingSections.dispose();
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, [state.renderVersion, state.theme, state.themeStyle, state.settings.activeCustomThemeId,
    state.settings.customThemes, state.settings.fontBindings, state.isLoading, state.notFoundHref,
    state.workspaceUnavailablePath, onImageClick, navigate, scrollRef, bridge, previewLabels,
    onOpenHtmlModal, onOpenLinkMenu, onBookmarkContextMenu, onActionError, state.currentFile, state.appRuntime,
    state.defaultExpanded]);
}
