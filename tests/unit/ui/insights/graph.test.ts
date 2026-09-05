import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';
import { buildFocusedGraph } from '../../../../ui/src/insights/graph';

function snapshot() {
  const index = new WorkspaceInsightsIndex();
  index.applyDocument(analyzeDocument({ path: 'a.md', source: '# A\n[[B]]\n[[C]] #shared', revision: 'a' }));
  index.applyDocument(analyzeDocument({ path: 'b.md', source: '# B\n[[D]] #shared', revision: 'b' }));
  index.applyDocument(analyzeDocument({ path: 'c.md', source: '# C', revision: 'c' }));
  index.applyDocument(analyzeDocument({ path: 'd.md', source: '# D', revision: 'd' }));
  return index.snapshot();
}

describe('buildFocusedGraph', () => {
  it('produces deterministic coordinates for the same graph state', () => {
    const first = buildFocusedGraph(snapshot(), { centerPath: 'a.md', nodeCap: 100, includeInferred: false });
    const second = buildFocusedGraph(snapshot(), { centerPath: 'a.md', nodeCap: 100, includeInferred: false });
    expect(first.nodes).toEqual(second.nodes);
    expect(first.edges).toEqual(second.edges);
    expect(first.nodes.find(node => node.id === 'a.md')).toMatchObject({ x: 0, y: 0 });
  });

  it('prioritizes explicit neighbors, enforces the visible-node cap, and reports hidden count', () => {
    const graph = buildFocusedGraph(snapshot(), { centerPath: 'a.md', nodeCap: 3, includeInferred: true });
    expect(graph.nodes.map(node => node.id)).toEqual(expect.arrayContaining(['a.md', 'b.md', 'c.md']));
    expect(graph.nodes).toHaveLength(3);
    expect(graph.hiddenCount).toBeGreaterThan(0);
    expect(graph.edges.some(edge => edge.kind === 'explicit')).toBe(true);
  });
});
