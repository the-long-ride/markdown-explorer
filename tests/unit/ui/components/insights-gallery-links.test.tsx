import { render, screen, waitFor } from '@testing-library/react';
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
});
