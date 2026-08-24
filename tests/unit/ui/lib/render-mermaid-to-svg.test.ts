import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the mermaid bundle imported dynamically by `getMermaid()`. The mock
// mutates the scratch node's innerHTML the same way the real `mermaid.run`
// does so downstream `querySelector('svg')` finds a real SVGElement in jsdom.
const runMock = vi.fn(async ({ nodes }: { nodes: HTMLElement[] }) => {
  for (const node of nodes) {
    node.innerHTML = '<svg width="100" height="100"><rect width="50" height="50"/></svg>';
  }
});
const initializeMock = vi.fn();
vi.mock('mermaid', () => ({
  default: { initialize: initializeMock, run: runMock },
}));
vi.mock('@mermaid-js/mermaid-zenuml', () => ({
  default: { registerExternalDiagrams: async () => {} },
}));

import { renderMermaidToSvg } from '../../../../ui/src/components/Content/enhancements/mermaidRenderToSvg.ts';

describe('renderMermaidToSvg', () => {
  beforeEach(() => {
    runMock.mockClear();
    initializeMock.mockClear();
  });

  it('renders a mermaid source to svg html and returns it', async () => {
    const result = await renderMermaidToSvg({
      source: 'flowchart TD\nA-->B',
      isDark: false,
      document,
    });

    expect(result.svgHtml).toMatch(/<svg/);
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(initializeMock).toHaveBeenCalledTimes(1);
    const initArgs = initializeMock.mock.calls[0][0];
    expect(initArgs.theme).toBe('base');
    expect(initArgs.themeVariables).toEqual(expect.objectContaining({
      background: expect.any(String),
    }));
  });

  it('passes isDark through to theme tokens (initializes once per call)', async () => {
    await renderMermaidToSvg({ source: 'flowchart TD\nA-->B', isDark: true, document });
    const initArgs = initializeMock.mock.calls[0][0];
    expect(initArgs.themeVariables).toEqual(expect.objectContaining({
      background: expect.any(String),
    }));
  });

  it('rejects when mermaid produces no svg', async () => {
    runMock.mockImplementationOnce(async () => { /* leaves nodes untouched */ });
    await expect(
      renderMermaidToSvg({ source: 'flowchart TD\nA-->B', isDark: false, document }),
    ).rejects.toThrowError(/svg/);
  });

  // ── Bug B regression: the helper must attach an off-screen host to
  //    document.body while mermaid.run executes so mermaid can measure text
  //    via getBoundingClientRect / getComputedTextLength (a detached scratch
  //    node returns 0 for every measurement → degenerate SVG for
  //    layout-sensitive kinds like sequence / packet / kanban). The host is
  //    parked off-screen but kept visible: a visibility:hidden subtree breaks
  //    dagre's edge-label measurement and produces translate(undefined, NaN).
  //    The host must be removed via `finally` after the render so
  //    document.body is left clean even if mermaid.run rejects.
  describe('Bug B: in-DOM scratch host', () => {
    // Snapshot body's child count BEFORE the helper runs — RTL/jsdom may have
    // left stray elements from earlier siblings, so compare relatively.
    let bodyBaseline: number;

    beforeEach(() => {
      bodyBaseline = document.body.children.length;
    });

    const findHost = () =>
      Array.from(document.body.children).find(
        (el) =>
          el.tagName === 'DIV' &&
          (el as HTMLElement).style?.position === 'absolute' &&
          (el as HTMLElement).style?.left === '-9999px',
      ) as HTMLElement | undefined;

    it('appends an off-screen host to document.body while mermaid.run executes', async () => {
      let bodyCountDuringRun: number | undefined;
      let hostDuringRun: HTMLElement | undefined;
      runMock.mockImplementationOnce(async ({ nodes }: { nodes: HTMLElement[] }) => {
        bodyCountDuringRun = document.body.children.length;
        hostDuringRun = findHost();
        for (const node of nodes) {
          node.innerHTML = '<svg width="100" height="100"><rect width="50" height="50"/></svg>';
        }
      });

      await renderMermaidToSvg({ source: 'flowchart TD\nA-->B', isDark: false, document });

      // While mermaid.run was in-flight, document.body had ONE extra child.
      expect(bodyCountDuringRun).toBe(bodyBaseline + 1);
      // ...and that extra child was the off-screen host, visible so that
      // dagre can measure edge labels without NaN positions.
      expect(hostDuringRun).toBeTruthy();
      expect(hostDuringRun!.style.position).toBe('absolute');
      expect(hostDuringRun!.style.visibility).not.toBe('hidden');
      expect(hostDuringRun!.style.left).toBe('-9999px');
      expect(hostDuringRun!.getAttribute('aria-hidden')).toBe('true');
    });

    it('removes the host from document.body after the render completes', async () => {
      const before = document.body.children.length;
      await renderMermaidToSvg({ source: 'flowchart TD\nA-->B', isDark: false, document });
      expect(document.body.children.length).toBe(before);
      expect(findHost()).toBeUndefined();
    });

    it('removes the host from document.body even when mermaid.run rejects', async () => {
      runMock.mockImplementationOnce(async () => {
        // While rejecting, mermaid's run leaves the host in body — only the
        // `finally` block should remove it.
        expect(findHost()).toBeTruthy();
        throw new Error('mermaid boom');
      });
      const before = document.body.children.length;
      await expect(
        renderMermaidToSvg({ source: 'flowchart TD\nA-->B', isDark: false, document }),
      ).rejects.toThrowError(/mermaid boom/);
      expect(document.body.children.length).toBe(before);
      expect(findHost()).toBeUndefined();
    });
  });
});
