import { useMemo } from 'react';
import type { GitRepositoryCommit } from '../../history/contracts';
import { layoutGitGraph } from '../../history/gitGraphLayout';

interface GitCommitGraphProps {
  commits: readonly GitRepositoryCommit[];
  selectedOid: string | null;
  headLabel: string;
  browseLabel: string;
  onSelect: (oid: string) => void;
}

const LANE_WIDTH = 14;
const ROW_HEIGHT = 52;

export function GitCommitGraph({ commits, selectedOid, headLabel, browseLabel, onSelect }: GitCommitGraphProps) {
  const layout = useMemo(() => layoutGitGraph(commits), [commits]);
  const byOid = useMemo(() => new Map(layout.nodes.map((node) => [node.commit.oid, node])), [layout.nodes]);
  const graphWidth = Math.max(LANE_WIDTH * layout.laneCount + 8, 28);

  return (
    <ol className="repository-history__commits" aria-label={browseLabel}>
      {layout.nodes.map((node) => (
        <li key={node.commit.oid} className={`repository-history__commit${selectedOid === node.commit.oid ? ' is-selected' : ''}`}>
          <svg
            className="repository-history__graph-cell"
            width={graphWidth}
            height={ROW_HEIGHT}
            viewBox={`0 0 ${graphWidth} ${ROW_HEIGHT}`}
            aria-hidden="true"
          >
            {node.parents.map((parent) => {
              const target = byOid.get(parent.oid);
              if (!target) return null;
              const startX = 7 + node.lane * LANE_WIDTH;
              const endX = 7 + parent.lane * LANE_WIDTH;
              return (
                <path
                  key={parent.oid}
                  d={`M ${startX} ${ROW_HEIGHT / 2} C ${startX} ${ROW_HEIGHT}, ${endX} 0, ${endX} ${ROW_HEIGHT}`}
                  className="repository-history__graph-edge"
                />
              );
            })}
            <circle cx={7 + node.lane * LANE_WIDTH} cy={ROW_HEIGHT / 2} r="4" className="repository-history__graph-node" />
          </svg>
          <button
            type="button"
            className="repository-history__commit-button"
            aria-pressed={selectedOid === node.commit.oid}
            onClick={() => onSelect(node.commit.oid)}
          >
            <span className="repository-history__commit-subject">{node.commit.subject || node.commit.shortOid}</span>
            <span className="repository-history__commit-meta">
              <code>{node.commit.shortOid}</code>
              <span>{node.commit.author}</span>
              {node.commit.isHead && <span className="repository-history__head-badge">{headLabel}</span>}
            </span>
            {node.commit.refs.length > 0 && (
              <span className="repository-history__refs">{node.commit.refs.join(' · ')}</span>
            )}
          </button>
        </li>
      ))}
    </ol>
  );
}
