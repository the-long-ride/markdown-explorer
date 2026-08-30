import { useMemo, useState } from 'react';
import { INSIGHTS_TRANSLATIONS, type InsightsTranslations } from '../../contexts/insightsTranslations';
import { buildFocusedGraph, type FocusedGraphNode } from '../../insights/graph';
import type { WorkspaceInsightsSnapshot } from '../../insights/index';

export interface GraphViewProps {
  readonly snapshot: WorkspaceInsightsSnapshot;
  readonly labels?: InsightsTranslations;
  readonly nodeCap?: number;
  readonly centerPath?: string;
  readonly includeInferred?: boolean;
  readonly showTags?: boolean;
  readonly showHeadings?: boolean;
  readonly onSelectPath?: (path: string) => void;
}

function nodeRadius(node: FocusedGraphNode): number {
  if (node.kind === 'document') return 18;
  return node.kind === 'tag' ? 13 : 11;
}

function format(value: string, key: string, replacement: string | number): string {
  return value.replace(`{${key}}`, String(replacement));
}

export function GraphView({
  snapshot,
  labels = INSIGHTS_TRANSLATIONS.en,
  nodeCap = 100,
  centerPath,
  includeInferred = false,
  showTags = false,
  showHeadings = false,
  onSelectPath,
}: GraphViewProps) {
  const graph = useMemo(() => buildFocusedGraph(snapshot, {
    centerPath,
    nodeCap,
    includeInferred,
    showTags,
    showHeadings,
  }), [centerPath, includeInferred, nodeCap, showHeadings, showTags, snapshot]);
  const documentNodes = useMemo(
    () => graph.nodes.filter((node): node is FocusedGraphNode & { kind: 'document' } => node.kind === 'document'),
    [graph.nodes],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(() => graph.centerPath ?? documentNodes[0]?.id);
  const selected = graph.nodes.some(node => node.id === selectedId)
    ? selectedId
    : graph.centerPath ?? documentNodes[0]?.id;

  const select = (node: FocusedGraphNode) => {
    setSelectedId(node.id);
    if (node.kind === 'document') onSelectPath?.(node.id);
  };

  if (!graph.nodes.length) return <div className="workspace-insights__empty">{labels.noGraphConnections}</div>;

  const xs = graph.nodes.map(node => node.x);
  const ys = graph.nodes.map(node => node.y);
  const minX = Math.min(...xs, -180) - 70;
  const maxX = Math.max(...xs, 180) + 70;
  const minY = Math.min(...ys, -180) - 70;
  const maxY = Math.max(...ys, 180) + 70;

  return (
    <div className="insights-graph">
      <div className="insights-view-summary">
        {format(labels.documentsShown, 'count', documentNodes.length)}
        {graph.hiddenCount > 0 ? ` · ${format(labels.hiddenByNodeCap, 'count', graph.hiddenCount)}` : ''}
        {includeInferred ? ` · ${labels.inferredShown}` : ` · ${labels.explicitOnly}`}
      </div>
      <svg
        className="insights-graph__canvas"
        role="img"
        aria-label={labels.graphAria}
        viewBox={`${minX} ${minY} ${Math.max(1, maxX - minX)} ${Math.max(1, maxY - minY)}`}
      >
        <g aria-hidden="true" className="insights-graph__edges">
          {graph.edges.map(edge => {
            const source = graph.nodes.find(node => node.id === edge.source);
            const target = graph.nodes.find(node => node.id === edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={`insights-graph__edge insights-graph__edge--${edge.kind}`}
                data-edge-kind={edge.kind}
                data-edge-relation={edge.relation}
              />
            );
          })}
        </g>
        <g className="insights-graph__nodes">
          {graph.nodes.map(node => {
            const isSelected = selected === node.id;
            return (
              <g
                key={node.id}
                data-testid={`graph-node-${node.id}`}
                data-selected={isSelected ? 'true' : 'false'}
                data-node-kind={node.kind}
                className={`insights-graph__node${isSelected ? ' is-selected' : ''}`}
                transform={`translate(${node.x} ${node.y})`}
                onClick={() => select(node)}
              >
                <circle r={nodeRadius(node)} />
                <text x={nodeRadius(node) + 5} y="4">{node.label}</text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="insights-graph__accessible-list" aria-label={labels.graphDocumentsAria}>
        {documentNodes.map(node => (
          <button
            key={node.id}
            type="button"
            className="btn btn--sm insights-graph__document-button"
            aria-current={selected === node.id ? 'true' : undefined}
            onClick={() => select(node)}
          >
            {node.label}
          </button>
        ))}
      </div>
    </div>
  );
}
