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

    // Initial mount: the renderMermaidToSvg effect (isDark=true) overrides the
    // gallery's initial html with the mock's dark svg.
    await waitFor(() => {
      expect(svgDiv.innerHTML).toContain('mock-dark');
    });
    expect(svgDiv.innerHTML).not.toContain('INIT');

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
    expect(svgDiv.innerHTML).not.toContain('mock-dark');

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
});
