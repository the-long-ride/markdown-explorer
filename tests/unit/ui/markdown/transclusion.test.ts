import { describe, expect, it, vi } from 'vitest';
import {
  renderTransclusion,
  type TransclusionRenderContext,
} from '../../../../ui/src/markdown/transclusion';

function context(overrides: Partial<TransclusionRenderContext> = {}): TransclusionRenderContext {
  return {
    sourceDocumentPath: 'docs/A.md',
    depth: 0,
    ancestorDocumentPaths: ['docs/A.md'],
    documentCount: 1,
    resolve: vi.fn(async (rawTarget, sourceDocumentPath) => ({
      status: 'resolved' as const,
      documentPath: sourceDocumentPath === 'docs/A.md' ? 'docs/B.md' : rawTarget,
      canonicalPath: sourceDocumentPath === 'docs/A.md' ? 'docs/B.md' : rawTarget,
      caseMismatch: false,
    })),
    read: vi.fn(async () => ({ status: 'ok' as const, kind: 'markdown' as const, source: '# B\n\n[[C]]' })),
    renderMarkdown: vi.fn(async (source, childContext) =>
      `<article data-source="${childContext.sourceDocumentPath}">${source}</article>`),
    renderPreview: vi.fn(async (canonicalPath) => `<div data-preview="${canonicalPath}"></div>`),
    ...overrides,
  };
}

describe('renderTransclusion', () => {
  it('renders Markdown with child source identity and nested source-relative context', async () => {
    const ctx = context();
    const result = await renderTransclusion('B', ctx);
    expect(result.status).toBe('rendered');
    expect(ctx.resolve).toHaveBeenCalledWith('B', 'docs/A.md');
    expect(ctx.renderMarkdown).toHaveBeenCalledWith('# B\n\n[[C]]', expect.objectContaining({
      sourceDocumentPath: 'docs/B.md',
      depth: 1,
      ancestorDocumentPaths: ['docs/A.md', 'docs/B.md'],
      documentCount: 2,
    }));
  });

  it('stops a transclusion cycle before reading source', async () => {
    const read = vi.fn();
    const result = await renderTransclusion('B', context({
      ancestorDocumentPaths: ['docs/A.md', 'docs/B.md'],
      read,
    }));
    expect(result.status).toBe('cycle');
    expect(read).not.toHaveBeenCalled();
  });

  it('enforces depth five and a fifty-document render budget', async () => {
    const readAtDepth = vi.fn();
    await expect(renderTransclusion('B', context({ depth: 5, read: readAtDepth })))
      .resolves.toMatchObject({ status: 'depth-limit' });
    expect(readAtDepth).not.toHaveBeenCalled();

    const readAtBudget = vi.fn();
    await expect(renderTransclusion('B', context({ documentCount: 50, read: readAtBudget })))
      .resolves.toMatchObject({ status: 'document-limit' });
    expect(readAtBudget).not.toHaveBeenCalled();
  });

  it('renders missing and ambiguous targets as explicit placeholders without reading', async () => {
    const read = vi.fn();
    await expect(renderTransclusion('Missing', context({
      resolve: vi.fn(async () => ({ status: 'missing' as const })),
      read,
    }))).resolves.toMatchObject({ status: 'missing' });
    await expect(renderTransclusion('Ambiguous', context({
      resolve: vi.fn(async () => ({ status: 'ambiguous' as const, candidates: ['A.md', 'B.md'] })),
      read,
    }))).resolves.toMatchObject({ status: 'ambiguous' });
    expect(read).not.toHaveBeenCalled();
  });

  it('never auto-loads a remote embed', async () => {
    const resolve = vi.fn();
    const read = vi.fn();
    const result = await renderTransclusion('https://example.com/a.png', context({ resolve, read }));
    expect(result).toMatchObject({ status: 'remote-unloaded' });
    expect(resolve).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('delegates supported non-Markdown documents to the existing preview callback', async () => {
    const renderPreview = vi.fn(async (path: string) => `<preview>${path}</preview>`);
    const result = await renderTransclusion('slides', context({
      read: vi.fn(async () => ({ status: 'ok' as const, kind: 'preview' as const })),
      renderPreview,
    }));
    expect(result).toMatchObject({ status: 'rendered', html: '<preview>docs/B.md</preview>' });
    expect(renderPreview).toHaveBeenCalledWith('docs/B.md');
  });
});
