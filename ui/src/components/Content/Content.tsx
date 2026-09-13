import { memo, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { getExportScopeTranslations } from "../../contexts/exportScopeTranslations";
import { useNavigation } from "../../contexts/NavigationContext";
import { usePlatform } from "../../contexts/PlatformContext";
import { getTranslations } from "../../contexts/translations";
import { useContentEffects } from "./useContentEffects";
import { HtmlPreviewModal } from "../Modal/HtmlPreviewModal";
import { ScopeViewModal } from "../Modal/ScopeViewModal";
import { LinkContextMenu, type LinkContextMenuState } from "../shared/LinkContextMenu";
import { documentBaseHref, openHtmlPreviewInBrowser, prepareStandaloneHtmlPreview } from "../../dom/htmlPreviewActions";
import type { ResolvedLink } from "../../dom/linkContextMenu";
import { copyElementImageToClipboard, saveElementImageAsPng } from "../../dom/copyImage";
import { findScopeFile } from "../../export/documentSnapshot";
import { splitLeadingHtmlComments, buildRenderedDocumentSnapshot } from "./contentUtils";
import { isHtmlDocumentPath } from "./HtmlDocumentView";
import { convertHtmlSourceToMarkdown } from "../../markdown/htmlToMarkdown";
import { renderMarkdownClientSide } from "../../contexts/contentTabState";
import { documentSessionKey } from "../../editor/documentSession";
import { hasHtmlLocalFirstPolicyNotice, type HtmlLocalFirstPolicyReport } from "../../markdown/htmlLocalFirstPreview";
import { ContentMainView } from "./ContentMainView";
import { SplitContent } from "./SplitContent";
import { BookmarkSelectionMenu } from "../Bookmarks/BookmarkSelectionMenu";
import { useBookmarkSelection } from "./useBookmarkSelection";
import { ACTION_NOTICE_EVENT, normalizeActionNoticeDetail, type ActionNoticeDetail, type ActionNoticeTone } from "../../utils/actionNotice.ts";

export { isWorkspaceNavigationHref } from "./contentUtils";

export function formatPreviewDuration(durationMs: number | undefined): string {
  if (!Number.isFinite(durationMs) || !durationMs) return "";
  if (durationMs < 1000) return `${Math.max(1, Math.round(durationMs))} ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}

const DEFAULT_CONVERSION_WARNING = "This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file.";
const DEFAULT_CONVERSION_FAILURE_WARNING = "Markdown Explorer could not convert this file. The details are shown below.";

export function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.split(`{${key}}`).join(value), template);
}

interface ContentProps {
  onImageClick: (el: HTMLElement) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  suppressWelcome?: boolean;
  onCancelWorkspaceScan?: () => void;
  onOpenWorkspaceAgain?: (oldPath: string) => void;
}

export const Content = memo(function Content({
  onImageClick, scrollRef, suppressWelcome = false, onCancelWorkspaceScan, onOpenWorkspaceAgain,
}: ContentProps) {
  const {
    state,
    navigate,
    refresh,
    updateSettings,
    setWorkingDocumentSource,
    saveDocument,
  } = useAppState();
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);
  const scopeT = getExportScopeTranslations(currentLang).scopeView;
  const { push } = useNavigation();
  const bridge = usePlatform();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [htmlModal, setHtmlModal] = useState<{ documentHtml: string; trigger: HTMLElement } | null>(null);
  const [linkMenu, setLinkMenu] = useState<LinkContextMenuState | null>(null);
  const [scopeFile, setScopeFile] = useState<(typeof state.fileList)[number] | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNoticeDetail | null>(null);
  const actionNoticeTimerRef = useRef<number | null>(null);
  const workspaceUnavailablePath = state.workspaceUnavailablePath;
  const activeContentTab = state.contentTabs.find((tab) => tab.filePath === state.activeContentTabPath);
  const sourceDocumentText = activeContentTab?.sourceDocumentText ?? state.sourceDocumentText;
  const hostHtmlMarkdownSource = activeContentTab?.markdownSource ?? state.markdownSource;
  const hostHtmlMarkdownHtml = activeContentTab?.contentHtml ?? state.contentHtml;
  const htmlPreviewOverride = activeContentTab?.htmlPreviewOverride ?? state.currentHtmlPreviewOverride;
  const isHtmlDocument = isHtmlDocumentPath(state.currentFile) && sourceDocumentText !== null;
  const currentDocumentSession = state.currentFile
    ? state.documentSessions?.[documentSessionKey(state.currentFile)]
    : undefined;
  const htmlDocumentPreviewEnabled = htmlPreviewOverride ?? state.settings.defaultHtmlPreview;
  const isFullHtmlPreview = isHtmlDocument && htmlDocumentPreviewEnabled;
  const htmlMarkdownRender = useMemo(() => {
    if (!isHtmlDocument || sourceDocumentText === null) return { html: '', error: null as string | null };
    if (hostHtmlMarkdownSource) return { html: hostHtmlMarkdownHtml, error: null as string | null };
    try {
      const markdown = convertHtmlSourceToMarkdown(sourceDocumentText);
      return { html: renderMarkdownClientSide(markdown, state.currentFile, false, state.settings).html, error: null as string | null };
    } catch {
      return { html: '', error: t.htmlDocumentPreviewError };
    }
  }, [hostHtmlMarkdownHtml, hostHtmlMarkdownSource, isHtmlDocument, sourceDocumentText, state.currentFile, state.settings, t.htmlDocumentPreviewError]);
  const [htmlLocalFirstWarning, setHtmlLocalFirstWarning] = useState<HtmlLocalFirstPolicyReport | null>(null);
  const [showHtmlPreviewExperienceBanner, setShowHtmlPreviewExperienceBanner] = useState(false);
  const htmlPreviewExperienceNoticeSeenRef = useRef(false);
  const htmlPreviewWarningSeenRef = useRef<Set<string>>(new Set());
  const warningSessionKey = state.currentFile ?? '';
  const handleHtmlPolicyReport = useCallback((report: HtmlLocalFirstPolicyReport) => {
    if (!warningSessionKey || !hasHtmlLocalFirstPolicyNotice(report)) return;
    if (htmlPreviewWarningSeenRef.current.has(warningSessionKey)) return;
    htmlPreviewWarningSeenRef.current.add(warningSessionKey);
    setHtmlLocalFirstWarning(report);
  }, [warningSessionKey]);

  useEffect(() => setHtmlLocalFirstWarning(null), [state.currentFile]);
  useEffect(() => {
    if (!isFullHtmlPreview || !state.currentFile) { setShowHtmlPreviewExperienceBanner(false); return; }
    if (htmlPreviewExperienceNoticeSeenRef.current) return;
    htmlPreviewExperienceNoticeSeenRef.current = true;
    setShowHtmlPreviewExperienceBanner(true);
    const timer = window.setTimeout(() => setShowHtmlPreviewExperienceBanner(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [isFullHtmlPreview, state.currentFile]);

  const hasRenderableDocumentContent = Boolean(state.contentHtml) || isHtmlDocument || Boolean(currentDocumentSession);
  const previewInfo = state.previewInfo;
  const previewDuration = formatPreviewDuration(previewInfo?.durationMs);
  const previewCopy = t.documentPreview;
  const previewTitle = previewInfo
    ? formatTemplate(previewInfo.kind === "converted" ? previewCopy.convertedTitle : previewCopy.textTitle, { sourceLabel: previewInfo.sourceLabel })
    : "";
  const previewWarning = previewInfo?.qualityCode === "conversion-failed" || previewInfo?.qualityWarning === DEFAULT_CONVERSION_FAILURE_WARNING
    ? previewCopy.conversionFailedWarning
    : previewInfo?.qualityCode === "legacy-best-effort" ? previewCopy.legacyBestEffortWarning
      : previewInfo?.qualityCode === "converted-preview" ? previewCopy.convertedWarning
        : previewInfo?.qualityWarning && previewInfo.qualityWarning !== DEFAULT_CONVERSION_WARNING ? previewInfo.qualityWarning
          : previewInfo?.kind === "converted" ? previewCopy.convertedWarning : previewCopy.textWarning;
  const previewMeta = previewInfo && previewDuration
    ? formatTemplate(previewCopy.durationMeta, {
        status: previewInfo.fromCache ? previewCopy.loadedCachedConversion : previewCopy.preparedLocally,
        duration: previewDuration,
      })
    : "";
  const isDesktopTabView = typeof (window as any).electronAPI !== "undefined" && state.settings.desktopViewMode === "tabs";
  const isUnavailableWorkspaceInHistory = workspaceUnavailablePath
    ? state.recentWorkspaces.some((item) => item.path === workspaceUnavailablePath) : false;

  const showActionNotice = useCallback((message: string, tone: ActionNoticeTone = 'neutral') => {
    setActionNotice({ message, tone });
    if (actionNoticeTimerRef.current !== null) window.clearTimeout(actionNoticeTimerRef.current);
    actionNoticeTimerRef.current = window.setTimeout(() => setActionNotice(null), 2600);
  }, []);
  useEffect(() => () => {
    if (actionNoticeTimerRef.current !== null) window.clearTimeout(actionNoticeTimerRef.current);
  }, []);
  useEffect(() => {
    const handleNotice = (event: Event) => {
      const detail = normalizeActionNoticeDetail((event as CustomEvent<unknown>).detail);
      if (detail) showActionNotice(detail.message, detail.tone);
    };
    window.addEventListener(ACTION_NOTICE_EVENT, handleNotice);
    return () => window.removeEventListener(ACTION_NOTICE_EVENT, handleNotice);
  }, [showActionNotice]);
  useEffect(() => {
    setLinkMenu(null); setHtmlModal(null); setScopeFile(null);
  }, [state.currentFile, state.renderVersion]);

  const handleOpenHtmlModal = useCallback((documentHtml: string, trigger: HTMLElement) => {
    setLinkMenu(null);
    setHtmlModal({ documentHtml: prepareStandaloneHtmlPreview(documentHtml, state.currentFile), trigger });
  }, [state.currentFile]);

  const handleOpenResolvedLink = useCallback((link: ResolvedLink) => {
    setLinkMenu(null);
    if (!link.openable) { showActionNotice(t.previewActions.unableToOpenLink); return; }
    if (link.kind === "fragment") {
      const fragment = link.raw.startsWith("#") ? link.raw : new URL(link.resolved).hash;
      const documentHtml = buildRenderedDocumentSnapshot(state.contentHtml, state.relativePath || state.currentFile || "Markdown Explorer", documentBaseHref(state.currentFile), fragment);
      openHtmlPreviewInBrowser({
        bridge,
        runtime: state.appRuntime || "desktop",
        documentHtml,
        currentFile: state.currentFile,
        title: state.relativePath || state.currentFile || t.previewActions.modalTitle,
        onError: () => showActionNotice(t.previewActions.unableToOpenLink),
      });
      return;
    }
    bridge.postMessage({ command: "openExternal", url: link.resolved });
  }, [bridge, showActionNotice, state.appRuntime, state.contentHtml, state.currentFile, state.relativePath, t.previewActions.modalTitle, t.previewActions.unableToOpenLink]);

  const handleCopyResolvedLink = useCallback(async (link: ResolvedLink) => {
    if (!link.copyable) { showActionNotice(t.previewActions.copyFailed); return; }
    try {
      await bridge.copyToClipboard(link.resolved);
      setLinkMenu(null);
      showActionNotice(t.previewActions.linkCopied);
    } catch {
      showActionNotice(t.previewActions.copyFailed);
    }
  }, [bridge, showActionNotice, t.previewActions.copyFailed, t.previewActions.linkCopied]);

  const handleCopyImage = useCallback(async (target: HTMLElement | SVGElement) => {
    try {
      const ok = await copyElementImageToClipboard(target);
      setLinkMenu(null);
      showActionNotice(ok ? t.previewActions.imageCopied : t.previewActions.copyFailed);
    } catch {
      setLinkMenu(null);
      showActionNotice(t.previewActions.copyFailed);
    }
  }, [showActionNotice, t.previewActions.copyFailed, t.previewActions.imageCopied]);

  const handleSaveImage = useCallback(async (target: HTMLElement | SVGElement) => {
    try {
      const isMermaid = target.getAttribute?.('data-mdn-bookmark-kind') === 'mermaid' || Boolean(target.closest?.('.mdn-mermaid-wrap'));
      const fileName = isMermaid ? 'mermaid-diagram.png' : 'diagram.png';
      const ok = await saveElementImageAsPng(target, fileName);
      setLinkMenu(null);
      showActionNotice(ok ? (t.previewActions.imageSaved || 'Image saved.') : (t.previewActions.imageSaveFailed || 'Failed to save image.'), ok ? 'neutral' : 'error');
    } catch {
      setLinkMenu(null);
      showActionNotice(t.previewActions.imageSaveFailed || 'Failed to save image.', 'error');
    }
  }, [showActionNotice, t.previewActions.imageSaveFailed, t.previewActions.imageSaved]);

  const { bookmarkSelection, closeBookmarkSelection, handleBookmarkContextMenu, openBookmarkDialogForElement } = useBookmarkSelection({
    enabled: state.settings.bookmarksEnabled,
    currentFile: state.currentFile,
    renderVersion: state.renderVersion,
    isFullHtmlPreview,
    markdownSource: hostHtmlMarkdownSource,
    sourceDocumentText,
    bodyRef,
    closeLinkMenu: () => setLinkMenu(null),
  });

  useContentEffects({
    state, bodyRef, scrollRef, onImageClick, navigate, push, bridge,
    previewLabels: t.previewActions,
    onOpenHtmlModal: handleOpenHtmlModal,
    onOpenLinkMenu: setLinkMenu,
    onBookmarkContextMenu: handleBookmarkContextMenu,
    onActionError: showActionNotice,
  });
  const fmEntries = Object.entries(state.frontmatter);
  const renderedContentParts = splitLeadingHtmlComments(state.contentHtml || "");

  const handleOpenWorkspaceAgain = () => {
    if (!workspaceUnavailablePath) return;
    if (onOpenWorkspaceAgain) { onOpenWorkspaceAgain(workspaceUnavailablePath); return; }
    bridge.postMessage({ command: "openFolder", openFirstFile: isDesktopTabView, replaceRecentWorkspacePath: workspaceUnavailablePath });
  };
  const handleDeleteUnavailableWorkspace = () => {
    if (workspaceUnavailablePath) bridge.postMessage({ command: "deleteRecentWorkspace", path: workspaceUnavailablePath });
  };
  const scopeTarget = linkMenu?.link ? findScopeFile(linkMenu.link, state.fileList) : null;

  return (
    <>
      {state.splitView?.enabled ? (
        <SplitContent />
      ) : (
        <ContentMainView
          state={state} translations={t} scrollRef={scrollRef} bodyRef={bodyRef}
          isFullHtmlPreview={isFullHtmlPreview} workspaceUnavailablePath={workspaceUnavailablePath}
          isDesktopTabView={isDesktopTabView} isUnavailableWorkspaceInHistory={isUnavailableWorkspaceInHistory}
          suppressWelcome={suppressWelcome} hasRenderableDocumentContent={hasRenderableDocumentContent}
          isHtmlDocument={isHtmlDocument} sourceDocumentText={sourceDocumentText}
          htmlMarkdownRender={htmlMarkdownRender} htmlDocumentPreviewEnabled={htmlDocumentPreviewEnabled}
          previewTitle={previewTitle} previewWarning={previewWarning} previewMeta={previewMeta}
          frontmatterEntries={fmEntries} renderedContentParts={renderedContentParts}
          onCancelWorkspaceScan={onCancelWorkspaceScan} onOpenWorkspaceAgain={handleOpenWorkspaceAgain}
          onDeleteUnavailableWorkspace={handleDeleteUnavailableWorkspace} onUpdateSettings={updateSettings}
          onRefresh={refresh} onHtmlPolicyReport={handleHtmlPolicyReport}
          onWorkingDocumentSourceChange={setWorkingDocumentSource} onSaveDocument={saveDocument}
        />
      )}
      {htmlModal && <HtmlPreviewModal documentHtml={htmlModal.documentHtml} title={t.previewActions.modalTitle} closeLabel={t.previewActions.closeModal} trigger={htmlModal.trigger} onClose={() => setHtmlModal(null)} />}
      <ScopeViewModal initialFile={scopeFile} files={state.fileList} onMediaClick={onImageClick} onClose={() => setScopeFile(null)} />
      <BookmarkSelectionMenu state={bookmarkSelection} workspaceName={state.workspaceName} workspacePath={state.workspacePath} filePath={state.currentFile} translations={t.bookmarks} onClose={closeBookmarkSelection} />
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
      {htmlLocalFirstWarning && (
        <div className="html-local-first-warning-backdrop" role="presentation">
          <div className="html-local-first-warning" role="dialog" aria-modal="true" aria-labelledby="html-local-first-warning-title">
            <button type="button" className="html-local-first-warning__close" aria-label={t.tooltips.close} onClick={() => setHtmlLocalFirstWarning(null)}>×</button>
            <h2 id="html-local-first-warning-title">{t.htmlLocalFirstWarningTitle}</h2>
            <p>{t.htmlLocalFirstWarningBody}</p>
            <ul>
              {htmlLocalFirstWarning.blockedRemoteStyles.length > 0 && <li>{t.htmlLocalFirstBlockedRemoteStyles}: {htmlLocalFirstWarning.blockedRemoteStyles.length}</li>}
              {htmlLocalFirstWarning.blockedRemoteScripts.length > 0 && <li>{t.htmlLocalFirstBlockedRemoteScripts}: {htmlLocalFirstWarning.blockedRemoteScripts.length}</li>}
              {htmlLocalFirstWarning.allowedRemoteImages.length > 0 && <li>{t.htmlLocalFirstAllowedRemoteImages}: {htmlLocalFirstWarning.allowedRemoteImages.length}</li>}
              {htmlLocalFirstWarning.allowedRemoteFonts.length > 0 && <li>{t.htmlLocalFirstAllowedRemoteFonts}: {htmlLocalFirstWarning.allowedRemoteFonts.length}</li>}
              {htmlLocalFirstWarning.allowedRemoteMedia.length > 0 && <li>{t.htmlLocalFirstAllowedRemoteMedia}: {htmlLocalFirstWarning.allowedRemoteMedia.length}</li>}
              {htmlLocalFirstWarning.blockedNetworkApis.length > 0 && <li>{t.htmlLocalFirstBlockedNetworkApis}: {htmlLocalFirstWarning.blockedNetworkApis.join(', ')}</li>}
              {htmlLocalFirstWarning.blockedLocalReferences.length > 0 && <li>{t.htmlLocalFirstBlockedLocalReferences}: {htmlLocalFirstWarning.blockedLocalReferences.length}</li>}
              {htmlLocalFirstWarning.missingLocalReferences.length > 0 && <li>{t.htmlLocalFirstMissingLocalReferences}: {htmlLocalFirstWarning.missingLocalReferences.length}</li>}
            </ul>
            <button type="button" className="btn btn--primary" onClick={() => setHtmlLocalFirstWarning(null)}>{t.htmlLocalFirstWarningOk}</button>
          </div>
        </div>
      )}
      {showHtmlPreviewExperienceBanner && <div className="html-preview-experience-banner" role="status">{t.htmlPreviewExperienceNotice}</div>}
      {actionNotice && <div className={`mdn-action-notice mdn-action-notice--${actionNotice.tone}`} role={actionNotice.tone === 'error' ? 'alert' : 'status'}>{actionNotice.message}</div>}
    </>
  );
});