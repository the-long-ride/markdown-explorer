import type { GitRepositoryCommit } from './contracts';

export interface GitGraphParentLink {
  readonly oid: string;
  readonly lane: number;
}

export interface GitGraphNode {
  readonly commit: GitRepositoryCommit;
  readonly row: number;
  readonly lane: number;
  readonly parents: readonly GitGraphParentLink[];
}

export interface GitGraphSegment {
  readonly fromRow: number;
  readonly fromLane: number;
  readonly toRow: number;
  readonly toLane: number;
  readonly parentOid: string;
  readonly continuesBeyondWindow: boolean;
}

export interface GitGraphLayout {
  readonly nodes: readonly GitGraphNode[];
  readonly segments: readonly GitGraphSegment[];
  readonly laneCount: number;
}

function dedupeLanes(lanes: readonly string[]): string[] {
  const seen = new Set<string>();
  return lanes.filter((oid) => {
    if (!oid || seen.has(oid)) return false;
    seen.add(oid);
    return true;
  });
}

export function layoutGitGraph(commits: readonly GitRepositoryCommit[]): GitGraphLayout {
  let lanes: string[] = [];
  const nodes: GitGraphNode[] = [];
  let laneCount = 1;

  commits.forEach((commit, row) => {
    let lane = lanes.indexOf(commit.oid);
    if (lane < 0) {
      lane = lanes.length;
      lanes = [...lanes, commit.oid];
    }

    const next = [...lanes];
    next.splice(lane, 1, ...commit.parentOids);
    lanes = dedupeLanes(next);
    const parents = commit.parentOids.map((oid) => ({
      oid,
      lane: Math.max(0, lanes.indexOf(oid)),
    }));
    laneCount = Math.max(laneCount, lane + 1, lanes.length, ...parents.map((parent) => parent.lane + 1));
    nodes.push({ commit, row, lane, parents });
  });

  const byOid = new Map(nodes.map((node) => [node.commit.oid, node]));
  const segments: GitGraphSegment[] = [];
  for (const node of nodes) {
    for (const parent of node.parents) {
      const target = byOid.get(parent.oid);
      const toLane = target?.lane ?? parent.lane;
      laneCount = Math.max(laneCount, node.lane + 1, toLane + 1);
      segments.push({
        fromRow: node.row,
        fromLane: node.lane,
        toRow: target?.row ?? commits.length,
        toLane,
        parentOid: parent.oid,
        continuesBeyondWindow: !target,
      });
    }
  }

  return { nodes, segments, laneCount };
}
