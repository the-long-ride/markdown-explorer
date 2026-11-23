import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';
import { buildFocusedGraph } from '../../../../ui/src/insights/graph';

function snapshot(count = 6) {
  const index = new WorkspaceInsightsIndex();
  index.applyDocument(analyzeDocument({ path: 'hub.md', source: '---\ntags: [t]\n---\n# Shared\n[[n1]]', revision: '1' }));
  for (let i = 1; i <= count; i += 1) {
    index.applyDocument(analyzeDocument({ path: `n${i}.md`, source: `---\ntags: [t${i % 2 ? '' : 'x'}]\n---\n# Shared\n`, revision: '1' }));
  }
  return index.snapshot();
}

describe('buildFocusedGraph secondary nodes', () => {
  it('adds inferred neighbors, tag and heading nodes under the cap', () => {
    const graph = buildFocusedGraph(snapshot(), { centerPath: 'missing.md', nodeCap: 60, includeInferred: true, showTags: true, showHeadings: true });
    expect(graph.nodes.some(node => node.kind === 'tag')).toBe(true);
    expect(graph.nodes.some(node => node.kind === 'heading')).toBe(true);
    expect(graph.edges.some(edge => edge.kind === 'inferred')).toBe(true);
    const capped = buildFocusedGraph(snapshot(30), { centerPath: 'hub.md', nodeCap: 3, includeInferred: true, showTags: true, showHeadings: true });
    expect(capped.nodes.length).toBeLessThanOrEqual(3);
    const big = buildFocusedGraph(snapshot(40), { nodeCap: 200 });
    expect(big.nodes.length).toBeGreaterThan(30);
  });

  it('handles empty workspaces', () => {
    const graph = buildFocusedGraph(new WorkspaceInsightsIndex().snapshot(), { nodeCap: 0, showTags: true });
    expect(graph.nodes).toEqual([]);
  });
});
