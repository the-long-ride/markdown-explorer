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
  it('assigns a stable lane and continuous segments to linear history', () => {
    const a = 'a'.repeat(40);
    const b = 'b'.repeat(40);
    const c = 'c'.repeat(40);
    const layout = layoutGitGraph([commit(a, [b]), commit(b, [c]), commit(c, [])]);
    expect(layout.nodes.map((node) => node.lane)).toEqual([0, 0, 0]);
    expect(layout.laneCount).toBe(1);
    expect(layout.segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromRow: 0, toRow: 1, fromLane: 0, toLane: 0, parentOid: b, continuesBeyondWindow: false }),
      expect.objectContaining({ fromRow: 1, toRow: 2, fromLane: 0, toLane: 0, parentOid: c, continuesBeyondWindow: false }),
    ]));
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
    expect(first.segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromRow: 0, parentOid: a, toRow: 1, toLane: 0 }),
      expect.objectContaining({ fromRow: 0, parentOid: b, toRow: 2, toLane: 1 }),
    ]));
  });

  it('extends an omitted parent to the bottom edge of the loaded window', () => {
    const layout = layoutGitGraph([commit('c2', ['missing'])]);
    expect(layout.segments).toEqual([
      {
        fromRow: 0,
        fromLane: 0,
        toRow: 1,
        toLane: 0,
        parentOid: 'missing',
        continuesBeyondWindow: true,
      },
    ]);
  });
});
