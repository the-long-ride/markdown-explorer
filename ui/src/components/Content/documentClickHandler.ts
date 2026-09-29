import { isWorkspaceNavigationHref } from "./contentUtils";
import { getHtmlPreviewDocument, openHtmlPreviewInBrowser, type PreviewActionLabels } from "../../dom/htmlPreviewActions";
import type { HeadingSectionInteractions } from "./headingSectionInteractions";
import type { AppRuntime } from "../../types/settings";
import type { DocumentInteractionCallbacks } from "./documentInteractionTypes";
import { findDocumentMediaTarget } from "./documentMediaTarget";


interface DocumentClickContext {
  body: HTMLElement;
  filePath: string | null;
  appRuntime: AppRuntime | undefined;
  bridge: any;
  previewLabels: PreviewActionLabels;
  headingSections: HeadingSectionInteractions;
  callbacks: DocumentInteractionCallbacks;
}

export function createDocumentClickHandler({
  body, filePath, appRuntime, bridge, previewLabels, headingSections, callbacks,
}: DocumentClickContext): (e: Event) => void {
  return (e: Event) => {
    const rawTarget = e.target as (Node | null);
    const target = (rawTarget instanceof Element ? rawTarget : rawTarget?.parentElement) as HTMLElement | null;
    if (!target) return;

    const openBrowserBtn = target.closest(".mdn-open-browser-btn") as HTMLElement | null;
    if (openBrowserBtn) {
      e.preventDefault();
      e.stopPropagation();
      const documentHtml = getHtmlPreviewDocument(openBrowserBtn);
      if (!documentHtml) {
        callbacks.onActionError(previewLabels.openError);
        return;
      }
      openHtmlPreviewInBrowser({
        bridge,
        runtime: appRuntime || "desktop",
        documentHtml,
        currentFile: filePath,
        title: previewLabels.modalTitle,
        onError: () => callbacks.onActionError(previewLabels.openError),
      });
      return;
    }

    const openModalBtn = target.closest(".mdn-open-modal-btn") as HTMLElement | null;
    if (openModalBtn) {
      e.preventDefault();
      e.stopPropagation();
      const documentHtml = getHtmlPreviewDocument(openModalBtn, "modal");
      if (!documentHtml) {
        callbacks.onActionError(previewLabels.openError);
        return;
      }
      callbacks.onOpenHtmlModal(documentHtml, openModalBtn);
      return;
    }

    const isChrome = typeof (window as any).__chromeExtBus !== "undefined";
    if (isChrome) {
      const copySectionBtn = target.closest(".mdn-section-copy-btn") as HTMLElement | null;
      if (copySectionBtn) {
        e.preventDefault(); e.stopPropagation();
        const win = window as any;
        if (win.UI?.copySection) win.UI.copySection(copySectionBtn, e);
        return;
      }

      const copyCodeBtn = target.closest(".mdn-copy-btn") as HTMLElement | null;
      if (copyCodeBtn) {
        e.preventDefault(); e.stopPropagation();
        const win = window as any;
        if (win.UI?.copyCode) win.UI.copyCode(copyCodeBtn);
        return;
      }

      const togglePreviewBtn = target.closest(".mdn-toggle-preview-btn") as HTMLElement | null;
      if (togglePreviewBtn) {
        e.preventDefault(); e.stopPropagation();
        const win = window as any;
        if (win.UI?.toggleHtmlMode) win.UI.toggleHtmlMode(togglePreviewBtn);
        return;
      }

      const toggleCsvBtn = target.closest(".mdn-toggle-csv-btn") as HTMLElement | null;
      if (toggleCsvBtn) {
        e.preventDefault(); e.stopPropagation();
        const win = window as any;
        if (win.UI?.toggleCsvMode) win.UI.toggleCsvMode(toggleCsvBtn);
        return;
      }

      const codeblockToggleBtn = target.closest(".mdn-codeblock-toggle-btn") as HTMLElement | null;
      if (codeblockToggleBtn) {
        e.preventDefault(); e.stopPropagation();
        const win = window as any;
        if (win.UI?.toggleCodeCollapse) win.UI.toggleCodeCollapse(codeblockToggleBtn);
        return;
      }

      const th = target.closest(".mdn-th") as HTMLElement | null;
      if (th) {
        const filterBtn = target.closest(".mdn-table-filter-btn") as HTMLElement | null;
        if (filterBtn) {
          e.preventDefault(); e.stopPropagation();
          const table = th.closest("table") as HTMLTableElement | null;
          const colIdx = th.dataset.col ? parseInt(th.dataset.col, 10) : null;
          const win = window as any;
          if (table && colIdx !== null && win.Table?.showFilterMenu) win.Table.showFilterMenu(table.id, colIdx, filterBtn);
          return;
        }
        e.preventDefault(); e.stopPropagation();
        const table = th.closest("table") as HTMLTableElement | null;
        const colIdx = th.dataset.col ? parseInt(th.dataset.col, 10) : null;
        const win = window as any;
        if (table && colIdx !== null && win.Table?.sort) win.Table.sort(table.id, colIdx);
        return;
      }

      const tableToggleBtn = target.closest(".mdn-table-toggle-btn") as HTMLElement | null;
      if (tableToggleBtn) {
        e.preventDefault(); e.stopPropagation();
        const tableId = tableToggleBtn.id.replace("-toggle-btn", "");
        const win = window as any;
        if (win.Table?.toggleCollapse) win.Table.toggleCollapse(tableId);
        return;
      }

      const tableWrapToggle = target.closest(".mdn-table-wrap-toggle") as HTMLElement | null;
      if (tableWrapToggle) {
        e.preventDefault(); e.stopPropagation();
        const tableId = tableWrapToggle.id.replace("-wrap-toggle", "");
        const win = window as any;
        if (win.Table?.toggleWrap) win.Table.toggleWrap(tableId);
        return;
      }

      const columnsToggle = target.closest(".mdn-table-columns-toggle") as HTMLElement | null;
      if (columnsToggle) {
        e.preventDefault(); e.stopPropagation();
        const tableId = columnsToggle.id.replace("-columns-toggle", "");
        const win = window as any;
        if (win.Table?.toggleColumnMenu) win.Table.toggleColumnMenu(tableId, e);
        return;
      }

      const selectBtn = target.closest(".mdn-table-view-select") as HTMLElement | null;
      if (selectBtn) {
        e.preventDefault(); e.stopPropagation();
        const dropdownEl = selectBtn.closest(".mdn-table-view-dropdown") as HTMLElement | null;
        if (dropdownEl?.id) {
          const tableId = dropdownEl.id.replace("-view-dropdown", "");
          const win = window as any;
          if (win.Table?.toggleViewDropdown) win.Table.toggleViewDropdown(tableId, e);
        }
        return;
      }

      const optionBtn = target.closest(".mdn-table-view-menu__option") as HTMLElement | null;
      if (optionBtn) {
        e.preventDefault(); e.stopPropagation();
        const dropdownEl = optionBtn.closest(".mdn-table-view-dropdown") as HTMLElement | null;
        const val = optionBtn.getAttribute("data-value");
        if (dropdownEl?.id && val) {
          const tableId = dropdownEl.id.replace("-view-dropdown", "");
          const win = window as any;
          if (win.Table?.switchView) win.Table.switchView(tableId, val);
          if (win.Table?.closeViewDropdown) win.Table.closeViewDropdown(tableId);
        }
        return;
      }

      const internalLink = target.closest(".mdn-link--internal") as HTMLElement | null;
      if (internalLink) {
        e.preventDefault(); e.stopPropagation();
        const onclickAttr = internalLink.getAttribute("onclick") || "";
        const match = onclickAttr.match(/Nav\.go\('([^']+)'\)/);
        if (match) callbacks.navigate(match[1]);
        return;
      }

      const anchorLink = target.closest(".mdn-anchor") as HTMLElement | null;
      if (anchorLink) e.stopPropagation();
    }

    const selectBtn = target.closest(".mdn-table-view-select") as HTMLElement | null;
    if (selectBtn) {
      e.preventDefault(); e.stopPropagation();
      const dropdownEl = selectBtn.closest(".mdn-table-view-dropdown") as HTMLElement | null;
      if (dropdownEl?.id) (window as any).Table?.toggleViewDropdown?.(dropdownEl.id.replace("-view-dropdown", ""), e);
      return;
    }

    const optionBtn = target.closest(".mdn-table-view-menu__option") as HTMLElement | null;
    if (optionBtn) {
      e.preventDefault(); e.stopPropagation();
      const dropdownEl = optionBtn.closest(".mdn-table-view-dropdown") as HTMLElement | null;
      const val = optionBtn.getAttribute("data-value");
      if (dropdownEl?.id && val) {
        const tableId = dropdownEl.id.replace("-view-dropdown", "");
        const win = window as any;
        win.Table?.switchView?.(tableId, val);
        win.Table?.closeViewDropdown?.(tableId);
      }
      return;
    }

    // Controls (copy/toggle buttons etc.) often contain decorative <svg> icons;
    // they must never be treated as media and open the viewer.
    const media = findDocumentMediaTarget(target, (img) => Boolean(img.closest('.mdn-body')) || img.classList.contains('mdn-img'));
    if (media) {
      callbacks.onImageClick(media);
      return;
    }
    const link = target.closest<HTMLAnchorElement>(".mdn-body a[href]");
    const href = link?.getAttribute("href") ?? "";
    if (link && isWorkspaceNavigationHref(href)) {
      e.preventDefault(); e.stopPropagation();
      callbacks.navigate(href);
    } else if (link && href.startsWith("#") && href.length > 1) {
      e.preventDefault();
      const targetId = decodeURIComponent(href.slice(1));
      const targetEl = body.querySelector<HTMLElement>(`[id="${CSS.escape(targetId)}"]`);
      if (targetEl) {
        headingSections.expandAncestors(targetEl);
        const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        targetEl.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      }
    }
  };
}
