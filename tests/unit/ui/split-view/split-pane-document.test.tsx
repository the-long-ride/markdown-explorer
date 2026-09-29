import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { DocumentEnvironmentContext, type DocumentEnvironment } from '../../../../ui/src/components/Content/DocumentEnvironmentContext';
import { SplitPaneDocument } from '../../../../ui/src/components/Content/SplitPaneDocument';
import { resetDocumentRoots } from '../../../../ui/src/document/activeDocumentRoot';
import type { PaneDocumentProjection } from '../../../../ui/src/split-view/paneSelectors';

vi.mock('../../../../ui/src/components/Content/scheduleContentEnhancements', () => ({
  scheduleContentEnhancements: () => () => {},
}));
vi.mock('../../../../ui/src/components/Content/HtmlDocumentView', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../ui/src/components/Content/HtmlDocumentView')>()),
  HtmlDocumentView: ({ allowUpstreamResources }: { allowUpstreamResources?: boolean }) => (
    <iframe className="html-document-view__iframe" title="html preview" data-allow-upstream={String(Boolean(allowUpstreamResources))} />
  ),
}));
vi.mock('../../../../ui/src/components/Modal/ScopeViewModal', () => ({ ScopeViewModal: () => null }));
vi.mock('../../../../ui/src/components/Bookmarks/BookmarkSelectionMenu', () => ({ BookmarkSelectionMenu: () => null }));

afterEach(() => resetDocumentRoots());

function projection(overrides: Partial<PaneDocumentProjection> = {}): PaneDocumentProjection {
  return {
    filePath: '/docs/a.md',
    relativePath: 'a.md',
    fileName: 'a.md',
    title: 'A',
    contentHtml: '<h1 data-mdn-source-start="0" data-mdn-source-end="7">Hello</h1>',
    source: '# Hello',
    markdownSource: '# Hello',
    sourceDocumentText: '# Hello',
    mode: 'rendered',
    scrollTop: 0,
    renderRevision: 1,
    tab: {} as any,
    frontmatter: {},
    toc: [],
    previewInfo: null,
    stale: false,
    ...overrides,
  };
}

function Pane({ paneId = 'secondary', value = projection(), mode = 'rendered', onModeChange, onSourceChange, onSave }: {
  paneId?: 'primary' | 'secondary';
  value?: PaneDocumentProjection;
  mode?: 'rendered' | 'plain' | 'inline-edit';
  onModeChange?: (mode: string) => void;
  onSourceChange?: (source: string) => void;
  onSave?: () => void | Promise<unknown>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scrollRef}>
      <SplitPaneDocument
        paneId={paneId}
        projection={value}
        mode={mode}
        renderVersion={1}
        disabled={false}
        language="en"
        scrollRef={scrollRef}
        onSourceChange={onSourceChange ?? vi.fn()}
        onSave={onSave ?? vi.fn()}
        onModeChange={onModeChange as any}
      />
    </div>
  );
}

function withEnv(env: Partial<DocumentEnvironment>, children: ReactNode) {
  const value: DocumentEnvironment = {
    state: { ...initialState, settings: { ...initialState.settings, language: 'en' } },
    bridge: { postMessage: vi.fn(), copyToClipboard: vi.fn() },
    navigate: vi.fn(),
    onImageClick: vi.fn(),
    refresh: vi.fn(),
    ...env,
  };
  return <DocumentEnvironmentContext.Provider value={value}>{children}</DocumentEnvironmentContext.Provider>;
}

describe('SplitPaneDocument', () => {
  it('renders rendered markdown with pane and source document identity', () => {
    render(<Pane />);
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    const surface = screen.getByTestId('document-surface');
    expect(surface).toHaveAttribute('data-mdn-source-document-path', 'a.md');
    expect(surface).toHaveAttribute('data-document-root', 'secondary');
  });

  it('renders the shared source in CodeMirror and returns to rendered preview', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<Pane mode="plain" value={projection({ contentHtml: '<p>old</p>', source: 'new source' })} onModeChange={onModeChange} />);
    expect(screen.getByTestId('markdown-source-editor')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /markdown source/i })).toHaveTextContent('new source');
    expect(screen.queryByText('old')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(onModeChange).toHaveBeenCalledWith('rendered');
  });

  it('keeps table ids distinct when both panes show the same document', () => {
    const shared = projection({ contentHtml: '<table id="tbl_ab12cd" class="mdn-table"><tr><td>x</td></tr></table>' });
    const { container } = render(<><Pane paneId="primary" value={shared} /><Pane paneId="secondary" value={shared} /></>);
    const ids = Array.from(container.querySelectorAll('table')).map((table) => table.id);
    expect(ids).toEqual(['tbl_ab12cd', 'tbl_ab12cd_s']);
  });

  it('renders frontmatter and the stale-file notice from the projection', () => {
    render(<Pane value={projection({ frontmatter: { title: 'Pane title' }, stale: true })} />);
    expect(screen.getByText('Pane title')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('routes image clicks to the app media modal when the environment is available', () => {
    const onImageClick = vi.fn();
    render(withEnv({ onImageClick }, <Pane value={projection({ contentHtml: '<p><img src="a.png" alt="pic"></p>' })} />));
    const image = screen.getByAltText('pic');
    fireEvent.click(image);
    expect(onImageClick).toHaveBeenCalledWith(image);
  });

  it('collapses sections inside the pane when the environment is available', () => {
    const html = '<section class="mdn-section" id="s" data-expanded="true"><div class="mdn-section-header">S</div><div class="mdn-section-body">b</div></section>';
    const { container } = render(withEnv({}, <Pane value={projection({ contentHtml: html })} />));
    fireEvent.click(container.querySelector('.mdn-section-header')!);
    expect(container.querySelector<HTMLElement>('.mdn-section')!.dataset.expanded).toBe('false');
  });

  it('lets a full HTML document preview fill the pane', () => {
    const html = projection({ filePath: '/docs/page.html', relativePath: 'page.html', sourceDocumentText: '<html><body>x</body></html>', htmlPreviewOverride: true });
    const { container, unmount } = render(<Pane value={html} />);
    const scroll = container.firstElementChild as HTMLElement;
    expect(scroll.classList.contains('split-document-pane__scroll--html-preview')).toBe(true);
    expect(screen.getByTestId('document-surface').classList.contains('mdn-body--html-preview')).toBe(true);
    unmount();
    expect(scroll.classList.contains('split-document-pane__scroll--html-preview')).toBe(false);
  });

  it('applies the saved upstream-resource setting to a split-pane HTML preview', () => {
    const html = projection({ filePath: '/docs/page.html', relativePath: 'page.html', sourceDocumentText: '<html><body>x</body></html>', htmlPreviewOverride: true });
    const state = { ...initialState, settings: { ...initialState.settings, language: 'en', allowUpstreamHtmlPreview: true } };

    render(withEnv({ state }, <Pane value={html} />));

    expect(screen.getByTitle('html preview')).toHaveAttribute('data-allow-upstream', 'true');
  });

  it('does not use the full-pane HTML layout for markdown documents', () => {
    const { container } = render(<Pane />);
    expect((container.firstElementChild as HTMLElement).classList.contains('split-document-pane__scroll--html-preview')).toBe(false);
  });

  it('applies the inline-edit draft and requests a save on Ctrl+S', () => {
    const onSourceChange = vi.fn();
    const onSave = vi.fn();
    const value = projection({ contentHtml: '<p data-mdn-source-start="0" data-mdn-source-end="5">Alpha</p>', source: 'Alpha' });
    render(<Pane mode="inline-edit" value={value} onSourceChange={onSourceChange} onSave={onSave} />);

    fireEvent.doubleClick(screen.getByText('Alpha'));
    const editor = screen.getByRole('textbox', { name: /markdown/i });
    fireEvent.change(editor, { target: { value: 'Beta' } });
    fireEvent.keyDown(editor, { key: 's', ctrlKey: true });

    expect(onSourceChange).toHaveBeenCalledWith('Beta');
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
