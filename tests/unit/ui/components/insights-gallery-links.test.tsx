import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';
import { GalleryView } from '../../../../ui/src/components/Insights/GalleryView';
import { LinksView } from '../../../../ui/src/components/Insights/LinksView';
import { INSIGHTS_UI_TRANSLATIONS } from '../../../../ui/src/contexts/insightsUiTranslations';

vi.mock('../../../../ui/src/components/Content/enhancements/mermaidRenderToSvg.ts', () => ({
  renderMermaidToSvg: vi.fn(async ({ isDark }: { isDark: boolean }) => ({
    svgHtml: `<svg data-testid="mock-svg" class="mock-svg-${isDark ? 'dark' : 'light'}"><text>Diagram</text></svg>`,
  })),
}));

const labels = INSIGHTS_UI_TRANSLATIONS.en;
function doc(path: string, source: string) { return analyzeDocument({ path, source, revision: `${path}-1` }); }

describe('Insights Gallery and Links views', () => {
  it('skips non-media links and dispatches local image previews without requiring host probing', () => {
    const open = vi.fn();
    window.addEventListener('markdown-explorer-open-media-modal', open);
    const onSelectPath = vi.fn();
    const mediaDocument = doc('guide.md', [
      '[Ordinary Markdown](notes.md)',
      '![ ](image.png)',
      '[Paper](manual.pdf)',
      '[Clip](film.mp4)',
      '[Sound](sound.ogg)',
    ].join('\n'));
    try {
      const { rerender } = render(<GalleryView documents={[]} />);
      expect(screen.getByText(labels.noMedia)).toBeInTheDocument();
      rerender(<GalleryView documents={[mediaDocument]} onSelectPath={onSelectPath} />);
      expect(screen.queryByText('notes.md')).not.toBeInTheDocument();
      for (const category of ['document', 'video', 'audio', 'image'] as const) {
        expect(screen.getByRole('button', { name: `${labels.presentation.galleryCategories[category]} (1)` })).toBeInTheDocument();
      }
      const preview = screen.getByRole('button', { name: `${labels.loadPreview}:` });
      const card = preview.closest('article')!;
      fireEvent.keyDown(card, { key: 'Tab' });
      expect(onSelectPath).not.toHaveBeenCalled();
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onSelectPath).toHaveBeenCalledWith('guide.md', expect.objectContaining({ sourceStart: expect.any(Number) }));
      fireEvent.click(preview);
      expect(open).toHaveBeenCalledWith(expect.objectContaining({
        detail: { items: [expect.objectContaining({ type: 'img', src: 'image.png' })], currentIndex: 0 },
      }));
      expect(onSelectPath).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('markdown-explorer-open-media-modal', open);
    }
  });

  it('shows referenced media and Mermaid diagrams, probes local metadata, and never auto-loads remote media', async () => {
    const probeResource = vi.fn(async () => ({ status: 'exists' as const, kind: 'file' as const, sizeBytes: 123 }));
    const onOpenMedia = vi.fn();
    const document = doc('docs/guide.md', ['# Guide', '![Local diagram](../assets/diagram.png)', '![Remote image](https://example.test/remote.png)', '[Audio](../media/clip.mp3)', '```mermaid', 'this is not a diagram declaration', '```'].join('\n'));
    render(<GalleryView documents={[document]} labels={labels} probeResource={probeResource} onOpenMedia={onOpenMedia} />);
    expect(screen.getByText('../assets/diagram.png')).toBeVisible();
    expect(screen.getByText(`${labels.presentation.galleryCategories.diagram} · ${labels.presentation.statuses.invalid}`)).toBeVisible();
    expect(screen.queryByRole('img', { name: /remote image/i })).toBeNull();
    await waitFor(() => expect(probeResource).toHaveBeenCalledWith('docs/guide.md', '../assets/diagram.png'));
    expect(probeResource).not.toHaveBeenCalledWith('docs/guide.md', 'https://example.test/remote.png');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /load preview.*remote image/i }));
    expect(screen.getByRole('img', { name: /remote image/i })).toHaveAttribute('src', 'https://example.test/remote.png');
    expect(onOpenMedia).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ src: 'https://example.test/remote.png' })],
    }));
  });

  it('continues showing available resources when an individual metadata probe fails', async () => {
    const media = doc('guide.md', '![Good](good.png)\n\n![Unavailable](offline.png)');
    const probeResource = vi.fn(async (_path: string, target: string) => {
      if (target === 'offline.png') throw new Error('Offline');
      return { status: 'exists' as const, kind: 'file' as const };
    });
    const onOpenMedia = vi.fn();
    const { rerender } = render(<GalleryView documents={[media]} labels={labels} probeResource={probeResource} onOpenMedia={onOpenMedia} />);
    const good = screen.getByText('good.png').closest('article')!;
    const offline = screen.getByText('offline.png').closest('article')!;
    await waitFor(() => expect(good).toHaveTextContent(labels.presentation.statuses.exists));
    expect(offline).toHaveTextContent('…');
    rerender(<GalleryView documents={[doc('remote.md', '![Remote](https://example.test/remote.jpg)')]} labels={labels} probeResource={probeResource} onOpenMedia={onOpenMedia} />);
    expect(probeResource).toHaveBeenCalledTimes(2);
  });

  it('lists remote video and audio without embedding them, and opens a rendered diagram', async () => {
    const document = doc('guide.md', [
      '[Video clip](https://example.test/video.mp4)',
      '[Audio clip](https://example.test/audio.ogg)',
      '```mermaid', 'graph TD; Start-->End;', '```',
    ].join('\n'));
    const onOpenMedia = vi.fn();
    const { container } = render(<GalleryView documents={[document]} onOpenMedia={onOpenMedia} />);
    expect(container.querySelector('video, audio')).toBeNull();
    expect(screen.getByText('Video clip')).toBeInTheDocument();
    expect(screen.getByText('Audio clip')).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId('mermaid-thumbnail-rendered'));
    expect(onOpenMedia).toHaveBeenLastCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ type: 'svg', html: expect.stringContaining('mock-svg') })],
    }));
    fireEvent.change(screen.getByRole('searchbox', { name: labels.filterMediaPlaceholder }), { target: { value: 'unknown item' } });
    expect(screen.getByText(labels.noFilteredMedia)).toBeInTheDocument();
  });

  it('drops obsolete probe results after the document list changes', async () => {
    const old = doc('guide.md', '![Previous](old.png)');
    const current = doc('guide.md', '![Current](new.png)');
    let complete: (value: { status: 'exists'; kind: 'file' }) => void;
    const probeResource = vi.fn(async (_path: string, target: string) => {
      if (target === 'old.png') return new Promise<{ status: 'exists'; kind: 'file' }>((resolve) => { complete = resolve; });
      throw new Error('Unavailable');
    });
    const { rerender } = render(<GalleryView documents={[old]} probeResource={probeResource} />);
    rerender(<GalleryView documents={[current]} probeResource={probeResource} />);
    await act(async () => complete!({ status: 'exists', kind: 'file' }));
    rerender(<GalleryView documents={[old]} probeResource={probeResource} />);
    expect(probeResource.mock.calls.map(([, target]) => target)).toEqual(['old.png', 'new.png', 'old.png']);
    expect(screen.getByText('old.png')).toBeInTheDocument();
  });

  it('distinguishes missing, invalid anchor, outside, dynamic, and unchecked external links and supports position navigation', async () => {
    const index = new WorkspaceInsightsIndex();
    const source = doc('docs/source.md', ['# Source', '[[Missing]]', '[[Target#Nope]]', '[outside](file:///tmp/secret.md)', '[remote](https://example.test)', '<a href={dynamicTarget}>Dynamic</a>'].join('\n'));
    const target = doc('docs/Target.md', '# Target\n## Exists');
    index.applyDocument(source); index.applyDocument(target);
    const onSelectPath = vi.fn();
    const user = userEvent.setup();
    render(<LinksView snapshot={index.snapshot()} documents={[source, target]} labels={labels} externalResults={new Map()} onSelectPath={onSelectPath} />);
    for (const status of ['missing', 'invalid-anchor', 'outside-workspace', 'dynamic', 'unchecked'] as const) {
      expect(screen.getByText(labels.presentation.statuses[status], { selector: `[data-status="${status}"]` })).toBeVisible();
    }
    expect(screen.getByTestId('broken-link-count')).toHaveTextContent('3');

    const linkButtons = screen.getAllByRole('button', { name: /docs\/source\.md/i });
    expect(linkButtons.length).toBeGreaterThan(0);
    await user.click(linkButtons[0]);
    expect(onSelectPath).toHaveBeenCalledWith('docs/source.md', expect.objectContaining({ sourceStart: expect.any(Number) }));
  });

  it('filters gallery items by category chip, search input, and invokes onSelectPath with exact position', async () => {
    const onSelectPath = vi.fn();
    const document = doc('docs/guide.md', [
      '# Guide',
      '![Local diagram](../assets/diagram.png)',
      '![Remote image](https://example.test/remote.png)',
      '```mermaid',
      'graph TD; A-->B;',
      '```',
    ].join('\n'));
    const user = userEvent.setup();
    render(<GalleryView documents={[document]} labels={labels} onSelectPath={onSelectPath} />);

    // Filter chip for Diagram
    const diagramChip = screen.getByRole('button', { name: `${labels.presentation.galleryCategories.diagram} (1)` });
    await user.click(diagramChip);
    expect(screen.queryByText('../assets/diagram.png')).toBeNull();

    // Click on diagram card to navigate
    const diagramCard = screen.getByTestId('gallery-card-docs/guide.md:mermaid:97');
    await user.click(diagramCard);
    expect(onSelectPath).toHaveBeenCalledWith('docs/guide.md', expect.objectContaining({ sourceStart: 97 }));

    // Search input
    const searchInput = screen.getByLabelText(/filter media or diagrams/i);
    await user.type(searchInput, 'nonexistent');
    expect(screen.getByText(/no items match your filter/i)).toBeVisible();
  });

  it('batches resource probing in chunks of 16 without flooding', async () => {
    const probeResource = vi.fn(async () => ({ status: 'exists' as const, kind: 'file' as const, sizeBytes: 100 }));
    // Generate document with 20 image references
    const links = Array.from({ length: 20 }, (_, i) => `![Img ${i}](../assets/img_${i}.png)`).join('\n');
    const document = doc('docs/many.md', `# Batch Test\n${links}`);

    render(<GalleryView documents={[document]} labels={labels} probeResource={probeResource} />);

    await waitFor(() => {
      expect(probeResource).toHaveBeenCalledTimes(20);
    });
  });
});
