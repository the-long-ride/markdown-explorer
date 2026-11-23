import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';
import { GraphView } from '../../../../ui/src/components/Insights/GraphView';
import { INSIGHTS_TRANSLATIONS } from '../../../../ui/src/contexts/insightsTranslations';
import { RelatedView } from '../../../../ui/src/components/Insights/RelatedView';
import { LinksView } from '../../../../ui/src/components/Insights/LinksView';
import { createInsightsJsonReport, createInsightsMarkdownReport } from '../../../../ui/src/insights/reports';

function doc(path: string, source: string) {
  return analyzeDocument({ path, source, revision: `${path}-1` });
}

function fixture() {
  const a = doc('a.md', '---\ntags: [docs, api]\n---\n# API Guide\n[[b]]\nAuthentication refresh tokens.');
  const b = doc('b.md', '---\ntags: [docs, api]\n---\n# API Reference\nAuthentication refresh tokens and sessions.');
  const c = doc('c.md', '# Unrelated\nCompletely different material.');
  const index = new WorkspaceInsightsIndex();
  index.applyDocument(a); index.applyDocument(b); index.applyDocument(c);
  return { documents: [a, b, c], snapshot: index.snapshot() };
}

describe('Insights Graph, Related, external checks, and reports', () => {
  it('keeps SVG graph selection synchronized with the accessible list', async () => {
    const { snapshot } = fixture();
    const user = userEvent.setup();
    render(<GraphView snapshot={snapshot} nodeCap={100} />);
    await user.click(screen.getByRole('button', { name: /api reference/i }));
    expect(screen.getByRole('button', { name: /api reference/i })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('graph-node-b.md')).toHaveAttribute('data-selected', 'true');
  });

  it('renders an empty graph, then exposes the number of documents hidden by the node cap', () => {
    const labels = INSIGHTS_TRANSLATIONS.en;
    const empty = new WorkspaceInsightsIndex().snapshot();
    const { rerender } = render(<GraphView snapshot={empty} />);
    expect(screen.getByText(labels.noGraphConnections)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: labels.graphAria })).not.toBeInTheDocument();
    const { snapshot } = fixture();
    rerender(<GraphView snapshot={snapshot} centerPath="b.md" nodeCap={1} />);
    expect(screen.getByText(/\(\+2\)/)).toHaveAttribute('data-hover-tooltip', expect.stringContaining('2'));
    expect(screen.getByTestId('graph-node-b.md')).toHaveAttribute('data-selected', 'true');
    expect(screen.queryByTestId('graph-node-a.md')).not.toBeInTheDocument();
  });

  it('pans on the canvas, supports wheel zoom, and resets both transforms', () => {
    const { snapshot } = fixture();
    const labels = INSIGHTS_TRANSLATIONS.en;
    render(<GraphView snapshot={snapshot} />);
    const canvas = screen.getByRole('img', { name: labels.graphAria });
    const transform = canvas.querySelector('g')!;
    const drag = (target: Element, type: string, x: number, y: number) =>
      fireEvent(target, new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    drag(screen.getByTestId('graph-node-a.md'), 'pointerdown', 2, 3);
    drag(canvas, 'pointermove', 120, 90);
    expect(transform).toHaveAttribute('transform', 'translate(0 0) scale(1)');
    drag(canvas, 'pointerdown', 100, 90);
    expect(canvas).toHaveClass('is-dragging');
    drag(canvas, 'pointermove', 130, 115);
    expect(transform).toHaveAttribute('transform', 'translate(30 25) scale(1)');
    drag(canvas, 'pointercancel', 130, 115);
    expect(canvas).not.toHaveClass('is-dragging');
    fireEvent.wheel(canvas, { deltaY: -10, cancelable: true });
    expect(transform).toHaveAttribute('transform', 'translate(30 25) scale(1.15)');
    fireEvent.wheel(canvas, { deltaY: 10, cancelable: false });
    expect(transform).not.toHaveAttribute('transform', 'translate(30 25) scale(1.15)');
    fireEvent.click(screen.getByRole('button', { name: labels.zoomOut }));
    fireEvent.click(screen.getByRole('button', { name: labels.zoomIn }));
    fireEvent.click(screen.getByRole('button', { name: labels.resetZoom }));
    expect(transform).toHaveAttribute('transform', 'translate(0 0) scale(1)');
    fireEvent.click(canvas);
    expect(screen.queryByRole('button', { name: labels.clearSelection })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: labels.toggleFullscreen }));
    expect(screen.getByRole('button', { name: labels.exitFullscreen })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: labels.toggleFullscreen })).toBeInTheDocument();
  });

  it('finds paths, headings and aliases; supports keyboard selection and outside dismissal', () => {
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(doc('notes/guide.md', '---\naliases: [Manual]\n---\n# Guide\n## Deploying'));
    index.applyDocument(doc('reference.md', '# Reference'));
    const onSelectPath = vi.fn();
    const labels = INSIGHTS_TRANSLATIONS.en;
    render(<GraphView snapshot={index.snapshot()} onSelectPath={onSelectPath} />);
    const search = screen.getByRole('searchbox', { name: labels.searchNodesPlaceholder });
    for (const [query, matchType] of [['notes/', 'path'], ['deploying', 'heading'], ['manual', 'alias']]) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.getByRole('option')).toHaveTextContent(matchType);
      expect(screen.getByTestId('graph-node-reference.md')).toHaveClass('is-dimmed');
      fireEvent.mouseDown(search);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    }
    fireEvent.focus(search);
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onSelectPath).toHaveBeenCalledExactlyOnceWith('notes/guide.md');
    fireEvent.change(search, { target: { value: 'not in the graph' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onSelectPath).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0 found')).toBeInTheDocument();
  });

  it('supports graph node search, zoom controls, and fullscreen toggle', async () => {
    const { snapshot } = fixture();
    const onSelectPath = vi.fn();
    const user = userEvent.setup();
    render(<GraphView snapshot={snapshot} nodeCap={100} onSelectPath={onSelectPath} />);

    // Controls exist
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /reset zoom/i })).toBeVisible();
    const fsBtn = screen.getByRole('button', { name: /fullscreen/i });
    expect(fsBtn).toBeVisible();

    // Toggle fullscreen
    await user.click(fsBtn);
    expect(document.querySelector('.insights-graph--fullscreen, .insights-graph.is-fullscreen')).toBeInTheDocument();

    // Node search
    const searchInput = screen.getByLabelText(/search nodes/i);
    await user.type(searchInput, 'API Reference');
    expect(screen.getByText(/1 found/i)).toBeVisible();

    // Matched node is highlighted
    const nodeB = screen.getByTestId('graph-node-b.md');
    expect(nodeB).toHaveClass('is-highlighted');

    // Clicking node calls onSelectPath
    await user.click(nodeB);
    expect(onSelectPath).toHaveBeenCalledWith('b.md');
  });

  it('highlights multi-level relationships with lighter level colors when a node is clicked', async () => {
    const a = doc('a.md', '# A\n[[b.md]]');
    const b = doc('b.md', '# B\n[[d.md]]');
    const d = doc('d.md', '# D');
    const c = doc('c.md', '# Unrelated');
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(a); index.applyDocument(b); index.applyDocument(d); index.applyDocument(c);
    const user = userEvent.setup();
    render(<GraphView snapshot={index.snapshot()} centerPath="a.md" />);

    // a.md is selected (level 0)
    const nodeA = screen.getByTestId('graph-node-a.md');
    expect(nodeA).toHaveClass('is-rel-0');

    // b.md is 1st degree neighbor (level 1)
    const nodeB = screen.getByTestId('graph-node-b.md');
    expect(nodeB).toHaveClass('is-rel-1');

    // d.md is 2nd degree neighbor (level 2)
    const nodeD = screen.getByTestId('graph-node-d.md');
    expect(nodeD).toHaveClass('is-rel-2');

    // c.md is unconnected (unrelated)
    const nodeC = screen.getByTestId('graph-node-c.md');
    expect(nodeC).toHaveClass('is-unrelated');

    // Relationship stats summary is visible
    expect(screen.getByText(/Rel:/)).toBeVisible();
    expect(screen.getByText('1st')).toBeVisible();
    expect(screen.getByText('2nd')).toBeVisible();

    // Clicking clear resets selection
    const clearBtn = screen.getByRole('button', { name: /clear selection/i });
    await user.click(clearBtn);
    expect(nodeA).not.toHaveClass('is-rel-0');
  });

  it('searches nodes by text including tags and headings, providing interactive dropdown selection', async () => {
    const a = doc('a.md', '---\ntags: [secret-tag]\n---\n# Guide\n## Deep Architecture\nSome body text');
    const b = doc('b.md', '# Other\nContent');
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(a); index.applyDocument(b);
    const user = userEvent.setup();
    render(<GraphView snapshot={index.snapshot()} />);

    // Search by tag
    const searchInput = screen.getByLabelText(/search nodes/i);
    await user.type(searchInput, 'secret-tag');
    expect(screen.getByText(/1 found/i)).toBeVisible();

    // Dropdown shows matching option with badge
    const option = screen.getByRole('option', { name: /Guide.*tag/i });
    expect(option).toBeVisible();

    // Clicking option selects node
    await user.click(option);
    expect(screen.getByTestId('graph-node-a.md')).toHaveAttribute('data-selected', 'true');
  });

  it('ranks related documents with explainable evidence', () => {
    const { documents } = fixture();
    render(<RelatedView documents={documents} selectedPath="a.md" />);
    expect(screen.getByText('API Reference')).toBeVisible();
    expect(screen.getByText(/shared tags.*api.*docs/i)).toBeVisible();
    expect(screen.getByText(/score/i)).toBeVisible();
  });

  it('checks unique external URLs only after explicit user action', async () => {
    const remote = doc('remote.md', '# Remote\n[x](https://example.test/path) [again](https://example.test/path)');
    const index = new WorkspaceInsightsIndex(); index.applyDocument(remote);
    const onCheckExternalLinks = vi.fn(async () => []);
    const user = userEvent.setup();
    render(<LinksView snapshot={index.snapshot()} documents={[remote]} externalResults={new Map()} externalCheckingEnabled onCheckExternalLinks={onCheckExternalLinks} />);
    expect(onCheckExternalLinks).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /check external links/i }));
    expect(onCheckExternalLinks).toHaveBeenCalledWith(['https://example.test/path']);
  });

  it('exports scoped privacy-safe Markdown and JSON snapshots with completeness metadata', () => {
    const { snapshot } = fixture();
    const jsonText = createInsightsJsonReport(snapshot, {
      scope: { kind: 'paths', paths: ['a.md'] },
      completeness: { provisional: true, warnings: ['b.md unreadable'] },
    });
    const parsed = JSON.parse(jsonText);
    expect(parsed.documents.map((item: any) => item.path)).toEqual(['a.md']);
    expect(parsed.completeness.provisional).toBe(true);
    expect(jsonText).not.toContain('Authentication refresh tokens.');

    const markdown = createInsightsMarkdownReport(snapshot, {
      scope: { kind: 'paths', paths: ['a.md'] },
      completeness: { provisional: true, warnings: ['b.md unreadable'] },
    });
    expect(markdown).toContain('Workspace Insights');
    expect(markdown).toContain('Provisional');
    expect(markdown).toContain('a.md');
    expect(markdown).not.toContain('Authentication refresh tokens.');
  });

  it('copies AI prompt to fix graph and link issues', () => {
    const { snapshot } = fixture();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
    render(<GraphView snapshot={snapshot} nodeCap={100} />);
    const copyBtn = screen.getByRole('button', { name: /copy prompt for ai agent to fix graph & link issues/i });
    expect(copyBtn).toBeVisible();
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledOnce();
    const copiedText = writeText.mock.calls[0][0];
    expect(copiedText).toBeDefined();
    expect(copiedText.length).toBeGreaterThan(0);
  });
});
