import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../../ui/src/components/Content/enhancements/mermaidRenderToSvg.ts', () => ({
  renderMermaidToSvg: vi.fn(async ({ isDark }: { isDark: boolean }) => ({
    svgHtml: `<svg data-testid="mock-svg" class="mock-svg-${isDark ? 'dark' : 'light'}"><text>Diagram</text></svg>`,
  })),
}));

import { MermaidThumbnail } from '../../../../ui/src/components/Insights/MermaidThumbnail';

describe('MermaidThumbnail', () => {
  let intersectionCallback: ((entries: any[]) => void) | null = null;

  beforeEach(() => {
    intersectionCallback = null;
    vi.stubGlobal('IntersectionObserver', class MockIntersectionObserver {
      constructor(cb: any) {
        intersectionCallback = cb;
      }
      observe() {
        if (intersectionCallback) {
          intersectionCallback([{ isIntersecting: true }]);
        }
      }
      disconnect() {}
      unobserve() {}
    });
  });

  it('renders diagram SVG when intersection occurs and allows click for preview', async () => {
    const onOpenMedia = vi.fn();
    const user = userEvent.setup();

    render(
      <MermaidThumbnail
        code="graph TD; A-->B;"
        label="Test diagram"
        status="valid"
        onOpenMedia={onOpenMedia}
      />
    );

    // Renders SVG once visible
    await waitFor(() => {
      expect(screen.getByTestId('mermaid-thumbnail-rendered')).toBeVisible();
      expect(screen.getByTestId('mock-svg')).toBeInTheDocument();
    });

    // Click thumbnail invokes onOpenMedia with rendered SVG
    await user.click(screen.getByTestId('mermaid-thumbnail-rendered'));
    expect(onOpenMedia).toHaveBeenCalledTimes(1);
    expect(onOpenMedia).toHaveBeenCalledWith(expect.stringContaining('mock-svg'));
  });

  it('keeps placeholder for invalid diagram without crashing', () => {
    render(
      <MermaidThumbnail
        code="invalid mermaid code"
        label="Invalid diagram"
        status="invalid"
      />
    );

    expect(screen.getByTestId('mermaid-thumbnail-placeholder')).toBeVisible();
    expect(screen.queryByTestId('mermaid-thumbnail-rendered')).toBeNull();
  });
})