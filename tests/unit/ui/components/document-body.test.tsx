import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentBody, type DocumentBodyProps } from '../../../../ui/src/components/Content/DocumentBody';
import { HtmlDocumentView } from '../../../../ui/src/components/Content/HtmlDocumentView';
import { getTranslations } from '../../../../ui/src/contexts/translations';

vi.mock('../../../../ui/src/components/TOC/TableOfContents', () => ({
  TableOfContents: ({ entries, rootId }: { entries?: unknown[]; rootId?: string }) => (
    <nav data-testid="compact-toc" data-root={rootId ?? 'active'} data-count={entries?.length ?? -1} />
  ),
}));
const preview = vi.hoisted(() => ({
  bridge: { postMessage: vi.fn() },
  prepare: vi.fn(),
}));
vi.mock('../../../../ui/src/contexts/AppStateContext', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../../ui/src/contexts/AppStateContext')>(),
  useAppState: () => ({ state: { settings: { language: '' } } }),
}));
vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => preview.bridge }));
vi.mock('../../../../ui/src/markdown/htmlLocalFirstPreview', () => ({ prepareLocalFirstHtmlPreview: preview.prepare }));

const t = getTranslations('en');

describe('HtmlDocumentView', () => {
  const props = {
    filePath: '/docs/guide.html', htmlSource: '<p>Original HTML</p>', markdownHtml: '<h2>Converted HTML</h2>', title: 'Preview',
  };

  it('shows converted content and a conversion error instead of preparing an iframe when preview is disabled', () => {
    preview.prepare.mockClear();
    render(<HtmlDocumentView {...props} previewEnabled={false} conversionError="Conversion unavailable" />);
    expect(screen.getByRole('heading', { name: 'Converted HTML' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Conversion unavailable');
    expect(preview.prepare).not.toHaveBeenCalled();
  });

  it('shows an unreadable source error even when the preparation rejects with a string', async () => {
    preview.prepare.mockRejectedValueOnce('Unreadable HTML');
    render(<HtmlDocumentView {...props} previewEnabled />);
    expect(screen.getByRole('status')).toHaveTextContent(t.ui.preparingHtmlPreview);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unreadable HTML');
  });

  it.each([true, false])('ignores stale preparations after switching back to converted content (success: %s)', async (success) => {
    let finish: () => void;
    const onPolicyReport = vi.fn();
    preview.prepare.mockImplementationOnce(() => new Promise((resolve, reject) => {
      finish = success ? () => resolve({ documentHtml: props.htmlSource, policyReport: {} }) : () => reject(new Error('Stale error'));
    }));
    const { rerender } = render(<HtmlDocumentView {...props} previewEnabled onPolicyReport={onPolicyReport} />);
    rerender(<HtmlDocumentView {...props} previewEnabled={false} onPolicyReport={onPolicyReport} />);
    await act(async () => finish!());
    expect(screen.getByRole('heading', { name: 'Converted HTML' })).toBeInTheDocument();
    expect(screen.queryByTitle('Preview')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onPolicyReport).not.toHaveBeenCalled();
  });
});

function props(overrides: Partial<DocumentBodyProps> = {}): DocumentBodyProps {
  return {
    rootId: 'secondary',
    filePath: '/docs/b.md',
    relativePath: 'b.md',
    language: 'en',
    translations: t,
    contentHtml: '<!-- lead --><h1 id="a">Heading A</h1>',
    frontmatterEntries: [['title', 'Doc title']],
    toc: [{ id: 'a', text: 'A', level: 1 }],
    tocCollapsed: false,
    stale: true,
    previewNotice: { kind: 'converted', title: 'Converted preview', warning: 'May differ', meta: '' },
    html: { isHtmlDocument: false, sourceText: null, markdownHtml: '', previewEnabled: false, error: null },
    plainSession: null,
    onRefresh: vi.fn(),
    onSourceChange: vi.fn(),
    onSave: vi.fn(),
    onPreview: vi.fn(),
    ...overrides,
  };
}

describe('DocumentBody', () => {
  it('renders frontmatter, stale and preview notices, compact TOC and body', async () => {
    render(<DocumentBody {...props()} />);
    expect(screen.getByText('Doc title')).toBeInTheDocument();
    expect(screen.getByText(t.documentPreview.currentFileChangedOnDisk)).toBeInTheDocument();
    expect(screen.getByText('Converted preview')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heading A' })).toBeInTheDocument();
    const toc = await screen.findByTestId('compact-toc');
    expect(toc.dataset.root).toBe('secondary');
    expect(toc.dataset.count).toBe('1');
  });

  it('lets the main view TOC follow global state', async () => {
    render(<DocumentBody {...props({ rootId: 'main' })} />);
    const toc = await screen.findByTestId('compact-toc');
    expect(toc.dataset.root).toBe('active');
  });

  it('renders the plain source editor for a plain session', () => {
    render(<DocumentBody {...props({ plainSession: { source: '# Plain', saving: false, plainSourceLabel: 'Markdown source' } })} />);
    expect(screen.getByLabelText('Markdown source')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Heading A' })).toBeNull();
  });
});
