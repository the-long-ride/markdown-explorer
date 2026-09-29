import { describe, expect, it } from 'vitest';
import type { GitRepositoryCommit } from '../../../../ui/src/history/contracts';
import { layoutGitGraph, rowMaxLanes } from '../../../../ui/src/history/gitGraphLayout';
import { getRowMaxLane } from '../../../../ui/src/components/History/GitCommitGraph';

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

describe('rowMaxLanes', () => {
  it('matches the per-row scan for a branchy 300 commit history', () => {
    let seed = 7;
    const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const oids = Array.from({ length: 300 }, (_, index) => index.toString(16).padStart(40, '0'));
    const commits = oids.map((oid, index) => {
      const parents: string[] = [];
      if (index + 1 < oids.length) parents.push(oids[index + 1 + Math.floor(random() * Math.min(3, oids.length - index - 1))]);
      if (random() < 0.2 && index + 5 < oids.length) parents.push(oids[index + 2 + Math.floor(random() * 3)]);
      if (random() < 0.05) parents.push('f'.repeat(40));
      return commit(oid, [...new Set(parents)]);
    });
    const layout = layoutGitGraph(commits);

    expect(rowMaxLanes(layout)).toEqual(layout.nodes.map((node) => getRowMaxLane(node.row, layout)));
  });
});
