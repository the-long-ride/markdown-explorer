import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { DocumentEnvironmentContext, type DocumentEnvironment } from '../../../../ui/src/components/Content/DocumentEnvironmentContext';
import { SplitPaneDocument } from '../../../../ui/src/components/Content/SplitPaneDocument';
import { resetDocumentRoots } from '../../../../ui/src/document/activeDocumentRoot';

vi.mock('../../../../ui/src/components/Content/scheduleContentEnhancements', () => ({
  scheduleContentEnhancements: () => () => {},
}));
vi.mock('../../../../ui/src/components/Content/useDocumentOverlays', () => ({
  useDocumentOverlays: () => ({
    onOpenHtmlModal: vi.fn(),
    onOpenLinkMenu: vi.fn(),
    onBookmarkContextMenu: vi.fn(),
    onActionError: vi.fn(),
    overlays: <div className="scope-view-modal" data-testid="pane-overlay" />,
  }),
}));

afterEach(() => resetDocumentRoots());

function Pane() {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div className="split-document-pane__scroll" data-testid="pane-scroll" ref={scrollRef}>
      <SplitPaneDocument
        paneId="secondary"
        projection={{
          filePath: '/docs/a.md', relativePath: 'a.md', fileName: 'a.md', title: 'A',
          contentHtml: '<p>A</p>', source: 'A', markdownSource: 'A', sourceDocumentText: 'A',
          mode: 'rendered', scrollTop: 0, renderRevision: 1, tab: {} as any,
          frontmatter: {}, toc: [], previewInfo: null, stale: false,
        }}
        mode="rendered"
        renderVersion={1}
        disabled={false}
        language="en"
        scrollRef={scrollRef}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
      />
    </div>
  );
}

describe('split pane overlays', () => {
  it('render at window level instead of inside the contained pane scroll area', () => {
    const env: DocumentEnvironment = {
      state: { ...initialState, settings: { ...initialState.settings, language: 'en' } },
      bridge: { postMessage: vi.fn(), copyToClipboard: vi.fn() },
      navigate: vi.fn(),
      onImageClick: vi.fn(),
      refresh: vi.fn(),
    };
    render(<DocumentEnvironmentContext.Provider value={env}><Pane /></DocumentEnvironmentContext.Provider>);

    const overlay = screen.getByTestId('pane-overlay');
    expect(overlay.parentElement).toBe(document.body);
    expect(screen.getByTestId('pane-scroll').contains(overlay)).toBe(false);
  });
});
