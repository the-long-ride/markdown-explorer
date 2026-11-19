// =============================================================================
// website-app/src/features/FeatureStageRouter.tsx
// Routes all 11 FeatureDemoSlug stages to real UI modules.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Content } from '../../../ui/src/components/Content/Content';
import { HtmlDocumentView } from '../../../ui/src/components/Content/HtmlDocumentView';
import { HtmlPreviewModal } from '../../../ui/src/components/Modal/HtmlPreviewModal';
import { MediaModal } from '../../../ui/src/components/Modal/MediaModal';
import { createMediaGallery, type MediaGallery } from '../../../ui/src/components/Modal/mediaGallery';
import { useAppState } from '../../../ui/src/contexts/AppStateContext';
import { AuthoringStage } from './AuthoringStage';
import { InsightsAndDiffStage } from './InsightsAndDiffStage';
import { SearchExportStage } from './SearchExportStage';
import { ThemesAndSettingsStage } from './ThemesAndSettingsStage';
import { WorkspaceAndNavStage } from './WorkspaceAndNavStage';
import { getFeatureDemoItem, type FeatureDemoSlug } from './demoCatalog';
import { DEMO_HTML_PREVIEW } from './demoMarkdownFixtures';

export interface FeatureStageRouterProps {
  readonly slug: FeatureDemoSlug;
  readonly onSelectDoc?: (path: string) => void;
}

const DOC_SWITCHER_ITEMS = [
  { path: 'docs/architecture-overview.md', label: 'Architecture' },
  { path: 'docs/metrics-benchmarks.md', label: 'Metrics & Charts' },
  { path: 'docs/math-latex.md', label: 'Math & LaTeX' },
  { path: 'docs/design-system-themes.md', label: 'Design System' },
] as const;

export function FeatureStageRouter({ slug, onSelectDoc }: FeatureStageRouterProps) {
  const { state, dispatch, navigate } = useAppState();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const htmlModalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [mediaGallery, setMediaGallery] = useState<MediaGallery | null>(null);
  const [showHtmlSandbox, setShowHtmlSandbox] = useState(false);
  const [htmlModalOpen, setHtmlModalOpen] = useState(false);

  const activeDocPath = state.currentFile ?? getFeatureDemoItem(slug).defaultDocPath;

  const openDocument = useCallback(
    (path: string) => {
      setShowHtmlSandbox(false);
      navigate(path);
      onSelectDoc?.(path);
    },
    [navigate, onSelectDoc],
  );

  const handleImageClick = useCallback((el: HTMLElement) => {
    const root = el.closest<HTMLElement>('[data-document-root]') ?? document;
    const gallery = createMediaGallery(el, root);
    if (gallery) setMediaGallery(gallery);
  }, []);

  useEffect(() => {
    if (slug !== 'workspace') {
      setShowHtmlSandbox(false);
      setHtmlModalOpen(false);
    }
    if (slug !== 'split-view' && state.splitView.enabled) {
      dispatch({ type: 'CLOSE_SPLIT_VIEW' });
    }
  }, [dispatch, slug, state.splitView.enabled]);

  useEffect(() => {
    if (slug === 'tables-charts' && state.currentFile !== 'docs/metrics-benchmarks.md') {
      navigate('docs/metrics-benchmarks.md');
    }
  }, [navigate, slug, state.currentFile]);

  if (slug === 'workspace-home') {
    return (
      <WorkspaceAndNavStage
        mode="workspace-home"
        activeDocPath={activeDocPath}
        onSelectDoc={openDocument}
      />
    );
  }

  if (slug === 'sidebar-toc') {
    return (
      <WorkspaceAndNavStage
        mode="sidebar-toc"
        activeDocPath={activeDocPath}
        onSelectDoc={openDocument}
      />
    );
  }

  if (slug === 'live-editor') {
    return (
      <AuthoringStage
        mode="live-editor"
        activeDocPath={activeDocPath}
        onSelectDoc={openDocument}
      />
    );
  }

  if (slug === 'split-view') {
    return (
      <AuthoringStage
        mode="split-view"
        activeDocPath={activeDocPath}
        onSelectDoc={openDocument}
      />
    );
  }

  if (slug === 'insights') {
    return <InsightsAndDiffStage mode="insights" onSelectDoc={openDocument} />;
  }

  if (slug === 'git-diff') {
    return <InsightsAndDiffStage mode="git-diff" onSelectDoc={openDocument} />;
  }

  if (slug === 'search-bookmarks') {
    return <SearchExportStage mode="search-bookmarks" onSelectDoc={openDocument} />;
  }

  if (slug === 'export-center') {
    return <SearchExportStage mode="export-center" onSelectDoc={openDocument} />;
  }

  if (slug === 'themes-tabs') {
    return (
      <ThemesAndSettingsStage activeDocPath={activeDocPath} onSelectDoc={openDocument} />
    );
  }

  if (slug === 'tables-charts') {
    return (
      <div className="demo-content-stage" data-testid="demo-stage-tables-charts">
        <div className="demo-stage-bar demo-stage-bar--wrap">
          <div className="demo-doc-pills" role="group" aria-label="Demo documents">
            {DOC_SWITCHER_ITEMS.map((doc) => {
              const isActive = activeDocPath === doc.path;
              return (
                <button
                  key={doc.path}
                  type="button"
                  className={`demo-pill-btn${isActive ? ' is-active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => openDocument(doc.path)}
                >
                  {doc.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="demo-stage-content-host">
          <Content onImageClick={handleImageClick} scrollRef={scrollRef} suppressWelcome={true} />
        </div>
        <MediaModal gallery={mediaGallery} onClose={() => setMediaGallery(null)} />
      </div>
    );
  }

  return (
    <div className="demo-content-stage" data-testid="demo-stage-workspace">
      <div className="demo-stage-bar demo-stage-bar--wrap">
        <div className="demo-doc-pills" role="group" aria-label="Demo documents">
          {DOC_SWITCHER_ITEMS.map((doc) => {
            const isActive = !showHtmlSandbox && activeDocPath === doc.path;
            return (
              <button
                key={doc.path}
                type="button"
                className={`demo-pill-btn${isActive ? ' is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => openDocument(doc.path)}
              >
                {doc.label}
              </button>
            );
          })}
          <button
            type="button"
            className={`demo-pill-btn${showHtmlSandbox ? ' is-active' : ''}`}
            aria-pressed={showHtmlSandbox}
            onClick={() => setShowHtmlSandbox((prev) => !prev)}
          >
            HTML Sandbox
          </button>
        </div>
        <div className="demo-stage-bar__actions">
          <button
            ref={htmlModalTriggerRef}
            type="button"
            className="demo-pill-btn"
            onClick={() => setHtmlModalOpen(true)}
          >
            HTML Modal
          </button>
        </div>
      </div>

      {showHtmlSandbox ? (
        <div className="demo-html-preview-host" data-testid="demo-html-sandbox">
          <HtmlDocumentView
            filePath={DEMO_HTML_PREVIEW.path}
            htmlSource={DEMO_HTML_PREVIEW.htmlContent}
            markdownHtml=""
            previewEnabled={true}
            title={DEMO_HTML_PREVIEW.title}
          />
        </div>
      ) : (
        <div className="demo-stage-content-host">
          <Content onImageClick={handleImageClick} scrollRef={scrollRef} suppressWelcome={true} />
        </div>
      )}

      {htmlModalOpen && (
        <HtmlPreviewModal
          documentHtml={DEMO_HTML_PREVIEW.htmlContent}
          title={DEMO_HTML_PREVIEW.title}
          closeLabel="Close HTML preview"
          trigger={htmlModalTriggerRef.current}
          onClose={() => setHtmlModalOpen(false)}
        />
      )}
      <MediaModal gallery={mediaGallery} onClose={() => setMediaGallery(null)} />
    </div>
  );
}
