// =============================================================================
// components/Content/Content.tsx — Main content area (rendered HTML + effects)
// =============================================================================

import { useRef, memo, lazy, Suspense } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { useNavigation } from "../../contexts/NavigationContext";
import { usePlatform } from "../../contexts/PlatformContext";
import { getTranslations } from "../../contexts/translations";
import { WelcomePage } from "./WelcomePage";
import { AlertTriangleIcon, FileNotFoundIcon, FolderIcon, TrashIcon } from "../shared/icons";
import { useContentEffects } from "./useContentEffects";
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
}

export function Content({
  onImageClick,
  scrollRef,
  suppressWelcome = false,
}: ContentProps) {
  const { state, navigate, refresh, updateSettings } = useAppState();
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

  useContentEffects({
    state,
    bodyRef,
    scrollRef,
    onImageClick,
    navigate,
    push,
    bridge,
  });
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
            className="state-screen state-screen--loading"
            id="loadingScreen"
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
          state.contentHtml && (
            <div
              className="mdn-body"
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
              {state.toc.length > 0 && !state.tocCollapsed && (
                <Suspense fallback={null}>
                  <TableOfContents variant="compact" />
                </Suspense>
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
              <HtmlContent html={state.contentHtml} />
            </div>
          )}
      </div>
    </main>
  );
}



