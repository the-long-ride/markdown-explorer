import { useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { getTranslations } from '../../contexts/translations';
import { scopeDocumentIds } from '../../document/scopeDocumentIds';
import { useDocumentRootRegistration } from '../../document/useDocumentRootRegistration';
import type { PaneDocumentProjection } from '../../split-view/paneSelectors';
import type { DocumentViewMode, PaneId } from '../../split-view/paneState';
import { DocumentBody, frontmatterEntriesOf } from './DocumentBody';
import { useDocumentEnvironment, type DocumentEnvironment } from './DocumentEnvironmentContext';
import { buildPreviewNotice } from './documentPreviewNotice';
import { isHtmlDocumentPath } from './HtmlDocumentView';
import { useDocumentInteractions } from './useDocumentInteractions';
import { useDocumentOverlays } from './useDocumentOverlays';
import { useDocumentEditingSurface } from './useDocumentEditingSurface';

export interface SplitPaneDocumentProps {
  paneId: PaneId;
  projection: PaneDocumentProjection;
  mode: DocumentViewMode;
  renderVersion: number;
  disabled: boolean;
  language: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  onSourceChange: (source: string) => void;
  onSave: () => void | Promise<unknown>;
  onModeChange?: (mode: DocumentViewMode) => void;
}

interface PaneInteractionsProps {
  env: DocumentEnvironment;
  paneId: PaneId;
  projection: PaneDocumentProjection;
  renderVersion: number;
  isFullHtmlPreview: boolean;
  bodyRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
}

// Wires the shared document interactions and overlays for one pane. Rendered
// only when the app environment is available so hooks stay unconditional.
function PaneInteractions({ env, paneId, projection, renderVersion, isFullHtmlPreview, bodyRef, scrollRef }: PaneInteractionsProps): ReactNode {
  const t = getTranslations(env.state.settings.language || 'en');
  const overlays = useDocumentOverlays({
    state: env.state,
    bridge: env.bridge,
    bodyRef,
    onImageClick: env.onImageClick,
    document: {
      filePath: projection.filePath,
      relativePath: projection.relativePath,
      contentHtml: projection.contentHtml,
      renderVersion,
      markdownSource: projection.markdownSource,
      sourceDocumentText: projection.sourceDocumentText,
      isFullHtmlPreview,
    },
  });
  useDocumentInteractions({
    state: env.state,
    document: { rootId: paneId, filePath: projection.filePath, renderVersion, disabled: false },
    bodyRef,
    scrollRef,
    bridge: env.bridge,
    previewLabels: t.previewActions,
    onImageClick: env.onImageClick,
    navigate: env.navigate,
    onOpenHtmlModal: overlays.onOpenHtmlModal,
    onOpenLinkMenu: overlays.onOpenLinkMenu,
    onBookmarkContextMenu: overlays.onBookmarkContextMenu,
    onActionError: overlays.onActionError,
  });
  // Pane scroll areas use `contain: layout paint`, which would trap fixed-position
  // modals inside the pane. Render them at the window level like the main view.
  return createPortal(overlays.overlays, document.body);
}

export function SplitPaneDocument({
  paneId,
  projection,
  mode,
  renderVersion,
  disabled,
  language,
  scrollRef,
  onSourceChange,
  onSave,
  onModeChange,
}: SplitPaneDocumentProps): ReactNode {
  const env = useDocumentEnvironment();
  const bodyRef = useRef<HTMLDivElement>(null);
  const t = getTranslations(language);
  const settings = env?.state.settings;
  const isHtmlDocument = isHtmlDocumentPath(projection.filePath) && projection.sourceDocumentText !== null;
  const htmlPreviewEnabled = projection.htmlPreviewOverride ?? settings?.defaultHtmlPreview ?? false;
  const contentHtml = useMemo(() => scopeDocumentIds(projection.contentHtml, paneId), [paneId, projection.contentHtml]);
  const editing = useDocumentEditingSurface({
    filePath: projection.filePath,
    mode,
    source: projection.source,
    hasSession: true,
    bodyRef,
    renderVersion,
    language,
    saving: disabled,
    onSourceChange,
    onSave,
    onPreview: () => onModeChange?.('rendered'),
  });

  const isFullHtmlPreview = isHtmlDocument && htmlPreviewEnabled && mode !== 'plain';
  // A full HTML preview fills the whole pane, like the main reader viewport.
  // The body's parent is the pane scroll area; its ref is not attached yet when
  // this child layout effect first runs, so resolve it from the DOM instead.
  useLayoutEffect(() => {
    const scroll = bodyRef.current?.parentElement;
    scroll?.classList.toggle('split-document-pane__scroll--html-preview', isFullHtmlPreview);
    return () => scroll?.classList.remove('split-document-pane__scroll--html-preview');
  }, [isFullHtmlPreview]);

  useDocumentRootRegistration({
    id: paneId,
    bodyRef,
    scrollRef,
    filePath: projection.filePath,
    markdownSource: projection.source || projection.markdownSource,
    renderVersion,
  });

  return (
    <>
      <div
        ref={bodyRef}
        className={`mdn-body document-surface${isFullHtmlPreview ? ' mdn-body--html-preview' : ''}`}
        data-testid="document-surface"
        data-document-root={paneId}
        data-file-path={projection.filePath}
        data-stale={projection.stale || undefined}
        data-mdn-source-document-path={projection.relativePath || undefined}
        aria-live="polite"
      >
        <DocumentBody
          rootId={paneId}
          filePath={projection.filePath}
          relativePath={projection.relativePath}
          language={language}
          translations={t}
          contentHtml={contentHtml}
          frontmatterEntries={frontmatterEntriesOf(projection.frontmatter)}
          toc={projection.toc}
          tocCollapsed={env?.state.tocCollapsed ?? true}
          stale={projection.stale}
          previewNotice={buildPreviewNotice(projection.previewInfo, t)}
          html={{ isHtmlDocument, sourceText: projection.sourceDocumentText, markdownHtml: projection.contentHtml, previewEnabled: htmlPreviewEnabled, allowUpstreamResources: settings?.allowUpstreamHtmlPreview ?? false, error: null }}
          onRefresh={() => env?.refresh()}
          {...editing.bodyProps}
        />
      </div>
      {env && (
        <PaneInteractions
          env={env}
          paneId={paneId}
          projection={projection}
          renderVersion={renderVersion}
          isFullHtmlPreview={isFullHtmlPreview}
          bodyRef={bodyRef}
          scrollRef={scrollRef}
        />
      )}
      {editing.inlineEditor}
    </>
  );
}
