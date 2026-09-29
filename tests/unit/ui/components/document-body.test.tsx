import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentBody, type DocumentBodyProps } from '../../../../ui/src/components/Content/DocumentBody';
import { getTranslations } from '../../../../ui/src/contexts/translations';

vi.mock('../../../../ui/src/components/TOC/TableOfContents', () => ({
  TableOfContents: ({ entries, rootId }: { entries?: unknown[]; rootId?: string }) => (
    <nav data-testid="compact-toc" data-root={rootId ?? 'active'} data-count={entries?.length ?? -1} />
  ),
}));

const t = getTranslations('en');

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
