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
    const link = target.closest<HTMLAnchorElement>(".mdn-body a[href], .mdn-body a[data-mdn-target]");
    const linkTarget = link && !link.hasAttribute("onclick") ? (link.dataset.mdnTarget ?? "") : "";
    const href = linkTarget || (link?.getAttribute("href") ?? "");
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
