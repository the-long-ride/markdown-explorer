import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GitRepositoryCommit } from '../../history/contracts';
import { layoutGitGraph, rowMaxLanes, type GitGraphLayout, type GitGraphNode } from '../../history/gitGraphLayout';
import { dispatchActionNotice } from '../../utils/actionNotice';
import { useCssVars } from '../../utils/useCssVars';
import { RepositoryCommitMenu } from './RepositoryCommitMenu';
import { useVisibleRowRange } from './useVisibleRowRange';

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

export interface HoveredNodeState {
  readonly commit: GitRepositoryCommit;
  readonly anchorRect: DOMRect;
}

export const LANE_WIDTH = 10;
export const ROW_HEIGHT = 52;
export const GRAPH_PADDING_X = 6;

export function getLaneX(lane: number): number {
  return GRAPH_PADDING_X + lane * LANE_WIDTH;
}

export function getRowY(row: number): number {
  return row * ROW_HEIGHT + ROW_HEIGHT / 2;
}

export function getRowMaxLane(row: number, layout: GitGraphLayout): number {
  let maxLane = layout.nodes[row]?.lane ?? 0;
  for (const s of layout.segments) {
    if (s.fromRow <= row && (s.continuesBeyondWindow || s.toRow >= row)) {
      maxLane = Math.max(maxLane, s.fromLane, s.toLane);
    }
  }
  return maxLane;
}

export function getRowSpacerWidth(row: number, layout: GitGraphLayout): number {
  return getLaneX(getRowMaxLane(row, layout)) + 14;
}

export function getSegmentPath(segment: {
  readonly fromRow: number;
  readonly fromLane: number;
  readonly toRow: number;
  readonly toLane: number;
  readonly continuesBeyondWindow: boolean;
}, graphHeight: number): string {
  const startX = getLaneX(segment.fromLane);
  const endX = getLaneX(segment.toLane);
  const startY = getRowY(segment.fromRow);
  const endY = segment.continuesBeyondWindow ? graphHeight : getRowY(segment.toRow);

  if (startX === endX) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  if (segment.fromLane < segment.toLane) {
    const turnEndY = startY + ROW_HEIGHT;
    if (turnEndY >= endY) {
      return `M ${startX} ${startY} C ${startX} ${startY + ROW_HEIGHT / 2}, ${endX} ${endY - ROW_HEIGHT / 2}, ${endX} ${endY}`;
    }
    return `M ${startX} ${startY} C ${startX} ${startY + ROW_HEIGHT / 2}, ${endX} ${turnEndY - ROW_HEIGHT / 2}, ${endX} ${turnEndY} L ${endX} ${endY}`;
  }

  if (segment.continuesBeyondWindow) {
    const turnEndY = startY + ROW_HEIGHT;
    if (turnEndY >= endY) {
      return `M ${startX} ${startY} C ${startX} ${startY + ROW_HEIGHT / 2}, ${endX} ${endY - ROW_HEIGHT / 2}, ${endX} ${endY}`;
    }
    return `M ${startX} ${startY} C ${startX} ${startY + ROW_HEIGHT / 2}, ${endX} ${turnEndY - ROW_HEIGHT / 2}, ${endX} ${turnEndY} L ${endX} ${endY}`;
  }

  if (segment.toRow <= segment.fromRow + 1) {
    return `M ${startX} ${startY} C ${startX} ${startY + ROW_HEIGHT / 2}, ${endX} ${endY - ROW_HEIGHT / 2}, ${endX} ${endY}`;
  }

  const turnStartY = endY - ROW_HEIGHT;
  return `M ${startX} ${startY} L ${startX} ${turnStartY} C ${startX} ${turnStartY + ROW_HEIGHT / 2}, ${endX} ${endY - ROW_HEIGHT / 2}, ${endX} ${endY}`;
}

interface CommitNodeHoverCardProps {
  commit: GitRepositoryCommit;
  anchorRect: DOMRect;
  headLabel: string;
}

export function CommitNodeHoverCard({
  commit,
  anchorRect,
  headLabel,
}: CommitNodeHoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const cardWidth = 260;
  const cardHeight = cardRef.current?.offsetHeight || 110;

  const isClient = typeof window !== 'undefined';
  const viewportWidth = isClient ? window.innerWidth : 800;
  const viewportHeight = isClient ? window.innerHeight : 600;

  let left = anchorRect.right + 10;
  if (left + cardWidth > viewportWidth - 12) {
    left = anchorRect.left - cardWidth - 10;
  }
  if (left < 12) {
    left = Math.max(12, viewportWidth - cardWidth - 12);
  }

  let top = anchorRect.top + anchorRect.height / 2 - 24;
  if (top + cardHeight > viewportHeight - 12) {
    top = viewportHeight - cardHeight - 12;
  }
  if (top < 12) {
    top = 12;
  }

  const cardVars = useMemo(() => ({
    '--repository-history-card-left': `${left}px`,
    '--repository-history-card-top': `${top}px`,
  }), [left, top]);
  useCssVars(cardRef, cardVars);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={cardRef}
      className="repository-history__node-card"
      role="tooltip"
      data-testid="repository-history-node-card"
    >
      <div className="repository-history__node-card-header">
        <div className="repository-history__node-card-meta">
          <code className="repository-history__node-card-sha">{commit.shortOid}</code>
          <span className="repository-history__node-card-author">{commit.author}</span>
          {commit.isHead && <span className="repository-history__head-badge">{headLabel}</span>}
        </div>
        {commit.refs.length > 0 && (
          <div className="repository-history__node-card-refs">
            {commit.refs.join(' · ')}
          </div>
        )}
      </div>
      <div className="repository-history__node-card-body">
        <div className="repository-history__node-card-message">
          {commit.subject || commit.shortOid}
        </div>
      </div>
    </div>,
    document.body,
  );
}

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

interface GitCommitRowProps {
  node: GitGraphNode;
  spacerWidth: number;
  isSelected: boolean;
  isMenuOpen: boolean;
  isNodeHovered: boolean;
  headLabel: string;
  onOpenMenu: (commit: GitRepositoryCommit, anchor: HTMLElement) => void;
}

function GitCommitRow({
  node,
  spacerWidth,
  isSelected,
  isMenuOpen,
  isNodeHovered,
  headLabel,
  onOpenMenu,
}: GitCommitRowProps) {
  const rowRef = useRef<HTMLLIElement>(null);
  const rowCssVars = useMemo(() => ({
    '--repository-history-row-graph-width': `${spacerWidth}px`,
  }), [spacerWidth]);
  useCssVars(rowRef, rowCssVars);

  return (
    <li
      ref={rowRef}
      className={`repository-history__commit${isSelected ? ' is-selected' : ''}${isMenuOpen ? ' is-menu-open' : ''}${isNodeHovered ? ' is-hovered' : ''}`}
      onClick={(event) => {
        if ((event.target as Element).closest('button')) return;
        if (rowRef.current) onOpenMenu(node.commit, rowRef.current);
      }}
    >
      <span className="repository-history__graph-spacer" aria-hidden="true" />
      <button
        type="button"
        className="repository-history__commit-button"
        aria-pressed={isSelected}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        onClick={(event) => {
          event.stopPropagation();
          if (rowRef.current) onOpenMenu(node.commit, rowRef.current);
        }}
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
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeState | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const graphWidth = Math.max(LANE_WIDTH * layout.laneCount + 10, 24);
  const graphHeight = ROW_HEIGHT * layout.nodes.length;
  const { start, end } = useVisibleRowRange(listRef, '.repository-history__body', layout.nodes.length, ROW_HEIGHT);
  const graphCssVars = useMemo(() => ({
    '--repository-history-graph-width': `${graphWidth}px`,
    '--repository-history-row-height': `${ROW_HEIGHT}px`,
    '--repository-history-rows-before': `${start * ROW_HEIGHT}px`,
    '--repository-history-rows-after': `${Math.max(0, layout.nodes.length - end) * ROW_HEIGHT}px`,
  }), [end, graphWidth, layout.nodes.length, start]);
  useCssVars(listRef, graphCssVars);

  const rowSpacerWidths = useMemo(() => (
    rowMaxLanes(layout).map((lane) => getLaneX(lane) + 14)
  ), [layout]);
  const visibleNodes = layout.nodes.slice(start, end);
  const visibleSegments = useMemo(() => layout.segments.filter((segment) => (
    segment.fromRow < end && (segment.continuesBeyondWindow || segment.toRow >= start)
  )), [end, layout.segments, start]);

  useEffect(() => {
    const handleScrollOrResize = () => setHoveredNode(null);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, []);

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
          {visibleSegments.map((segment) => (
            <path
              key={`${segment.fromRow}:${segment.parentOid}`}
              d={getSegmentPath(segment, graphHeight)}
              className="repository-history__graph-edge"
            />
          ))}
          {visibleNodes.map((node) => (
            <g
              key={node.commit.oid}
              className="repository-history__graph-node-group"
              data-testid={`repository-history-node-${node.commit.oid}`}
              onMouseEnter={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setHoveredNode({ commit: node.commit, anchorRect: rect });
              }}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(event) => {
                event.stopPropagation();
                onActivateRevision(node.commit.oid);
              }}
            >
              <circle
                cx={getLaneX(node.lane)}
                cy={getRowY(node.row)}
                r="8"
                className="repository-history__graph-node-hitbox"
              />
              <circle
                cx={getLaneX(node.lane)}
                cy={getRowY(node.row)}
                r="3"
                className="repository-history__graph-node"
              />
            </g>
          ))}
        </svg>

        {start > 0 && <li className="repository-history__rows-spacer repository-history__rows-spacer--before" aria-hidden="true" />}
        {visibleNodes.map((node) => (
          <GitCommitRow
            key={node.commit.oid}
            node={node}
            spacerWidth={rowSpacerWidths[node.row] ?? 24}
            isSelected={selectedOid === node.commit.oid}
            isMenuOpen={openMenu?.commit.oid === node.commit.oid}
            isNodeHovered={hoveredNode?.commit.oid === node.commit.oid}
            headLabel={headLabel}
            onOpenMenu={(commit, anchor) => {
              setOpenMenu((prev) => (prev?.commit.oid === commit.oid ? null : { commit, anchor }));
            }}
          />
        ))}
        {end < layout.nodes.length && <li className="repository-history__rows-spacer repository-history__rows-spacer--after" aria-hidden="true" />}
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

      {hoveredNode && (
        <CommitNodeHoverCard
          commit={hoveredNode.commit}
          anchorRect={hoveredNode.anchorRect}
          headLabel={headLabel}
        />
      )}
    </>
  );
}
