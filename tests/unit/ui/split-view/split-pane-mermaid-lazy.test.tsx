import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { DocumentEnvironmentContext, type DocumentEnvironment } from '../../../../ui/src/components/Content/DocumentEnvironmentContext';
import { SplitPaneDocument } from '../../../../ui/src/components/Content/SplitPaneDocument';
import { resetDocumentRoots } from '../../../../ui/src/document/activeDocumentRoot';
import type { PaneDocumentProjection } from '../../../../ui/src/split-view/paneSelectors';

// Records every Mermaid render and how many run concurrently across panes.
const mermaidRuns = vi.hoisted(() => ({ order: [] as string[], active: 0, peak: 0 }));

vi.mock('../../../../ui/src/lib/renderLibs', () => ({
  getMermaid: async () => ({
    initialize: () => {},
    run: async ({ nodes }: { nodes: HTMLElement[] }) => {
      mermaidRuns.active += 1;
      mermaidRuns.peak = Math.max(mermaidRuns.peak, mermaidRuns.active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      for (const node of nodes) {
        const root = node.closest('[data-document-root]')?.getAttribute('data-document-root');
        mermaidRuns.order.push(`${root}:${node.id}`);
        node.innerHTML = '<svg></svg>';
      }
      mermaidRuns.active -= 1;
    },
  }),
  getHighlightJs: async () => ({ highlightElement: () => {} }),
  getKatex: async () => ({ render: () => {} }),
  getChart: async () => ({}),
}));
vi.mock('../../../../ui/src/components/Modal/ScopeViewModal', () => ({ ScopeViewModal: () => null }));
vi.mock('../../../../ui/src/components/Bookmarks/BookmarkSelectionMenu', () => ({ BookmarkSelectionMenu: () => null }));

// Geometry comes from data attributes: the pane scroll container shows y=0..300,
// so a diagram at y=400 is inside the window (768px) but clipped by the pane.
const originalRect = HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = function rect(this: HTMLElement) {
    const top = Number(this.dataset.testTop ?? 0);
    const bottom = Number(this.dataset.testBottom ?? 0);
    return { top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  };
});
afterAll(() => { HTMLElement.prototype.getBoundingClientRect = originalRect; });
afterEach(() => {
  resetDocumentRoots();
  mermaidRuns.order.length = 0;
  mermaidRuns.active = 0;
  mermaidRuns.peak = 0;
});

const diagram = (id: string, top: number) => (
  `<div class="mdn-mermaid-wrap"><div class="mermaid" id="${id}" data-test-top="${top}" data-test-bottom="${top + 80}">graph TD; ${id}-->B</div></div>`
);
// Document order: clipped (y=400), far below (y=2000), visible in pane (y=100).
const HTML = [diagram('clipped', 400), diagram('far', 2000), diagram('visible', 100)].join('');

const projection: PaneDocumentProjection = {
  filePath: '/docs/a.md', relativePath: 'a.md', fileName: 'a.md', title: 'A', contentHtml: HTML,
  source: '# A', markdownSource: '# A', sourceDocumentText: '# A', mode: 'rendered', scrollTop: 0,
  renderRevision: 1, tab: {} as any, frontmatter: {}, toc: [], previewInfo: null, stale: false,
};

function Pane({ paneId }: { paneId: 'primary' | 'secondary' }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scrollRef} className="split-document-pane__scroll" data-test-top="0" data-test-bottom="300">
      <SplitPaneDocument paneId={paneId} projection={projection} mode="rendered" renderVersion={1} disabled={false}
        language="en" scrollRef={scrollRef} onSourceChange={() => {}} onSave={() => {}} />
    </div>
  );
}

function environment(theme: string): DocumentEnvironment {
  return {
    state: { ...initialState, theme, settings: { ...initialState.settings, language: 'en' } } as DocumentEnvironment['state'],
    bridge: { postMessage: () => {} },
    navigate: () => {},
    onImageClick: () => {},
    refresh: () => {},
  };
}

function SplitPanes({ theme }: { theme: string }): ReactNode {
  return (
    <DocumentEnvironmentContext.Provider value={environment(theme)}>
      <Pane paneId="primary" />
      <Pane paneId="secondary" />
    </DocumentEnvironmentContext.Provider>
  );
}

async function waitForRuns(count: number) {
  for (let i = 0; i < 200 && mermaidRuns.order.length < count; i += 1) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  }
}

const paneOrder = (paneId: string) => mermaidRuns.order.filter((entry) => entry.startsWith(`${paneId}:`)).map((entry) => entry.split(':')[1]);

describe('split pane Mermaid rendering', () => {
  it('renders each pane lazily: one diagram at a time, pane-visible diagrams first', async () => {
    render(<SplitPanes theme="light" />);
    await waitForRuns(6);

    expect(mermaidRuns.order).toHaveLength(6);
    expect(mermaidRuns.peak).toBe(1);
    expect(paneOrder('primary')).toEqual(['visible', 'clipped', 'far']);
    expect(paneOrder('secondary')).toEqual(['visible', 'clipped', 'far']);
  });

  it('rerenders pane diagrams one by one after a theme switch, visible diagrams first', async () => {
    const view = render(<SplitPanes theme="light" />);
    await waitForRuns(6);
    mermaidRuns.order.length = 0;
    mermaidRuns.peak = 0;

    view.rerender(<SplitPanes theme="dark" />);
    expect(mermaidRuns.order).toHaveLength(0);
    await waitForRuns(6);

    expect(mermaidRuns.order).toHaveLength(6);
    expect(mermaidRuns.peak).toBe(1);
    expect(paneOrder('primary')).toEqual(['visible', 'clipped', 'far']);
    expect(paneOrder('secondary')).toEqual(['visible', 'clipped', 'far']);
  });
});
