import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { copyElementImageToClipboard, saveElementImageAsPng } from '../../../../ui/src/dom/copyImage';
import { ACTION_NOTICE_EVENT } from '../../../../ui/src/utils/actionNotice';

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
vi.mock('../../../../ui/src/dom/copyImage', () => ({ copyElementImageToClipboard: vi.fn(), saveElementImageAsPng: vi.fn() }));

import { MediaModal } from '../../../../ui/src/components/Modal/MediaModal';
import { renderMermaidToSvg } from '../../../../ui/src/components/Content/enhancements/mermaidRenderToSvg';
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

  it('does not render when closed before the deferred recolor begins', async () => {
    const mermaid = vi.mocked(renderMermaidToSvg);
    mermaid.mockClear();
    const onClose = vi.fn();
    const gallery: MediaGallery = { items: [{ type: 'svg', source: 'flowchart TD\nA-->B' }] };
    const { rerender } = render(<MediaModal gallery={gallery} onClose={onClose} />);
    rerender(<MediaModal gallery={null} onClose={onClose} />);
    await act(async () => {});
    expect(mermaid).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves the cached SVG untouched when a pending recolor resolves after close', async () => {
    const mermaid = vi.mocked(renderMermaidToSvg);
    mermaid.mockClear();
    let complete: (value: { svgHtml: string }) => void;
    mermaid.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const onClose = vi.fn();
    const original = '<svg id="original-pending">Original</svg>';
    const gallery: MediaGallery = { items: [{ type: 'svg', html: original, source: 'flowchart TD\nA-->B' }] };
    const { rerender } = render(<MediaModal gallery={gallery} onClose={onClose} />);
    mocks.stateRef.current = { theme: 'light', settings: { language: '' } };
    rerender(<MediaModal gallery={gallery} onClose={onClose} />);
    await waitFor(() => expect(mermaid).toHaveBeenCalledOnce());
    rerender(<MediaModal gallery={null} onClose={onClose} />);
    await act(async () => complete!({ svgHtml: '<svg id="stale">Stale</svg>' }));
    rerender(<MediaModal gallery={gallery} onClose={onClose} />);
    expect(document.querySelector('#original-pending')).toBeInTheDocument();
    expect(document.querySelector('#stale')).not.toBeInTheDocument();
  });

  it('wraps around a mixed gallery with the keyboard and buttons, resets the media transform, and closes on Escape or backdrop', () => {
    const t = getTranslations('en');
    const gallery: MediaGallery = { items: [{ type: 'img', src: '/docs/chart.png' }, { type: 'svg', html: '<svg aria-label="Chart"></svg>' }], currentIndex: 0 };
    const onClose = vi.fn();
    const { baseElement, rerender } = render(<MediaModal gallery={gallery} onClose={onClose} />);
    const image = baseElement.querySelector('img')!;
    expect(image).toHaveAttribute('src', '/docs/chart.png');
    const wrap = image.closest('.mdn-modal-content-wrap')!;
    fireEvent.mouseMove(wrap, { clientX: 75, clientY: 25 });
    expect(image.style.getPropertyValue('--pan-x')).toBe('0px');
    fireEvent.mouseDown(wrap, { clientX: 50, clientY: 30 });
    fireEvent.mouseMove(wrap, { clientX: 75, clientY: 25 });
    fireEvent.mouseLeave(wrap);
    expect(image.style.getPropertyValue('--pan-x')).toBe('25px');
    expect(image.style.getPropertyValue('--pan-y')).toBe('-5px');
    fireEvent.wheel(screen.getByRole('dialog'), { deltaY: -1 });
    expect(Number(image.style.getPropertyValue('--zoom'))).toBeGreaterThan(1);
    fireEvent.wheel(screen.getByRole('dialog'), { deltaY: 1 });
    expect(Number(image.style.getPropertyValue('--zoom'))).toBeCloseTo(1);
    fireEvent.click(screen.getByRole('button', { name: t.tooltips.zoomOut }));
    expect(Number(image.style.getPropertyValue('--zoom'))).toBeLessThan(1);
    fireEvent.click(screen.getByRole('button', { name: t.tooltips.resetZoom }));
    expect(image.style.getPropertyValue('--pan-x')).toBe('0px');

    fireEvent.click(screen.getByRole('button', { name: t.tooltips.zoomIn }));
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    const svg = baseElement.querySelector<HTMLElement>('.mdn-modal-content-svg')!;
    expect(svg.querySelector('svg')).toHaveAttribute('aria-label', 'Chart');
    expect(svg.style.getPropertyValue('--zoom')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: t.tooltips.next }));
    expect(baseElement.querySelector('img')).toHaveAttribute('src', '/docs/chart.png');
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(baseElement.querySelector('.mdn-modal-content-svg')).toBeInTheDocument();
    fireEvent.click(baseElement.querySelector('.mdn-modal-content-wrap')!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
    rerender(<MediaModal gallery={null} onClose={onClose} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['img', true, 'image.png'],
    ['svg', false, 'diagram.png'],
    ['img', new Error('Cannot read image'), 'image.png'],
  ] as const)('copies and saves %s, reporting the result %j', async (type, outcome, fileName) => {
    const copy = getTranslations('en').previewActions;
    const gallery: MediaGallery = { items: [{ type, src: '/docs/chart.png', html: '<svg aria-label="Chart"></svg>' }], currentIndex: 0 };
    const copyImage = vi.mocked(copyElementImageToClipboard);
    const saveImage = vi.mocked(saveElementImageAsPng);
    if (outcome instanceof Error) {
      copyImage.mockRejectedValueOnce(outcome);
      saveImage.mockRejectedValueOnce(outcome);
    } else {
      copyImage.mockResolvedValueOnce(outcome);
      saveImage.mockResolvedValueOnce(outcome);
    }
    const notice = vi.fn();
    window.addEventListener(ACTION_NOTICE_EVENT, notice);
    try {
      const { baseElement } = render(<MediaModal gallery={gallery} onClose={vi.fn()} />);
      const target = baseElement.querySelector(type === 'img' ? '.mdn-modal-content-img' : '.mdn-modal-content-svg');
      expect(target).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: copy.copyImage }));
      expect(copyImage).toHaveBeenLastCalledWith(target);
      const tone = outcome === true ? 'success' : 'error';
      await waitFor(() => expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({
        detail: { message: outcome === true ? copy.imageCopied : copy.copyFailed, tone },
      })));
      fireEvent.click(screen.getByRole('button', { name: copy.saveImagePng }));
      expect(saveImage).toHaveBeenLastCalledWith(target, fileName);
      await waitFor(() => expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({
        detail: { message: outcome === true ? copy.imageSaved : copy.imageSaveFailed, tone },
      })));
    } finally {
      window.removeEventListener(ACTION_NOTICE_EVENT, notice);
    }
  });

  it('replaces SVG innerHTML on theme flip while preserving zoom/pan CSS vars', async () => {
    const { baseElement, rerender } = render(
      <MediaModal gallery={mockGallery} onClose={() => {}} />,
    );
    const svgDiv = baseElement.querySelector('.mdn-modal-content-svg') as HTMLDivElement;
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
    const { baseElement, rerender } = render(<MediaModal gallery={galleryA} onClose={() => {}} />);
    let svgDiv = baseElement.querySelector('.mdn-modal-content-svg') as HTMLDivElement;
    expect(svgDiv).toBeTruthy();
    await waitFor(() => {
      expect(svgDiv.innerHTML).toContain('SNAPA');
    });
    expect(svgDiv.innerHTML).not.toContain('RECOLOR');

    // Close: gallery becomes null. MediaModal returns null but stays mounted,
    // so prevGalleryRef persists. The themed re-render effect early-returns on
    // `if (!gallery) return;` and does not touch prevGalleryRef for this tick.
    rerender(<MediaModal gallery={null} onClose={() => {}} />);
    expect(baseElement.querySelector('.mdn-modal-content-svg')).toBeNull();

    // Re-open with a NEW gallery B (different identity than galleryA): the
    // effect computes isNewGallery = (galleryB !== galleryA) = true → skip the
    // first dep-change, preserving B's snapshot. A naive isFirstRenderRef
    // would have been flipped to false during galleryA's first tick and would
    // NOT reset, so this test directly exercises the prevGalleryRef pattern.
    rerender(<MediaModal gallery={galleryB} onClose={() => {}} />);
    svgDiv = baseElement.querySelector('.mdn-modal-content-svg') as HTMLDivElement;
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
    const { baseElement } = render(
      <MediaModal gallery={galleryWithoutHtml} onClose={() => {}} />,
    );
    const svgDiv = baseElement.querySelector('.mdn-modal-content-svg') as HTMLDivElement;
    expect(svgDiv).toBeTruthy();
    await waitFor(() => {
      expect(svgDiv.innerHTML).toContain('mock-dark');
    });
  });

  it('keeps the re-rendered themed SVG across zoom, pan, and parent re-renders', async () => {
    const gallery: MediaGallery = {
      items: [{ type: 'svg', html: '<svg id="original">INIT</svg>', source: 'flowchart TD\nA-->B' }],
      currentIndex: 0,
    };
    const { baseElement, rerender } = render(
      <MediaModal gallery={gallery} onClose={() => {}} />,
    );
    const svgDiv = baseElement.querySelector('.mdn-modal-content-svg') as HTMLDivElement;
    expect(svgDiv.innerHTML).toContain('INIT');

    // Flip Dark -> Light
    mocks.stateRef.current = { ...mocks.stateRef.current, theme: 'light' };
    rerender(<MediaModal gallery={gallery} onClose={() => {}} />);

    await waitFor(() => {
      expect(svgDiv.innerHTML).toContain('mock-light');
    });

    // Trigger subsequent component re-renders via zoom, drag-pan, and parent rerender.
    fireEvent.click(screen.getByLabelText('Zoom In'));
    const wrap = baseElement.querySelector('.mdn-modal-content-wrap') as HTMLDivElement;
    fireEvent.mouseDown(wrap, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(wrap, { clientX: 35, clientY: 40 });
    fireEvent.mouseUp(wrap);
    rerender(<MediaModal gallery={gallery} onClose={() => {}} />);

    expect(svgDiv.innerHTML).toContain('mock-light');
    expect(svgDiv.innerHTML).not.toContain('INIT');
  });

  it('preserves snapshot on open at a non-zero currentIndex and re-renders on theme toggle', async () => {
    const multiGallery: MediaGallery = {
      items: [
        { type: 'img', src: 'https://example.com/first.png' },
        { type: 'svg', html: '<svg id="snap-second">SNAP-SECOND</svg>', source: 'flowchart TD\nX-->Y' },
      ],
      currentIndex: 1,
    };

    const { baseElement, rerender } = render(
      <MediaModal gallery={multiGallery} onClose={() => {}} />,
    );

    let svgDiv: HTMLDivElement | null = null;
    await waitFor(() => {
      svgDiv = baseElement.querySelector('.mdn-modal-content-svg') as HTMLDivElement | null;
      expect(svgDiv).toBeTruthy();
      expect(svgDiv!.innerHTML).toContain('SNAP-SECOND');
    });
    expect(svgDiv!.innerHTML).not.toContain('RECOLOR');

    // Toggle theme while viewing the second item
    mocks.stateRef.current = { ...mocks.stateRef.current, theme: 'light' };
    rerender(<MediaModal gallery={multiGallery} onClose={() => {}} />);

    await waitFor(() => {
      expect(svgDiv!.innerHTML).toContain('mock-light');
    });
    expect(svgDiv!.innerHTML).not.toContain('SNAP-SECOND');
  });
});
