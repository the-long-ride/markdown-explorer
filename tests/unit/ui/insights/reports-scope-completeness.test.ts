import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';
import { createInsightsJsonReport, createInsightsMarkdownReport } from '../../../../ui/src/insights/reports';

function snapshot() {
  const index = new WorkspaceInsightsIndex();
  const docs = [
    analyzeDocument({ path: 'a.md', source: '# A | pipe\n[[b#Part]]\n[[c]]\n[x](missing.md#frag)\n[y](gone.md)\n```mermaid\ngraph TD; A-->B\n```\n', revision: '1' }),
    analyzeDocument({ path: 'b.md', source: '# Part\n[[A]]\n[z](nope.md)\n', revision: '1' }),
    analyzeDocument({ path: 'c.md', source: '# C\n', revision: '1' }),
  ];
  docs.forEach(doc => index.applyDocument(doc));
  return index.snapshot();
}

describe('insights reports scope and completeness', () => {
  it('reports every document with sorted links and fragments', () => {
    const report = JSON.parse(createInsightsJsonReport(snapshot(), { generatedAt: 'now' }));
    expect(report.scope).toEqual({ kind: 'all' });
    expect(report.documents.map((d: any) => d.path)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(report.resolvedLinks.length).toBeGreaterThan(1);
    expect(report.resolvedLinks.some((l: any) => l.fragment)).toBe(true);
    expect(report.brokenLinks.length).toBeGreaterThan(1);
    expect(report.documents[0].diagrams.length).toBe(1);
    expect(report.completeness).toEqual({ provisional: false, truncated: false, warnings: [] });
  });

  it('limits to scoped paths and renders markdown status variants', () => {
    const snap = snapshot();
    const scoped = JSON.parse(createInsightsJsonReport(snap, { scope: { kind: 'paths', paths: ['b.md', 'zzz.md'] } }));
    expect(scoped.documents.map((d: any) => d.path)).toEqual(['b.md']);
    expect(scoped.brokenLinks.every((l: any) => l.sourcePath === 'b.md')).toBe(true);
    expect(createInsightsMarkdownReport(snap)).toContain('Status: **Complete**');
    expect(createInsightsMarkdownReport(snap, { completeness: { provisional: true } })).toContain('Provisional');
    const truncated = createInsightsMarkdownReport(snap, { completeness: { truncated: true } });
    expect(truncated).toContain('Complete with warnings');
    expect(truncated).toContain('truncated');
    const warned = createInsightsMarkdownReport(snap, { completeness: { warnings: ['w1'] } });
    expect(warned).toContain('## Warnings');
    expect(warned).toContain('- w1');
    const full = createInsightsMarkdownReport(snap);
    expect(full).toContain('## Broken links');
    expect(full).toContain('missing.md#frag');
    expect(full).toContain('A \\| pipe');
    expect(createInsightsMarkdownReport(snap, { scope: { kind: 'paths', paths: ['c.md'] } })).not.toContain('## Broken links');
  });
});
