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
