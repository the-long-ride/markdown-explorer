import { useCallback, useEffect, useState, type ReactNode, type RefObject } from "react";
import type { AppState } from "../../contexts/appStateModel";
import { getExportScopeTranslations } from "../../contexts/exportScopeTranslations";
import { getTranslations } from "../../contexts/translations";
import { copyElementImageToClipboard, saveElementImageAsPng } from "../../dom/copyImage";
import { documentBaseHref, openHtmlPreviewInBrowser, prepareStandaloneHtmlPreview } from "../../dom/htmlPreviewActions";
import type { ResolvedLink } from "../../dom/linkContextMenu";
import { findScopeFile } from "../../export/documentSnapshot";
import { ACTION_NOTICE_EVENT, type ActionNoticeTone } from "../../utils/actionNotice.ts";
import { BookmarkSelectionMenu } from "../Bookmarks/BookmarkSelectionMenu";
import { HtmlPreviewModal } from "../Modal/HtmlPreviewModal";
import { ScopeViewModal } from "../Modal/ScopeViewModal";
import { LinkContextMenu, type LinkContextMenuState } from "../shared/LinkContextMenu";
import { buildRenderedDocumentSnapshot } from "./contentUtils";
import { useBookmarkSelection } from "./useBookmarkSelection";

export interface DocumentOverlayDocument {
  filePath: string | null;
  relativePath: string;
  contentHtml: string;
  renderVersion: number;
  markdownSource: string | null;
  sourceDocumentText: string | null;
  isFullHtmlPreview: boolean;
}

interface DocumentOverlayArgs {
  state: AppState;
  bridge: any;
  document: DocumentOverlayDocument;
  bodyRef: RefObject<HTMLDivElement | null>;
  onImageClick: (el: HTMLElement) => void;
}

export function showActionNotice(message: string, tone: ActionNoticeTone = "neutral"): void {
  window.dispatchEvent(new CustomEvent(ACTION_NOTICE_EVENT, { detail: { message, tone } }));
}

// Link/image context menu, bookmark selection menu, HTML preview modal and
// scope modal for one rendered document (main view or a split pane).
export function useDocumentOverlays({ state, bridge, document: doc, bodyRef, onImageClick }: DocumentOverlayArgs) {
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);
  const scopeT = getExportScopeTranslations(currentLang).scopeView;
  const [htmlModal, setHtmlModal] = useState<{ documentHtml: string; trigger: HTMLElement } | null>(null);
  const [linkMenu, setLinkMenu] = useState<LinkContextMenuState | null>(null);
  const [scopeFile, setScopeFile] = useState<(typeof state.fileList)[number] | null>(null);

  useEffect(() => {
    setLinkMenu(null); setHtmlModal(null); setScopeFile(null);
  }, [doc.filePath, doc.renderVersion]);

  const onActionError = useCallback((message: string) => showActionNotice(message), []);

  const onOpenHtmlModal = useCallback((documentHtml: string, trigger: HTMLElement) => {
    setLinkMenu(null);
    setHtmlModal({ documentHtml: prepareStandaloneHtmlPreview(documentHtml, doc.filePath), trigger });
  }, [doc.filePath]);

  const handleOpenResolvedLink = useCallback((link: ResolvedLink) => {
    setLinkMenu(null);
    if (!link.openable) { showActionNotice(t.previewActions.unableToOpenLink); return; }
    if (link.kind === "fragment") {
      const fragment = link.raw.startsWith("#") ? link.raw : new URL(link.resolved).hash;
      const documentHtml = buildRenderedDocumentSnapshot(doc.contentHtml, doc.relativePath || doc.filePath || "Markdown Explorer", documentBaseHref(doc.filePath), fragment);
      openHtmlPreviewInBrowser({
        bridge,
        runtime: state.appRuntime || "desktop",
        documentHtml,
        currentFile: doc.filePath,
        title: doc.relativePath || doc.filePath || t.previewActions.modalTitle,
        onError: () => showActionNotice(t.previewActions.unableToOpenLink),
      });
      return;
    }
    bridge.postMessage({ command: "openExternal", url: link.resolved });
  }, [bridge, doc.contentHtml, doc.filePath, doc.relativePath, state.appRuntime, t.previewActions.modalTitle, t.previewActions.unableToOpenLink]);

  const handleCopyResolvedLink = useCallback(async (link: ResolvedLink) => {
    if (!link.copyable) { showActionNotice(t.previewActions.copyFailed); return; }
    try {
      await bridge.copyToClipboard(link.resolved);
      setLinkMenu(null);
      showActionNotice(t.previewActions.linkCopied);
    } catch {
      showActionNotice(t.previewActions.copyFailed);
    }
  }, [bridge, t.previewActions.copyFailed, t.previewActions.linkCopied]);

  const handleCopyImage = useCallback(async (target: HTMLElement | SVGElement) => {
    try {
      const ok = await copyElementImageToClipboard(target);
      setLinkMenu(null);
      showActionNotice(ok ? t.previewActions.imageCopied : t.previewActions.copyFailed);
    } catch {
      setLinkMenu(null);
      showActionNotice(t.previewActions.copyFailed);
    }
  }, [t.previewActions.copyFailed, t.previewActions.imageCopied]);

  const handleSaveImage = useCallback(async (target: HTMLElement | SVGElement) => {
    try {
      const isMermaid = target.getAttribute?.("data-mdn-bookmark-kind") === "mermaid" || Boolean(target.closest?.(".mdn-mermaid-wrap"));
      const fileName = isMermaid ? "mermaid-diagram.png" : "diagram.png";
      const ok = await saveElementImageAsPng(target, fileName);
      setLinkMenu(null);
      showActionNotice(ok ? (t.previewActions.imageSaved || "Image saved.") : (t.previewActions.imageSaveFailed || "Failed to save image."), ok ? "neutral" : "error");
    } catch {
      setLinkMenu(null);
      showActionNotice(t.previewActions.imageSaveFailed || "Failed to save image.", "error");
    }
  }, [t.previewActions.imageSaveFailed, t.previewActions.imageSaved]);

  const { bookmarkSelection, closeBookmarkSelection, handleBookmarkContextMenu, openBookmarkDialogForElement } = useBookmarkSelection({
    enabled: state.settings.bookmarksEnabled,
    currentFile: doc.filePath,
    renderVersion: doc.renderVersion,
    isFullHtmlPreview: doc.isFullHtmlPreview,
    markdownSource: doc.markdownSource,
    sourceDocumentText: doc.sourceDocumentText,
    bodyRef,
    closeLinkMenu: () => setLinkMenu(null),
  });

  const scopeTarget = linkMenu?.link ? findScopeFile(linkMenu.link, state.fileList) : null;

  const overlays: ReactNode = (
    <>
      {htmlModal && <HtmlPreviewModal documentHtml={htmlModal.documentHtml} title={t.previewActions.modalTitle} closeLabel={t.previewActions.closeModal} trigger={htmlModal.trigger} onClose={() => setHtmlModal(null)} />}
      <ScopeViewModal initialFile={scopeFile} files={state.fileList} onMediaClick={onImageClick} onClose={() => setScopeFile(null)} />
      <BookmarkSelectionMenu state={bookmarkSelection} workspaceName={state.workspaceName} workspacePath={state.workspacePath} filePath={doc.filePath} translations={t.bookmarks} onClose={closeBookmarkSelection} />
      {linkMenu && (
        <LinkContextMenu
          state={linkMenu} menuLabel={t.previewActions.linkMenu} openLabel={t.previewActions.openInBrowser}
          copyLabel={t.previewActions.copyLink} copyImageLabel={t.previewActions.copyImage} saveImageLabel={t.previewActions.saveImagePng}
          bookmarkLabel={state.settings.bookmarksEnabled ? t.bookmarks.addSelection : undefined}
          scopeLabel={scopeTarget ? scopeT.openAsScope : undefined}
          onOpenScope={scopeTarget ? () => { setScopeFile(scopeTarget); setLinkMenu(null); } : undefined}
          onOpen={handleOpenResolvedLink} onCopy={handleCopyResolvedLink} onCopyImage={handleCopyImage} onSaveImage={handleSaveImage}
          onBookmark={state.settings.bookmarksEnabled && linkMenu.bookmarkTarget ? () => {
            const opened = linkMenu.bookmarkTarget ? openBookmarkDialogForElement(linkMenu.bookmarkTarget, linkMenu.x, linkMenu.y) : false;
            if (!opened) showActionNotice(t.bookmarks.targetUnavailable, 'error');
          } : undefined}
          onClose={() => setLinkMenu(null)}
        />
      )}
    </>
  );

  return {
    onOpenHtmlModal,
    onOpenLinkMenu: setLinkMenu,
    onBookmarkContextMenu: handleBookmarkContextMenu,
    onActionError,
    overlays,
  };
}
