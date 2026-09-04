import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Vi hoisting: the mock factory must reference state captured in `vi.hoisted`
// so the mock installs before the module imports resolve.
const mocks = vi.hoisted(() => {
  const stateRef: {
    current: { theme: 'light' | 'dark' | 'auto'; settings: { language: string } };
  } = {
    current: { theme: 'dark', settings: { language: 'en' } },
  };
  const setTheme = vi.fn((next: 'light' | 'dark' | 'auto') => {
    stateRef.current = { ...stateRef.current, theme: next };
  });
  return { stateRef, setTheme };
});

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mocks.stateRef.current, setTheme: mocks.setTheme }),
}));

vi.mock('../../../../ui/src/components/Content/enhancements/mermaidRenderToSvg', () => ({
  renderMermaidToSvg: vi.fn(async ({ isDark }: { isDark: boolean }) => ({
    svgHtml: `<svg id="mock-${isDark ? 'dark' : 'light'}">RECOLOR</svg>`,
  })),
}));

import { MediaModal } from '../../../../ui/src/components/Modal/MediaModal';
import type { MediaGallery } from '../../../../ui/src/components/Modal/mediaGallery';

const mockGallery: MediaGallery = {
  items: [{ type: 'svg', html: '<svg id="original">INIT</svg>', source: 'flowchart TD\nA-->B' }],
  currentIndex: 0,
};

describe('MediaModal theme toggle integration', () => {
  beforeEach(() => {
    mocks.stateRef.current = { theme: 'dark', settings: { language: 'en' } };
    mocks.setTheme.mockClear();
  });

  it('replaces SVG innerHTML on theme flip while preserving zoom/pan CSS vars', async () => {
    const { container, rerender } = render(
      <MediaModal gallery={mockGallery} onClose={() => {}} />,
    );
    const svgDiv = container.querySelector('.mdn-modal-content-svg') as HTMLDivElement;
    expect(svgDiv).toBeTruthy();

    // Initial mount: the snapshot baked by createMediaGallery is PRESERVED —
    // the mermaid re-render effect skips the first dep-change for each new
    // gallery (see MediaModal.tsx prevGalleryRef guard). This prevents the
    // historical "empty box on open" regression where the off-DOM helper
    // would overwrite a good snapshot with a degenerate SVG before mermaid's
    // layout-sensitive kinds had measurement context.
    await waitFor(() => {
      expect(svgDiv.innerHTML).toContain('INIT');
    });
    expect(svgDiv.innerHTML).not.toContain('mock-dark');

    // Simulate a zoom-in interaction by clicking the Zoom In button
    // (aria-label = "Zoom In" via TooltipButton's aria-label={tooltip} binding).
    const zoomInButton = screen.getByLabelText('Zoom In');
    fireEvent.click(zoomInButton);

    // The CSS var --zoom should now be greater than 1 (set useCssVars).
    const zoomValueAfterZoomIn = svgDiv.style.getPropertyValue('--zoom');
    expect(Number.parseFloat(zoomValueAfterZoomIn)).toBeGreaterThan(1);

    // Capture the pan CSS vars too — they should be untouched by the flip.
    const panXAfterZoomIn = svgDiv.style.getPropertyValue('--pan-x');
    const panYAfterZoomIn = svgDiv.style.getPropertyValue('--pan-y');

    // Simulate a theme flip by mutating the mock state and re-rendering.
    mocks.stateRef.current = { ...mocks.stateRef.current, theme: 'light' };
    rerender(<MediaModal gallery={mockGallery} onClose={() => {}} />);

    // The theme effect fires again with isDark=false and replaces the innerHTML.
    await waitFor(() => {
      expect(svgDiv.innerHTML).toContain('mock-light');
    });
    expect(svgDiv.innerHTML).not.toContain('INIT');

    // The zoom CSS var must be preserved across the flip — the theme effect
    // must NOT call setZoom (the contract test also enforces this on source).
    const zoomValueAfterFlip = svgDiv.style.getPropertyValue('--zoom');
    expect(zoomValueAfterFlip).toBe(zoomValueAfterZoomIn);

    // Pan CSS vars must be identical too.
    expect(svgDiv.style.getPropertyValue('--pan-x')).toBe(panXAfterZoomIn);
    expect(svgDiv.style.getPropertyValue('--pan-y')).toBe(panYAfterZoomIn);
  });

  it('the toggle button calls setTheme with the opposite resolved mode', async () => {
    // Mount with resolved dark theme.
    mocks.stateRef.current = { theme: 'dark', settings: { language: 'en' } };
    const { rerender } = render(<MediaModal gallery={mockGallery} onClose={() => {}} />);

    // The toggle button shows the switch-to-light affordance (aria-label =
    // t.topbar.theme = "Toggle light/dark mode").
    const toggleButton = screen.getByLabelText('Toggle light/dark mode');

    // When current mode is dark, clicking should request the opposite ('light').
    fireEvent.click(toggleButton);
    expect(mocks.setTheme).toHaveBeenCalledWith('light');

    // Update state to reflect what setTheme would do, then re-render.
    mocks.stateRef.current = { ...mocks.stateRef.current, theme: 'light' };
    rerender(<MediaModal gallery={mockGallery} onClose={() => {}} />);

    // Now with light resolved, clicking the toggle should request 'dark'.
    const toggleButtonUpdated = screen.getByLabelText('Toggle light/dark mode');
    fireEvent.click(toggleButtonUpdated);
    expect(mocks.setTheme).toHaveBeenLastCalledWith('dark');
  });

  // ── Bug B regression: MediaModal stays mounted across closes/reopens (it
  //    returns null when gallery is null at line 182 in MediaModal.tsx), so a
  //    once-per-lifetime isFirstRenderRef would NOT reset and the second opened
  //    gallery's snapshot would be overwritten by a redundant helper call. The
  //    effect must track gallery IDENTITY via prevGalleryRef and skip the
  //    first dep-change for EACH new gallery open — not just the very first.
  it('preserves the snapshot of a NEW gallery opened after closing a previous one', async () => {
    const galleryA: MediaGallery = {
      items: [{ type: 'svg', html: '<svg id="snap-A">SNAPA</svg>', source: 'flowchart TD\nA-->B' }],
      currentIndex: 0,
    };
    const galleryB: MediaGallery = {
      items: [{ type: 'svg', html: '<svg id="snap-B">SNAPB</svg>', source: 'flowchart TD\nC-->D' }],
      currentIndex: 0,
    };

    // First open: snapshot of A is preserved (helper is skipped on the first
    // dep-change for the new gallery).
    const { container, rerender } = render(<MediaModal gallery={galleryA} onClose={() => {}} />);
    let svgDiv = container.querySelector('.mdn-modal-content-svg') as HTMLDivElement;
    expect(svgDiv).toBeTruthy();
    await waitFor(() => {
      expect(svgDiv.innerHTML).toContain('SNAPA');
    });
    expect(svgDiv.innerHTML).not.toContain('RECOLOR');

    // Close: gallery becomes null. MediaModal returns null but stays mounted,
    // so prevGalleryRef persists. The themed re-render effect early-returns on
    // `if (!gallery) return;` and does not touch prevGalleryRef for this tick.
    rerender(<MediaModal gallery={null} onClose={() => {}} />);
    expect(container.querySelector('.mdn-modal-content-svg')).toBeNull();

    // Re-open with a NEW gallery B (different identity than galleryA): the
    // effect computes isNewGallery = (galleryB !== galleryA) = true → skip the
    // first dep-change, preserving B's snapshot. A naive isFirstRenderRef
    // would have been flipped to false during galleryA's first tick and would
    // NOT reset, so this test directly exercises the prevGalleryRef pattern.
    rerender(<MediaModal gallery={galleryB} onClose={() => {}} />);
    svgDiv = container.querySelector('.mdn-modal-content-svg') as HTMLDivElement;
    await waitFor(() => {
      expect(svgDiv).toBeTruthy();
      expect(svgDiv.innerHTML).toContain('SNAPB');
    });
    expect(svgDiv.innerHTML).not.toContain('RECOLOR');
    expect(svgDiv.innerHTML).not.toContain('SNAPA');

    // Subsequent theme flip on the SAME re-opened gallery: galleryB identity
    // is unchanged → isNewGallery = false → helper FIRES and replaces the
    // snapshot with the freshly-rendered themed SVG. This confirms the skip
    // only applies to the FIRST dep-change after a new gallery opens.
    mocks.stateRef.current = { ...mocks.stateRef.current, theme: 'light' };
    rerender(<MediaModal gallery={galleryB} onClose={() => {}} />);
    await waitFor(() => {
      expect(svgDiv.innerHTML).toContain('mock-light');
    });
    expect(svgDiv.innerHTML).not.toContain('SNAPB');
  });

  it('renders SVG on open when item.html snapshot is missing', async () => {
    const galleryWithoutHtml: MediaGallery = {
      items: [{ type: 'svg', source: 'flowchart TD\nA-->B' }],
      currentIndex: 0,
    };
    const { container } = render(
      <MediaModal gallery={galleryWithoutHtml} onClose={() => {}} />,
    );
    const svgDiv = container.querySelector('.mdn-modal-content-svg') as HTMLDivElement;
    expect(svgDiv).toBeTruthy();
    await waitFor(() => {
      expect(svgDiv.innerHTML).toContain('mock-dark');
    });
  });
});
