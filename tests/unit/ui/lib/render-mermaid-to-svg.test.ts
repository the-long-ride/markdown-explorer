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
});
