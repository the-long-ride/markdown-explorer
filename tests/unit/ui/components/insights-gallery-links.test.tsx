import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';
import { GalleryView } from '../../../../ui/src/components/Insights/GalleryView';
import { LinksView } from '../../../../ui/src/components/Insights/LinksView';

function doc(path: string, source: string) {
  return analyzeDocument({ path, source, revision: `${path}-1` });
}

describe('Insights Gallery and Links views', () => {
  it('shows referenced media and Mermaid diagrams, probes local metadata, and never auto-loads remote media', async () => {
    const probeResource = vi.fn(async () => ({ status: 'exists' as const, kind: 'file' as const, sizeBytes: 123 }));
    const document = doc('docs/guide.md', [
      '# Guide',
      '![Local diagram](../assets/diagram.png)',
      '![Remote image](https://example.test/remote.png)',
      '[Audio](../media/clip.mp3)',
      '```mermaid',
      'this is not a diagram declaration',
      '```',
    ].join('\n'));

    render(<GalleryView documents={[document]} probeResource={probeResource} />);

    expect(screen.getByText('../assets/diagram.png')).toBeVisible();
    expect(screen.getByText(/diagram · invalid/i)).toBeVisible();
    expect(screen.queryByRole('img', { name: /remote image/i })).toBeNull();
    await waitFor(() => expect(probeResource).toHaveBeenCalledWith('docs/guide.md', '../assets/diagram.png'));
    expect(probeResource).not.toHaveBeenCalledWith('docs/guide.md', 'https://example.test/remote.png');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /load preview.*remote image/i }));
    expect(screen.getByRole('img', { name: /remote image/i })).toHaveAttribute('src', 'https://example.test/remote.png');
  });

  it('distinguishes missing, invalid anchor, outside, dynamic, and unchecked external links', () => {
    const index = new WorkspaceInsightsIndex();
    const source = doc('docs/source.md', [
      '# Source',
      '[[Missing]]',
      '[[Target#Nope]]',
      '[outside](file:///tmp/secret.md)',
      '[remote](https://example.test)',
      '<a href={dynamicTarget}>Dynamic</a>',
    ].join('\n'));
    const target = doc('docs/Target.md', '# Target\n## Exists');
    index.applyDocument(source);
    index.applyDocument(target);

    render(<LinksView snapshot={index.snapshot()} documents={[source, target]} externalResults={new Map()} />);

    expect(screen.getByText('missing')).toBeVisible();
    expect(screen.getByText('invalid-anchor')).toBeVisible();
    expect(screen.getByText('outside-workspace')).toBeVisible();
    expect(screen.getByText('dynamic')).toBeVisible();
    expect(screen.getByText('unchecked')).toBeVisible();
    expect(screen.getByTestId('broken-link-count')).toHaveTextContent('3');
  });
});
