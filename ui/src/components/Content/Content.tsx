// =============================================================================
// components/Content/Content.tsx — Main content area (rendered HTML + effects)
// =============================================================================

import { useRef, useState, useCallback, useEffect, useMemo, memo, lazy, Suspense } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { useNavigation } from "../../contexts/NavigationContext";
import { usePlatform } from "../../contexts/PlatformContext";
import { getTranslations } from "../../contexts/translations";
import { WelcomePage } from "./WelcomePage";
import { AlertTriangleIcon, FileNotFoundIcon, FolderIcon, TrashIcon } from "../shared/icons";
import { useContentEffects } from "./useContentEffects";
import { HtmlPreviewModal } from "../Modal/HtmlPreviewModal";
import {
  LinkContextMenu,
  type LinkContextMenuState,
} from "../shared/LinkContextMenu";
import {
  documentBaseHref,
  injectBaseHref,
  openHtmlPreviewInBrowser,
  prepareStandaloneHtmlPreview,
} from "../../dom/htmlPreviewActions";
import type { ResolvedLink } from "../../dom/linkContextMenu";
import { splitLeadingHtmlComments } from "./contentUtils";
import { HtmlDocumentView, isHtmlDocumentPath } from "./HtmlDocumentView";
import { convertHtmlSourceToMarkdown } from "../../markdown/htmlToMarkdown";
import { renderMarkdownClientSide } from "../../contexts/contentTabState";
import { hasHtmlLocalFirstPolicyNotice, type HtmlLocalFirstPolicyReport } from "../../markdown/htmlLocalFirstPreview";
// Highlighting deliberately skips language-(txt|text|plain|plaintext) blocks.

export { isWorkspaceNavigationHref } from "./contentUtils";

const TableOfContents = lazy(() =>
  import("../TOC/TableOfContents").then((m) => ({ default: m.TableOfContents }))
);

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

function buildRenderedDocumentSnapshot(
  contentHtml: string,
  title: string,
  baseHref: string | null,
  fragment: string,
): string {
  const safeTitle = title.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
  const hash = fragment.startsWith('#') ? fragment : '';
  const scriptHash = JSON.stringify(hash)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const snapshot = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>html{scroll-behavior:smooth}body{max-width:960px;margin:0 auto;padding:32px;font:16px/1.6 system-ui,sans-serif;color:#202124;background:#fff}img,video,svg{max-width:100%;height:auto}pre{overflow:auto;padding:16px;border-radius:8px;background:#f5f5f5}table{border-collapse:collapse;max-width:100%}th,td{border:1px solid #d7d7d7;padding:6px 10px}@media(prefers-color-scheme:dark){body{color:#eceff4;background:#181a1f}pre{background:#24272e}th,td{border-color:#4b505c}}</style></head><body>${contentHtml}<script>window.addEventListener('load',function(){var hash=${scriptHash};if(hash){location.hash=hash;var target=document.getElementById(decodeURIComponent(hash.slice(1)));if(target)target.scrollIntoView({block:'center'});}});<\/script></body></html>`;
  return injectBaseHref(snapshot, baseHref);
}

export function formatPreviewDuration(durationMs: number | undefined): string {
  if (!Number.isFinite(durationMs) || !durationMs) return "";
  if (durationMs < 1000) return `${Math.max(1, Math.round(durationMs))} ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}

const DEFAULT_CONVERSION_WARNING =
  "This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file.";
const DEFAULT_CONVERSION_FAILURE_WARNING =
  "Markdown Explorer could not convert this file. The details are shown below.";

export function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

interface ContentProps {
  onImageClick: (el: HTMLElement) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  suppressWelcome?: boolean;
  onCancelWorkspaceScan?: () => void;
  onOpenWorkspaceAgain?: (oldPath: string) => void;
}

export function Content({
  onImageClick,
  scrollRef,
  suppressWelcome = false,
  onCancelWorkspaceScan,
  onOpenWorkspaceAgain,
}: ContentProps) {
  const { state, navigate, refresh, updateSettings } = useAppState();
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);
  const { push } = useNavigation();
  const bridge = usePlatform();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [htmlModal, setHtmlModal] = useState<{ documentHtml: string; trigger: HTMLElement } | null>(null);
  const [linkMenu, setLinkMenu] = useState<LinkContextMenuState | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const actionNoticeTimerRef = useRef<number | null>(null);
  const workspaceUnavailablePath = state.workspaceUnavailablePath;
  const activeContentTab = state.contentTabs.find((tab) => tab.filePath === state.activeContentTabPath);
  const sourceDocumentText = activeContentTab?.sourceDocumentText ?? state.sourceDocumentText;
  const htmlPreviewOverride = activeContentTab?.htmlPreviewOverride ?? state.currentHtmlPreviewOverride;
  const isHtmlDocument = isHtmlDocumentPath(state.currentFile) && sourceDocumentText !== null;
  const htmlDocumentPreviewEnabled = htmlPreviewOverride ?? state.settings.defaultHtmlPreview;
  const isFullHtmlPreview = isHtmlDocument && htmlDocumentPreviewEnabled;
  const htmlMarkdownRender = useMemo(() => {
    if (!isHtmlDocument || sourceDocumentText === null) return { html: '', error: null as string | null };
    try {
      const markdown = convertHtmlSourceToMarkdown(sourceDocumentText);
      return {
        html: renderMarkdownClientSide(markdown, state.currentFile, false, state.settings).html,
        error: null as string | null,
      };
    } catch {
      return { html: '', error: t.htmlDocumentPreviewError };
    }
  }, [isHtmlDocument, sourceDocumentText, state.currentFile, state.settings, t.htmlDocumentPreviewError]);
  const [htmlLocalFirstWarning, setHtmlLocalFirstWarning] = useState<HtmlLocalFirstPolicyReport | null>(null);
  const [showHtmlPreviewExperienceBanner, setShowHtmlPreviewExperienceBanner] = useState(false);
  const htmlPreviewExperienceKeyRef = useRef<string | null>(null);
  const htmlPreviewWarningSeenRef = useRef<Set<string>>(new Set());
  const warningSessionKey = state.currentFile
    ? `${state.currentFile}::${state.renderVersion}`
    : '';
  const handleHtmlPolicyReport = useCallback((report: HtmlLocalFirstPolicyReport) => {
    if (!warningSessionKey || !hasHtmlLocalFirstPolicyNotice(report)) return;
    if (htmlPreviewWarningSeenRef.current.has(warningSessionKey)) return;
    htmlPreviewWarningSeenRef.current.add(warningSessionKey);
    setHtmlLocalFirstWarning(report);
  }, [warningSessionKey]);
  useEffect(() => {
    const openHtmlPaths = new Set(
      state.contentTabs
        .filter((tab) => isHtmlDocumentPath(tab.filePath))
        .map((tab) => tab.filePath),
    );
    for (const sessionKey of htmlPreviewWarningSeenRef.current) {
      const separatorIndex = sessionKey.lastIndexOf('::');
      const filePath = separatorIndex >= 0 ? sessionKey.slice(0, separatorIndex) : sessionKey;
      if (!openHtmlPaths.has(filePath) && filePath !== state.currentFile) {
        htmlPreviewWarningSeenRef.current.delete(sessionKey);
      }
    }
  }, [state.contentTabs, state.currentFile]);
  useEffect(() => {
    setHtmlLocalFirstWarning(null);
  }, [warningSessionKey]);

  useEffect(() => {
    const experienceKey = isFullHtmlPreview && state.currentFile ? state.currentFile : null;
    if (!experienceKey) {
      htmlPreviewExperienceKeyRef.current = null;
      setShowHtmlPreviewExperienceBanner(false);
      return;
    }
    if (htmlPreviewExperienceKeyRef.current === experienceKey) return;
    htmlPreviewExperienceKeyRef.current = experienceKey;
    setShowHtmlPreviewExperienceBanner(true);
    const timer = window.setTimeout(() => setShowHtmlPreviewExperienceBanner(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [isFullHtmlPreview, state.currentFile]);
  const hasRenderableDocumentContent = Boolean(state.contentHtml) || isHtmlDocument;
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

  const showActionNotice = useCallback((message: string) => {
    setActionNotice(message);
    if (actionNoticeTimerRef.current !== null) window.clearTimeout(actionNoticeTimerRef.current);
    actionNoticeTimerRef.current = window.setTimeout(() => setActionNotice(null), 2600);
  }, []);

  useEffect(() => () => {
    if (actionNoticeTimerRef.current !== null) window.clearTimeout(actionNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    const handleNotice = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (message) showActionNotice(message);
    };
    window.addEventListener('markdown-explorer-action-notice', handleNotice);
    return () => window.removeEventListener('markdown-explorer-action-notice', handleNotice);
  }, [showActionNotice]);

  useEffect(() => {
    setLinkMenu(null);
    setHtmlModal(null);
  }, [state.currentFile, state.renderVersion]);

  const handleOpenHtmlModal = useCallback((documentHtml: string, trigger: HTMLElement) => {
    setLinkMenu(null);
    setHtmlModal({
      documentHtml: prepareStandaloneHtmlPreview(documentHtml, state.currentFile),
      trigger,
    });
  }, [state.currentFile]);

  const handleOpenResolvedLink = useCallback((link: ResolvedLink) => {
    setLinkMenu(null);
    if (!link.openable) {
      showActionNotice(t.previewActions.unableToOpenLink);
      return;
    }
    if (link.kind === "fragment") {
      const fragment = link.raw.startsWith("#") ? link.raw : new URL(link.resolved).hash;
      const documentHtml = buildRenderedDocumentSnapshot(
        state.contentHtml,
        state.relativePath || state.currentFile || "Markdown Explorer",
        documentBaseHref(state.currentFile),
        fragment,
      );
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
  }, [bridge, showActionNotice, state.appRuntime, state.contentHtml, state.currentFile, state.relativePath, t.previewActions.unableToOpenLink]);

  const handleCopyResolvedLink = useCallback(async (link: ResolvedLink) => {
    if (!link.copyable) {
      showActionNotice(t.previewActions.copyFailed);
      return;
    }
    try {
      await bridge.copyToClipboard(link.resolved);
      setLinkMenu(null);
      showActionNotice(t.previewActions.linkCopied);
    } catch {
      showActionNotice(t.previewActions.copyFailed);
    }
  }, [bridge, showActionNotice, t.previewActions.copyFailed, t.previewActions.linkCopied]);

  useContentEffects({
    state,
    bodyRef,
    scrollRef,
    onImageClick,
    navigate,
    push,
    bridge,
    previewLabels: t.previewActions,
    onOpenHtmlModal: handleOpenHtmlModal,
    onOpenLinkMenu: setLinkMenu,
    onActionError: showActionNotice,
  });
  // Frontmatter header
  const fmEntries = Object.entries(state.frontmatter);
  const renderedContentParts = splitLeadingHtmlComments(state.contentHtml || "");

  const handleOpenWorkspaceAgain = () => {
    if (!workspaceUnavailablePath) return;
    if (onOpenWorkspaceAgain) {
      onOpenWorkspaceAgain(workspaceUnavailablePath);
      return;
    }
    bridge.postMessage({
      command: "openFolder",
      openFirstFile: isDesktopTabView,
      replaceRecentWorkspacePath: workspaceUnavailablePath,
    });
  };

  const handleDeleteUnavailableWorkspace = () => {
    if (!workspaceUnavailablePath) return;
    bridge.postMessage({ command: "deleteRecentWorkspace", path: workspaceUnavailablePath });
  };

  return (
    <>
      <main className="content" id="mainContent">
        <div className={`content__scroll${isFullHtmlPreview ? " content__scroll--html-preview" : ""}`} id="contentScroll" ref={scrollRef}>
        {/* Loading */}
        {state.isLoading && (
          <div
            className="state-screen state-screen--loading"
            id="loadingScreen"
          >
            <div className="spinner" />
            <div className="state-screen__title">{state.loadingLabel || "Loading docs..."}</div>
            {state.loadingDetail && (
              <div className="state-screen__sub">{state.loadingDetail}</div>
            )}
            {onCancelWorkspaceScan && (
              <button
                type="button"
                className="btn state-screen__cancel"
                onClick={onCancelWorkspaceScan}
              >
                {t.tooltips.cancelScan}
              </button>
            )}
          </div>
        )}

        {/* Workspace unavailable */}
        {!state.isLoading && workspaceUnavailablePath && (
          <div className="state-screen state-screen--workspace-unavailable">
            <div className="state-screen__icon state-screen__icon--warning">
              <AlertTriangleIcon size={34} />
            </div>
            <div className="state-screen__title">{t.workspaceUnavailable.title}</div>
            <div className="state-screen__sub">
              {t.workspaceUnavailable.description}
            </div>
            <div className="state-screen__path">{workspaceUnavailablePath}</div>
            {isDesktopTabView && (
              <div className="state-screen__hint">
                {t.workspaceUnavailable.tabHint}
              </div>
            )}
            <div className="state-screen__actions">
              <button
                type="button"
                className="state-screen__button state-screen__button--primary"
                onClick={handleOpenWorkspaceAgain}
              >
                <FolderIcon size={14} />
                <span>{t.workspaceUnavailable.openAgain}</span>
              </button>
              <button
                type="button"
                className="state-screen__button state-screen__button--danger"
                onClick={handleDeleteUnavailableWorkspace}
                disabled={!isUnavailableWorkspaceInHistory}
              >
                <TrashIcon size={14} />
                <span>
                  {isUnavailableWorkspaceInHistory
                    ? t.workspaceUnavailable.deleteHistory
                    : t.workspaceUnavailable.removedHistory}
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
              className="state-screen__sub state-screen__sub--path"
            >
              {state.notFoundHref}
            </div>
          </div>
        )}

        {/* Empty workspace */}
        {!state.isLoading &&
          !state.isWorkspaceScanning &&
          !state.notFoundHref &&
          !workspaceUnavailablePath &&
          state.fileList.length === 0 &&
          !state.contentHtml && (
            <div className="state-screen">
              <div className="state-screen__icon">
                <FileNotFoundIcon />
              </div>
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
          hasRenderableDocumentContent && (
            <div
              className={`mdn-body${isFullHtmlPreview ? " mdn-body--html-preview" : ""}`}
              id="mdBody"
              ref={bodyRef}
              aria-live="polite"
            >
              {state.staleContentFilePath === state.currentFile && (
                <div className="document-preview-notice current-file-change-notice" role="status">
                  <AlertTriangleIcon size={16} />
                  <div className="document-preview-notice__body current-file-change-notice__body">
                    <span>{previewCopy.currentFileChangedOnDisk}</span>
                    <button
                      type="button"
                      className="btn current-file-change-notice__button"
                      onClick={refresh}
                    >
                      {previewCopy.refreshCurrentFile}
                    </button>
                    <span>{previewCopy.currentFileChangedSuffix}</span>
                  </div>
                </div>
              )}
              {isHtmlDocument && sourceDocumentText !== null ? (
                <HtmlDocumentView
                  filePath={state.currentFile}
                  htmlSource={sourceDocumentText}
                  markdownHtml={htmlMarkdownRender.html}
                  previewEnabled={htmlDocumentPreviewEnabled}
                  title={state.relativePath || state.currentFile}
                  conversionError={htmlMarkdownRender.error}
                  onPolicyReport={handleHtmlPolicyReport}
                />
              ) : (
                <>
                  {previewInfo && (
                    <div
                      className={`document-preview-notice document-preview-notice--${previewInfo.kind}`}
                      role="note"
                    >
                      <AlertTriangleIcon size={16} />
                      <div className="document-preview-notice__body">
                        <div className="document-preview-notice__title">{previewTitle}</div>
                        <div className="document-preview-notice__text">{previewWarning}</div>
                        {previewMeta && <div className="document-preview-notice__meta">{previewMeta}</div>}
                      </div>
                    </div>
                  )}
                  {state.toc.length > 0 && !state.tocCollapsed && (
                    <Suspense fallback={null}>
                      <TableOfContents variant="compact" />
                    </Suspense>
                  )}
                  {renderedContentParts.leadingCommentsHtml && (
                    <HtmlContent html={renderedContentParts.leadingCommentsHtml} />
                  )}
                  {fmEntries.length > 0 && (
                    <details className="mdn-frontmatter" open aria-label="Document properties">
                      <summary className="mdn-frontmatter-summary">
                        <span>Properties</span>
                        <span className="mdn-frontmatter-count">
                          {fmEntries.length} {fmEntries.length === 1 ? "property" : "properties"}
                        </span>
                      </summary>
                      <div className="mdn-frontmatter-grid">
                        {fmEntries.map(([key, value]) => (
                          <div className="mdn-frontmatter-field" key={key}>
                            <span className="mdn-frontmatter-key">{key}</span>
                            <span className={`mdn-frontmatter-value${value ? "" : " is-empty"}`}>
                              {value || "\u00a0"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  <HtmlContent html={renderedContentParts.bodyHtml} />
                </>
              )}
            </div>
          )}
        </div>
      </main>
      {htmlModal && (
        <HtmlPreviewModal
          documentHtml={htmlModal.documentHtml}
          title={t.previewActions.modalTitle}
          closeLabel={t.previewActions.closeModal}
          trigger={htmlModal.trigger}
          onClose={() => setHtmlModal(null)}
        />
      )}
      {linkMenu && (
        <LinkContextMenu
          state={linkMenu}
          menuLabel={t.previewActions.linkMenu}
          openLabel={t.previewActions.openInBrowser}
          copyLabel={t.previewActions.copyLink}
          onOpen={handleOpenResolvedLink}
          onCopy={handleCopyResolvedLink}
          onClose={() => setLinkMenu(null)}
        />
      )}
      {htmlLocalFirstWarning && (
        <div className="html-local-first-warning-backdrop" role="presentation">
          <div className="html-local-first-warning" role="dialog" aria-modal="true" aria-labelledby="html-local-first-warning-title">
            <button
              type="button"
              className="html-local-first-warning__close"
              aria-label={t.tooltips.close}
              onClick={() => setHtmlLocalFirstWarning(null)}
            >×</button>
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
            <button type="button" className="btn btn--primary" onClick={() => setHtmlLocalFirstWarning(null)}>
              {t.htmlLocalFirstWarningOk}
            </button>
          </div>
        </div>
      )}
      {showHtmlPreviewExperienceBanner && (
        <div className="html-preview-experience-banner" role="status">
          {t.htmlPreviewExperienceNotice}
        </div>
      )}
      {actionNotice && <div className="mdn-action-notice" role="status">{actionNotice}</div>}
    </>
  );
}
