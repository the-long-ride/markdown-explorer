import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentSurface } from '../../../../ui/src/components/Content/DocumentSurface';

describe('DocumentSurface', () => {
  it('renders rendered markdown content with source document identity', () => {
    render(
      <DocumentSurface
        filePath="/docs/a.md"
        relativePath="a.md"
        mode="rendered"
        contentHtml={'<h1 data-mdn-source-start="0" data-mdn-source-end="7">Hello</h1>'}
        source="# Hello"
        stale={false}
        language="en"
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByTestId('document-surface')).toHaveAttribute('data-mdn-source-document-path', 'a.md');
  });

  it('renders the shared working source in plain mode', () => {
    render(
      <DocumentSurface
        filePath="/docs/a.md"
        relativePath="a.md"
        mode="plain"
        contentHtml="<p>old</p>"
        source="new source"
        stale={false}
        language="en"
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: /markdown source/i })).toHaveValue('new source');
    expect(screen.queryByText('old')).not.toBeInTheDocument();
  });
});
