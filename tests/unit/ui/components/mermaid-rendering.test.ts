import { describe, expect, it, vi } from 'vitest';
import {
  applyGanttIntrinsicWidth, enhanceMermaid, fitMermaidSvg, getMermaidRenderNodes, invalidateMermaidRendering, invalidateMermaidRenderings,
  polishMermaidSvg, resolveMermaidThemeOptions,
} from '../../../../ui/src/components/Content/enhancements/mermaidRendering';

function wrapper(source: string) {
  const root = document.createElement('div');
  root.className = 'mdn-mermaid-wrap';
  const node = root.appendChild(document.createElement('div'));
  node.className = 'mermaid';
  node.textContent = source;
  return { root, node };
}

function renderOptions() {
  const initialize = vi.fn();
  const onRawSvg = vi.fn();
  const run = vi.fn(async ({ nodes }: { nodes: HTMLElement[] }) => {
    nodes[0].innerHTML = '<svg viewBox="0 0 50 25" width="50"><text>diagram</text></svg>';
  });
  const getLibrary = vi.fn(async () => ({ initialize, run }));
  return { initialize, run, getLibrary, isDark: false, isCancelled: () => false, runIdRef: { current: 0 }, onRawSvg };
}

describe('Mermaid rendering', () => {
  it.each([
    ['zenuml\ntitle Welcome', 'zenuml', '<text>Welcome</text>'],
    ['architecture-beta\nservice serviceA(server)[Server]', 'architecture', '<text>Server</text>'],
  ])('preserves the native canvas for %s', async (source, kind, content) => {
    const { root, node } = wrapper(source);
    const options = renderOptions();
    options.run.mockImplementationOnce(async () => {
      node.innerHTML = `<svg viewBox="0 0 240 100">${content}</svg>`;
    });
    await enhanceMermaid(root, options);
    expect(root).toHaveAttribute('data-mdn-mermaid-kind', kind);
    expect(node.querySelector('svg')).toHaveAttribute('viewBox', '0 0 240 100');
    if (kind === 'zenuml') expect(node.querySelector('text')).toHaveAttribute('data-mdn-zenuml-title', 'true');
  });

  it('skips a diagram hidden during a previous render without skipping later diagrams', async () => {
    const { root, node } = wrapper('flowchart LR\nA --> B');
    const hidden = root.appendChild(wrapper('flowchart LR\nC --> D').node);
    const last = root.appendChild(wrapper('flowchart LR\nE --> F').node);
    const options = renderOptions();
    options.run.mockImplementationOnce(async () => {
      node.innerHTML = '<svg />';
      hidden.hidden = true;
    });
    await enhanceMermaid(root, options);
    expect(node.dataset.mdnRendered).toBe('true');
    expect(hidden.dataset.mdnRendered).toBeUndefined();
    expect(last.dataset.mdnRendered).toBe('true');
    expect(options.run).toHaveBeenCalledTimes(2);
  });

  it.each(['gantt\nTask : 2026-01-01, 7d', 'sankey-beta\nA,B,1'])('renders bare diagrams without measured wrappers (%s)', async (source) => {
    const { node } = wrapper(source);
    const root = document.createElement('div');
    root.appendChild(node);
    const options = renderOptions();
    await enhanceMermaid(root, options);
    expect(node.dataset.mdnRendered).toBe('true');
    expect(node.querySelector('svg')).not.toBeNull();
    invalidateMermaidRendering(node);
    expect(node.textContent).toBe(source);
    expect(node.dataset.mdnRendered).toBeUndefined();
  });

  it.each([false, true])('leaves a render owned by a different token undisturbed (rejects: %s)', async (reject) => {
    const { root, node } = wrapper('flowchart LR\n A --> B');
    const options = renderOptions();
    options.run.mockImplementationOnce(async () => {
      node.dataset.mdnRenderRun = 'replacement';
      node.innerHTML = '<svg><text>Replacement</text></svg>';
      if (reject) throw new Error('Old render failed');
    });
    await enhanceMermaid(root, options);
    expect(node.querySelector('text')).toHaveTextContent('Replacement');
    expect(node.dataset.mdnRenderRun).toBe('replacement');
    expect(node.dataset.mdnRendered).toBeUndefined();
    expect(node.dataset.mdnRenderAttempts).toBeUndefined();
    expect(options.onRawSvg).not.toHaveBeenCalled();
  });

  it('does not restore text for an untouched node with no recorded source', () => {
    const { node } = wrapper('unchanged source');
    invalidateMermaidRendering(node);
    expect(node.textContent).toBe('unchanged source');
  });
  it('assigns wide Gantt layout before render, publishes raw SVG, and restores source when invalidated', async () => {
    const source = 'gantt\nTask:2026-01-01, 7d';
    const { root, node } = wrapper(source);
    Object.defineProperty(root, 'clientWidth', { value: 1400 });
    node.dataset.processed = 'true';
    node.dataset.mdnRenderAttempts = '1';
    const options = renderOptions();
    await enhanceMermaid(root, options);
    expect(options.initialize).toHaveBeenCalledWith(expect.objectContaining({
      theme: 'base', gantt: expect.objectContaining({ useWidth: 1400 }),
    }));
    expect(options.onRawSvg).toHaveBeenCalledExactlyOnceWith(node, source, '<svg viewBox="0 0 50 25" width="50"><text>diagram</text></svg>');
    expect(node.querySelector('svg')).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    expect(root.style.overflowX).toBe('auto');
    expect(root.dataset.mdnMermaidKind).toBe('gantt');
    expect(getMermaidRenderNodes(root)).toEqual([node]);
    expect(node.dataset.mdnRenderAttempts).toBeUndefined();
    invalidateMermaidRenderings(root);
    expect(node).toHaveTextContent(source, { normalizeWhitespace: false });
    expect(root.dataset.mdnMermaidKind).toBeUndefined();
    expect(node.dataset.mdnRendered).toBeUndefined();
    expect(node.dataset.mdnRenderRun).toBeUndefined();
    expect(node).not.toHaveAttribute('data-processed');
  });

  it('prepares pre-rendered C4 SVG with the requested font without rerunning Mermaid', async () => {
    const { root, node } = wrapper('');
    node.dataset.originalCode = 'C4Context';
    node.innerHTML = '<svg><text><tspan>Label</tspan></text></svg>';
    const theme = document.createElement('div');
    theme.style.setProperty('--font-mermaid', 'monospace');
    const options = { ...renderOptions(), document: { documentElement: theme, defaultView: window } };
    await enhanceMermaid(root, options);
    expect(options.run).not.toHaveBeenCalled();
    expect(options.onRawSvg).not.toHaveBeenCalled();
    expect(options.initialize).toHaveBeenCalledWith(expect.objectContaining({
      fontFamily: 'monospace',
      c4: expect.objectContaining({ personFontFamily: 'monospace', person_bg_color: '#f7f7f8' }),
    }));
    expect(node).toHaveAttribute('data-mdn-rendered', 'true');
  });

  it('skips hidden, already rendered and terminally failed nodes before loading the library', async () => {
    const { root, node } = wrapper('flowchart LR');
    const rendered = node.cloneNode(true) as HTMLElement;
    const failed = node.cloneNode(true) as HTMLElement;
    node.hidden = true;
    rendered.dataset.mdnRendered = 'true';
    failed.dataset.mdnRenderError = 'true';
    root.append(rendered, failed);
    const options = renderOptions();
    await enhanceMermaid(root, { ...options, nodes: [node, rendered, failed] });
    expect(options.getLibrary).not.toHaveBeenCalled();
    expect(options.runIdRef.current).toBe(0);
  });

  it('handles a library without run and cancellation while the library loads', async () => {
    const { root } = wrapper('flowchart LR');
    const options = renderOptions();
    await enhanceMermaid(root, { ...options, getLibrary: async () => ({ initialize: options.initialize }) });
    await enhanceMermaid(root, { ...options, isCancelled: () => true });
    expect(options.initialize).not.toHaveBeenCalled();
    expect(options.runIdRef.current).toBe(0);
  });

  it.each([
    ['sequence', 'sequenceDiagram\nA->>B: Ping'],
    ['packet', 'packet-beta\n0-7: "Header"'],
    ['kanban', 'kanban\n  todo[Todo]'],
    ['sankey', 'sankey-beta\nA,B,1'],
  ])('prepares %s SVGs without cropping native diagram dimensions', async (kind, source) => {
    const { root, node } = wrapper(source);
    const { initialize, run, getLibrary } = renderOptions();
    await enhanceMermaid(root, { getLibrary, isDark: true, isCancelled: () => false, runIdRef: { current: 0 } });
    expect(run).toHaveBeenCalledOnce();
    expect(root).toHaveAttribute('data-mdn-mermaid-kind', kind);
    const svg = node.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 50 25');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (kind === 'sankey') {
      expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
        sankey: expect.objectContaining({ useMaxWidth: false }),
      }));
    }
  });

  it('restores source and retries an invalid library result once before marking a terminal error', async () => {
    const source = 'flowchart LR\nA --> B';
    const { root, node } = wrapper(source);
    const options = renderOptions();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    options.run.mockImplementationOnce(async () => { node.textContent = 'No SVG'; });
    options.run.mockRejectedValueOnce(new Error('Renderer failed'));
    await enhanceMermaid(root, options);
    expect(node.textContent).toBe(source);
    expect(node.dataset.mdnRenderAttempts).toBe('1');
    expect(node.dataset.mdnRenderError).toBeUndefined();
    await enhanceMermaid(root, options);
    expect(node.dataset.mdnRenderAttempts).toBe('2');
    expect(node.dataset.mdnRenderError).toBe('true');
    await enhanceMermaid(root, options);
    expect(options.run).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith('Mermaid diagram render error:', new Error('Renderer failed'));
    expect(getMermaidRenderNodes(root)).toEqual([]);
  });

  it.each([false, true])('drops stale render results without overwriting a newer result (error: %s)', async (fails) => {
    const { root, node } = wrapper('flowchart LR');
    const options = renderOptions();
    options.run.mockImplementation(async () => {
      options.runIdRef.current += 1;
      node.dataset.mdnRenderRun = String(options.runIdRef.current);
      node.innerHTML = '<svg><text>New render</text></svg>';
      if (fails) throw new Error('Stale failure');
    });
    await enhanceMermaid(root, options);
    expect(node).toHaveTextContent('New render');
    expect(node.dataset.mdnRenderRun).toBe('2');
    expect(node.dataset.mdnRenderAttempts).toBeUndefined();
    expect(options.onRawSvg).not.toHaveBeenCalled();
  });

  it.each([false, true])('restores the source if the current result is cancelled (error: %s)', async (fails) => {
    const { root, node } = wrapper('flowchart LR');
    let cancelled = false;
    const options = { ...renderOptions(), isCancelled: () => cancelled };
    options.run.mockImplementation(async () => {
      cancelled = true;
      node.dataset.processed = 'true';
      node.innerHTML = '<svg><text>Cancelled render</text></svg>';
      if (fails) throw new Error('Cancelled failure');
    });
    await enhanceMermaid(root, options);
    expect(node.textContent).toBe('flowchart LR');
    expect(node.dataset.mdnRenderRun).toBeUndefined();
    expect(node).not.toHaveAttribute('data-processed');
    expect(options.onRawSvg).not.toHaveBeenCalled();
  });

  it('selects categorical colors only for plots and pie charts with more than four slices', () => {
    const prefix = '---\ntitle: Sample\n"frontmatter": 1\n---\npie\n%% "comment": 2\n\nshowData\nnot a slice\n';
    const slices = Array.from({ length: 8 }, (_, i) => `"Slice ${i + 1}": ${i + 1}`);
    expect(resolveMermaidThemeOptions('pie', prefix + slices.slice(0, 4).join('\n'))).toEqual({});
    expect(resolveMermaidThemeOptions('pie', prefix + slices.slice(0, 5).join('\n'))).toEqual({ categoricalFills: true, softFillCount: 6 });
    expect(resolveMermaidThemeOptions('pie', prefix + slices.join('\n'))).toEqual({ categoricalFills: true, softFillCount: 8 });
    expect(resolveMermaidThemeOptions('quadrant', '')).toEqual({ categoricalFills: true, softFillCount: 4 });
    expect(resolveMermaidThemeOptions('xychart', '')).toEqual({ categoricalFills: true, softFillCount: 6 });
  });

  it('fits measurable SVG artwork while retaining the native viewbox for empty or hidden graphics', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const group = svg.appendChild(document.createElementNS(svg.namespaceURI, 'g'));
    const getBBox = vi.fn()
      .mockReturnValueOnce({ x: 8, y: 4, width: 20.5, height: 10 })
      .mockReturnValueOnce({ x: 8, y: 4, width: 20.5, height: 10 })
      .mockReturnValueOnce({ x: 8, y: 4, width: 20.5, height: 0 })
      .mockImplementationOnce(() => { throw new Error('not laid out'); });
    Object.assign(group, { getBBox });
    fitMermaidSvg(svg, -8);
    expect(svg).toHaveAttribute('viewBox', '8 4 20.5 10');
    expect(svg).toHaveAttribute('width', '21');
    fitMermaidSvg(svg, Number.NaN);
    expect(svg).toHaveAttribute('viewBox', '-4 -8 44.5 34');
    fitMermaidSvg(svg);
    fitMermaidSvg(svg);
    expect(svg).toHaveAttribute('viewBox', '-4 -8 44.5 34');
  });

  it('normalizes invalid transforms without touching valid geometry or native arrow strokes', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = `<path id="invalid" transform="translate(undefined,NaN)" />
      <path id="recoverable" transform="translate(8,4) rotate(NaN)" />
      <path id="arrow" class="arrow external" transform="translate(2 1)" vector-effect="non-scaling-stroke" />`;
    polishMermaidSvg(svg, 'architecture');
    expect(svg.querySelector('#invalid')).not.toHaveAttribute('transform');
    expect(svg.querySelector('#recoverable')).toHaveAttribute('transform', 'translate(8, 4)');
    expect(svg.querySelector('#recoverable')).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    expect(svg.querySelector('#arrow')).toHaveAttribute('transform', 'translate(2 1)');
    expect(svg.querySelector('#arrow')).not.toHaveAttribute('vector-effect');
  });

  it('removes authored stroke overrides and raises native Sankey labels', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = '<g class="node-labels"><text>Entry</text></g><g class="links"><path vector-effect="non-scaling-stroke" stroke-linecap="square" stroke-linejoin="bevel" /></g>';
    const path = svg.querySelector('path')!;
    polishMermaidSvg(svg, 'sankey');
    expect(path).not.toHaveAttribute('vector-effect');
    expect(path).not.toHaveAttribute('stroke-linecap');
    expect(path).not.toHaveAttribute('stroke-linejoin');
    expect(svg.lastElementChild).toHaveClass('node-labels');
  });

  it('computes intrinsic Gantt width from source when the host SVG width is invalid and no wrapper exists', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', 'auto');
    const width = applyGanttIntrinsicWidth(svg, null, 'gantt\nTask : 2026-01-01, 7d');
    expect(width).toBeGreaterThan(0);
    expect(svg).toHaveAttribute('width', String(width));
    expect(svg.style.minWidth).toBe(`${width}px`);
  });
});
