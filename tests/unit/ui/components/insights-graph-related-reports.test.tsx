import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';
import { GraphView } from '../../../../ui/src/components/Insights/GraphView';
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
    const clearBtn = screen.getByTitle(/clear selection/i);
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
});
