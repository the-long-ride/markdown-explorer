import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

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

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('renders straight away without an observer and reuses the dark-mode SVG when reopened', async () => {
    const { renderMermaidToSvg } = await import('../../../../ui/src/components/Content/enhancements/mermaidRenderToSvg.ts');
    const mockRender = vi.mocked(renderMermaidToSvg);
    mockRender.mockClear();
    vi.stubGlobal('IntersectionObserver', undefined);
    document.documentElement.dataset.themeMode = 'dark';
    const props = { code: 'graph LR; Cache-->Hit;', label: 'Cached diagram' };
    try {
      const first = render(<MermaidThumbnail {...props} />);
      expect(await screen.findByTestId('mock-svg')).toHaveClass('mock-svg-dark');
      expect(mockRender).toHaveBeenCalledExactlyOnceWith({ source: props.code, isDark: true });
      first.unmount();
      render(<MermaidThumbnail {...props} />);
      expect(await screen.findByTestId('mock-svg')).toHaveClass('mock-svg-dark');
      expect(mockRender).toHaveBeenCalledTimes(1);
    } finally {
      delete document.documentElement.dataset.themeMode;
    }
  });

  it('keeps a clickable placeholder after a render error and ignores a missing source', async () => {
    const { renderMermaidToSvg } = await import('../../../../ui/src/components/Content/enhancements/mermaidRenderToSvg.ts');
    const mockRender = vi.mocked(renderMermaidToSvg);
    mockRender.mockClear();
    mockRender.mockRejectedValueOnce(new Error('Parse error'));
    const onOpenMedia = vi.fn();
    const { rerender } = render(<MermaidThumbnail label="Diagram" onOpenMedia={onOpenMedia} />);
    expect(mockRender).not.toHaveBeenCalled();
    rerender(<MermaidThumbnail label="Diagram" code="graph LR; broken render" onOpenMedia={onOpenMedia} />);
    await act(async () => {});
    expect(mockRender).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByTestId('mermaid-thumbnail-placeholder'));
    expect(onOpenMedia).toHaveBeenCalledExactlyOnceWith();
  });

  it('limits concurrency to 2 simultaneous renders and queues remaining', async () => {
    const { renderMermaidToSvg } = await import('../../../../ui/src/components/Content/enhancements/mermaidRenderToSvg.ts');
    const mockFn = vi.mocked(renderMermaidToSvg);
    mockFn.mockClear();

    let resolveP1!: (value: any) => void;
    let resolveP2!: (value: any) => void;
    let resolveP3!: (value: any) => void;

    let callCount = 0;
    mockFn.mockImplementation(async () => {
      callCount++;
      const currentCall = callCount;
      if (currentCall === 1) {
        return new Promise(res => { resolveP1 = res; });
      }
      if (currentCall === 2) {
        return new Promise(res => { resolveP2 = res; });
      }
      return new Promise(res => { resolveP3 = res; });
    });

    render(
      <div>
        <MermaidThumbnail code="graph TD; A1-->B1;" label="D1" status="valid" />
        <MermaidThumbnail code="graph TD; A2-->B2;" label="D2" status="valid" />
        <MermaidThumbnail code="graph TD; A3-->B3;" label="D3" status="valid" />
      </div>
    );

    // Initial intersection should trigger only 2 concurrent renders
    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    // Resolve first render -> third task should pump and execute
    resolveP1({ svgHtml: '<svg><text>D1</text></svg>' });
    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    // Clean up pending promises
    resolveP2({ svgHtml: '<svg><text>D2</text></svg>' });
    resolveP3({ svgHtml: '<svg><text>D3</text></svg>' });
  });
});