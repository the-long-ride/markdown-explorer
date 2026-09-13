import { describe, expect, it } from 'vitest';
import type { GitRepositoryCommit } from '../../../../ui/src/history/contracts';
import { layoutGitGraph } from '../../../../ui/src/history/gitGraphLayout';

function commit(oid: string, parentOids: readonly string[]): GitRepositoryCommit {
  return {
    oid,
    shortOid: oid.slice(0, 7),
    parentOids,
    author: 'Dev',
    authoredAt: '2026-09-13T00:00:00Z',
    subject: oid,
    refs: [],
    isHead: false,
  };
}

describe('git graph layout', () => {
  it('assigns a stable lane to linear history', () => {
    const a = 'a'.repeat(40);
    const b = 'b'.repeat(40);
    const c = 'c'.repeat(40);
    const layout = layoutGitGraph([commit(a, [b]), commit(b, [c]), commit(c, [])]);
    expect(layout.nodes.map((node) => node.lane)).toEqual([0, 0, 0]);
    expect(layout.laneCount).toBe(1);
  });

  it('creates deterministic adjacent lanes for merge parents and rejoins them', () => {
    const m = '1'.repeat(40);
    const a = '2'.repeat(40);
    const b = '3'.repeat(40);
    const root = '4'.repeat(40);
    const commits = [commit(m, [a, b]), commit(a, [root]), commit(b, [root]), commit(root, [])];
    const first = layoutGitGraph(commits);
    const second = layoutGitGraph(commits);

    expect(first).toEqual(second);
    expect(first.nodes[0].parents).toEqual([{ oid: a, lane: 0 }, { oid: b, lane: 1 }]);
    expect(first.laneCount).toBeGreaterThanOrEqual(2);
    expect(first.nodes.find((node) => node.commit.oid === root)?.lane).toBe(0);
  });
});
