import { useMemo, useRef, useState } from 'react';
import type { GitRepositoryCommit } from '../../history/contracts';
import { layoutGitGraph } from '../../history/gitGraphLayout';
import { dispatchActionNotice } from '../../utils/actionNotice';
import { useCssVars } from '../../utils/useCssVars';
import { RepositoryCommitMenu } from './RepositoryCommitMenu';

interface GitCommitGraphProps {
  commits: readonly GitRepositoryCommit[];
  selectedOid: string | null;
  headLabel: string;
  browseLabel: string;
  onActivateRevision: (oid: string) => void;
  onReturnToHead: () => void;
}

interface OpenCommitMenu {
  readonly commit: GitRepositoryCommit;
  readonly anchor: HTMLElement;
}

const LANE_WIDTH = 14;
const ROW_HEIGHT = 52;

function copyCommitMeta(value: string, label: string): void {
  const clipboard = navigator.clipboard;
  if (!clipboard?.writeText) {
    dispatchActionNotice(`${label} could not be copied`, 'error');
    return;
  }
  void clipboard.writeText(value).then(
    () => dispatchActionNotice(`${label} copied`, 'success'),
    () => dispatchActionNotice(`${label} could not be copied`, 'error'),
  );
}

export function GitCommitGraph({
  commits,
  selectedOid,
  headLabel,
  browseLabel,
  onActivateRevision,
  onReturnToHead,
}: GitCommitGraphProps) {
  const layout = useMemo(() => layoutGitGraph(commits), [commits]);
  const [openMenu, setOpenMenu] = useState<OpenCommitMenu | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const graphWidth = Math.max(LANE_WIDTH * layout.laneCount + 8, 28);
  const graphHeight = ROW_HEIGHT * layout.nodes.length;
  const graphCssVars = useMemo(() => ({
    '--repository-history-graph-width': `${graphWidth}px`,
    '--repository-history-row-height': `${ROW_HEIGHT}px`,
  }), [graphWidth]);
  useCssVars(listRef, graphCssVars);
  const x = (lane: number) => 7 + lane * LANE_WIDTH;
  const y = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;

  return (
    <>
      <ol ref={listRef} className="repository-history__commits" aria-label={browseLabel}>
        <svg
          className="repository-history__graph-layer"
          width={graphWidth}
          height={graphHeight}
          viewBox={`0 0 ${graphWidth} ${graphHeight}`}
          aria-hidden="true"
          data-testid="repository-history-graph"
        >
          {layout.segments.map((segment) => {
            const startX = x(segment.fromLane);
            const endX = x(segment.toLane);
            const startY = y(segment.fromRow);
            const endY = segment.continuesBeyondWindow ? graphHeight : y(segment.toRow);
            const path = startX === endX
              ? `M ${startX} ${startY} L ${endX} ${endY}`
              : `M ${startX} ${startY} C ${startX} ${startY + ROW_HEIGHT / 2}, ${endX} ${endY - ROW_HEIGHT / 2}, ${endX} ${endY}`;
            return (
              <path
                key={`${segment.fromRow}:${segment.parentOid}`}
                d={path}
                className="repository-history__graph-edge"
              />
            );
          })}
          {layout.nodes.map((node) => (
            <circle
              key={node.commit.oid}
              cx={x(node.lane)}
              cy={y(node.row)}
              r="4"
              className="repository-history__graph-node"
            />
          ))}
        </svg>

        {layout.nodes.map((node) => {
          const isMenuOpen = openMenu?.commit.oid === node.commit.oid;
          return (
            <li
              key={node.commit.oid}
              className={`repository-history__commit${selectedOid === node.commit.oid ? ' is-selected' : ''}`}
              onClick={(event) => {
                if ((event.target as Element).closest('button')) return;
                setOpenMenu({ commit: node.commit, anchor: event.currentTarget });
              }}
            >
              <span className="repository-history__graph-spacer" aria-hidden="true" />
              <button
                type="button"
                className="repository-history__commit-button"
                aria-pressed={selectedOid === node.commit.oid}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={(event) => setOpenMenu({ commit: node.commit, anchor: event.currentTarget })}
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
          );
        })}
      </ol>

      {openMenu && (
        <RepositoryCommitMenu
          commit={openMenu.commit}
          anchor={openMenu.anchor}
          activeRevisionOid={selectedOid}
          onCopy={copyCommitMeta}
          onActivateRevision={onActivateRevision}
          onReturnToHead={onReturnToHead}
          onClose={() => setOpenMenu(null)}
        />
      )}
    </>
  );
}
