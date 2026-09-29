import { memo, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { useNavigation } from "../../contexts/NavigationContext";
import { usePlatform } from "../../contexts/PlatformContext";
import { getTranslations } from "../../contexts/translations";
import { useContentEffects } from "./useContentEffects";
import { useDocumentOverlays } from "./useDocumentOverlays";
import { buildPreviewNotice } from "./documentPreviewNotice";
import { isHtmlDocumentPath } from "./HtmlDocumentView";
import { convertHtmlSourceToMarkdown } from "../../markdown/htmlToMarkdown";
import { renderMarkdownClientSide } from "../../contexts/contentTabState";
import { documentSessionKey } from "../../editor/documentSession";
import { hasHtmlLocalFirstPolicyNotice, type HtmlLocalFirstPolicyReport } from "../../markdown/htmlLocalFirstPreview";
import { ContentMainView } from "./ContentMainView";
import { SplitContent } from "./SplitContent";
import { ACTION_NOTICE_EVENT, normalizeActionNoticeDetail, type ActionNoticeDetail, type ActionNoticeTone } from "../../utils/actionNotice.ts";

export { isWorkspaceNavigationHref } from "./contentUtils";

export { formatPreviewDuration, formatTemplate } from "./documentPreviewNotice";


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
    setDocumentEditMode,
    saveDocument,
  } = useAppState();
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);
  const { push } = useNavigation();
  const bridge = usePlatform();
  const bodyRef = useRef<HTMLDivElement>(null);
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
  const [allowUpstreamHtmlPreviewOnce, setAllowUpstreamHtmlPreviewOnce] = useState(false);
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

  const allowUpstreamHtmlPreview = state.settings.allowUpstreamHtmlPreview || allowUpstreamHtmlPreviewOnce;
  useEffect(() => {
    setHtmlLocalFirstWarning(null);
    setAllowUpstreamHtmlPreviewOnce(false);
    if (state.currentFile) htmlPreviewWarningSeenRef.current.delete(state.currentFile);
  }, [state.currentFile, state.renderVersion]);
  useEffect(() => {
    if (!isFullHtmlPreview || !state.currentFile) { setShowHtmlPreviewExperienceBanner(false); return; }
    if (htmlPreviewExperienceNoticeSeenRef.current) return;
    htmlPreviewExperienceNoticeSeenRef.current = true;
    setShowHtmlPreviewExperienceBanner(true);
    const timer = window.setTimeout(() => setShowHtmlPreviewExperienceBanner(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [isFullHtmlPreview, state.currentFile]);

  const hasRenderableDocumentContent = Boolean(state.contentHtml) || isHtmlDocument || Boolean(currentDocumentSession);
  const previewNotice = buildPreviewNotice(state.previewInfo, t);
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

  const documentOverlays = useDocumentOverlays({
    state, bridge, bodyRef, onImageClick,
    document: {
      filePath: state.currentFile, relativePath: state.relativePath, contentHtml: state.contentHtml,
      renderVersion: state.renderVersion, markdownSource: hostHtmlMarkdownSource, sourceDocumentText, isFullHtmlPreview,
    },
  });

  useContentEffects({
    state, bodyRef, scrollRef, onImageClick, navigate, push, bridge,
    previewLabels: t.previewActions,
    onOpenHtmlModal: documentOverlays.onOpenHtmlModal,
    onOpenLinkMenu: documentOverlays.onOpenLinkMenu,
    onBookmarkContextMenu: documentOverlays.onBookmarkContextMenu,
    onActionError: documentOverlays.onActionError,
  });
  const fmEntries = Object.entries(state.frontmatter);

  const handleOpenWorkspaceAgain = () => {
    if (!workspaceUnavailablePath) return;
    if (onOpenWorkspaceAgain) { onOpenWorkspaceAgain(workspaceUnavailablePath); return; }
    bridge.postMessage({ command: "openFolder", openFirstFile: isDesktopTabView, replaceRecentWorkspacePath: workspaceUnavailablePath });
  };
  const handleDeleteUnavailableWorkspace = () => {
    if (workspaceUnavailablePath) bridge.postMessage({ command: "deleteRecentWorkspace", path: workspaceUnavailablePath });
  };

  return (
    <>
      {state.splitView?.enabled ? (
        <SplitContent onImageClick={onImageClick} />
      ) : (
        <ContentMainView
          state={state} translations={t} scrollRef={scrollRef} bodyRef={bodyRef}
          isFullHtmlPreview={isFullHtmlPreview} workspaceUnavailablePath={workspaceUnavailablePath}
          isDesktopTabView={isDesktopTabView} isUnavailableWorkspaceInHistory={isUnavailableWorkspaceInHistory}
          suppressWelcome={suppressWelcome} hasRenderableDocumentContent={hasRenderableDocumentContent}
          isHtmlDocument={isHtmlDocument} sourceDocumentText={sourceDocumentText}
          htmlMarkdownRender={htmlMarkdownRender} htmlDocumentPreviewEnabled={htmlDocumentPreviewEnabled}
          allowUpstreamHtmlPreview={allowUpstreamHtmlPreview}
          previewNotice={previewNotice} frontmatterEntries={fmEntries}
          onCancelWorkspaceScan={onCancelWorkspaceScan} onOpenWorkspaceAgain={handleOpenWorkspaceAgain}
          onDeleteUnavailableWorkspace={handleDeleteUnavailableWorkspace} onUpdateSettings={updateSettings}
          onRefresh={refresh} onHtmlPolicyReport={handleHtmlPolicyReport}
          onWorkingDocumentSourceChange={setWorkingDocumentSource} onSaveDocument={saveDocument}
          onDocumentModeChange={setDocumentEditMode}
        />
      )}
      {!state.splitView?.enabled && documentOverlays.overlays}
      {htmlLocalFirstWarning && !allowUpstreamHtmlPreview && (
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
            <div className="html-local-first-warning__actions">
              <button type="button" className="btn" onClick={() => setHtmlLocalFirstWarning(null)}>{t.htmlLocalFirstWarningOk}</button>
              <button type="button" className="btn btn--primary" onClick={() => { setHtmlLocalFirstWarning(null); setAllowUpstreamHtmlPreviewOnce(true); }}>{t.htmlLocalFirstLoadUpstreamOnce}</button>
            </div>
          </div>
        </div>
      )}
      {showHtmlPreviewExperienceBanner && <div className="html-preview-experience-banner" role="status">{t.htmlPreviewExperienceNotice}</div>}
      {actionNotice && <div className={`mdn-action-notice mdn-action-notice--${actionNotice.tone}`} role={actionNotice.tone === 'error' ? 'alert' : 'status'}>{actionNotice.message}</div>}
    </>
  );
});
