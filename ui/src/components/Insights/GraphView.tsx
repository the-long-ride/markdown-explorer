import { useEffect, useMemo, useRef, useState } from 'react';
import { INSIGHTS_TRANSLATIONS, type InsightsTranslations } from '../../contexts/insightsTranslations';
import { buildFocusedGraph, type FocusedGraphNode } from '../../insights/graph';
import type { WorkspaceInsightsSnapshot } from '../../insights/index';
import { ZoomInIcon, ZoomOutIcon, ResetZoomIcon, FullscreenMenuIcon, ExitFocusIcon } from '../shared/icons';

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

function nodeRadius(node: FocusedGraphNode, isHighlighted = false, relLevel?: number): number {
  const base = node.kind === 'document' ? 18 : node.kind === 'tag' ? 13 : 11;
  if (isHighlighted) return base + 4;
  if (relLevel === 0) return base + 3;
  if (relLevel === 1) return base + 1;
  return base;
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

  const [selectedId, setSelectedId] = useState<string | null | undefined>(() => graph.centerPath ?? documentNodes[0]?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDocClick = (e: MouseEvent) => { if (!searchWrapRef.current?.contains(e.target as Node)) setDropdownOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [dropdownOpen]);

  const selected = selectedId === null
    ? null
    : (selectedId && graph.nodes.some(node => node.id === selectedId))
      ? selectedId
      : graph.centerPath ?? documentNodes[0]?.id;

  const select = (node: FocusedGraphNode) => {
    setSelectedId(node.id);
    if (node.kind === 'document') onSelectPath?.(node.id);
  };

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of graph.edges) {
      let s = map.get(edge.source);
      if (!s) { s = new Set(); map.set(edge.source, s); }
      s.add(edge.target);
      let t = map.get(edge.target);
      if (!t) { t = new Set(); map.set(edge.target, t); }
      t.add(edge.source);
    }
    return map;
  }, [graph.edges]);

  const nodeDistanceMap = useMemo(() => {
    if (!selected) return null;
    const dist = new Map<string, number>();
    dist.set(selected, 0);
    const queue: string[] = [selected];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const d = dist.get(current)!;
      const neighbors = adjacency.get(current);
      if (neighbors) {
        for (const next of neighbors) {
          if (!dist.has(next)) {
            dist.set(next, d + 1);
            queue.push(next);
          }
        }
      }
    }
    return dist;
  }, [selected, adjacency]);

  const relationshipSummary = useMemo(() => {
    if (!nodeDistanceMap || !selected) return null;
    let l1 = 0;
    let l2 = 0;
    let l3 = 0;
    for (const [id, d] of nodeDistanceMap.entries()) {
      if (id === selected) continue;
      if (d === 1) l1++;
      else if (d === 2) l2++;
      else if (d === 3) l3++;
    }
    return { l1, l2, l3, total: nodeDistanceMap.size - 1 };
  }, [nodeDistanceMap, selected]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchMatchInfo = useMemo(() => {
    if (!normalizedQuery) return new Map<string, string>();
    const matches = new Map<string, string>();
    for (const node of graph.nodes) {
      if (node.label.toLowerCase().includes(normalizedQuery)) {
        matches.set(node.id, 'title');
        continue;
      }
      if (node.id.toLowerCase().includes(normalizedQuery)) {
        matches.set(node.id, 'path');
        continue;
      }
      const doc = snapshot.documents.get(node.id);
      if (doc) {
        if (doc.tags.some(t => t.toLowerCase().includes(normalizedQuery))) {
          matches.set(node.id, 'tag');
          continue;
        }
        if (doc.headings.some(h => h.text.toLowerCase().includes(normalizedQuery))) {
          matches.set(node.id, 'heading');
          continue;
        }
        if (doc.aliases.some(a => a.toLowerCase().includes(normalizedQuery))) {
          matches.set(node.id, 'alias');
          continue;
        }
      }
    }
    return matches;
  }, [graph.nodes, normalizedQuery, snapshot.documents]);

  const matchingNodes = useMemo(() => {
    if (!normalizedQuery) return [];
    return graph.nodes.filter(node => searchMatchInfo.has(node.id));
  }, [graph.nodes, normalizedQuery, searchMatchInfo]);

  const selectAndCenter = (node: FocusedGraphNode) => {
    select(node);
    setPan({ x: -node.x * zoom, y: -node.y * zoom });
    setDropdownOpen(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setDropdownOpen(false);
    else if (e.key === 'Enter' && matchingNodes.length > 0) selectAndCenter(matchingNodes[0]);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    setDropdownOpen(false);
    if ((e.target as Element).closest?.('.insights-graph__node')) return;
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom(prev => Math.min(4, Math.max(0.25, prev * factor)));
  };

  const zoomIn = () => setZoom(prev => Math.min(4, prev * 1.25));
  const zoomOut = () => setZoom(prev => Math.max(0.25, prev * 0.8));
  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const toggleFullscreen = () => setIsFullscreen(prev => !prev);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  if (!graph.nodes.length) return <div className="workspace-insights__empty">{labels.noGraphConnections}</div>;

  const xs = graph.nodes.map(node => node.x);
  const ys = graph.nodes.map(node => node.y);
  const pad = 50;
  const minX = xs.length ? Math.min(...xs) - pad : -120;
  const maxX = xs.length ? Math.max(...xs) + pad : 120;
  const minY = ys.length ? Math.min(...ys) - pad : -120;
  const maxY = ys.length ? Math.max(...ys) + pad : 120;
  const vbW = Math.max(1, maxX - minX);
  const vbH = Math.max(1, maxY - minY);

  const visibleDocumentNodes = normalizedQuery
    ? documentNodes.filter(node => searchMatchInfo.has(node.id))
    : documentNodes;

  return (
    <div className={`insights-graph${isFullscreen ? ' is-fullscreen' : ''}`}>
      <div className="insights-graph__header-row">
        <div className="insights-view-summary">
          <span className="insights-pill" title={`${format(labels.documentsShown, 'count', documentNodes.length)}${graph.hiddenCount > 0 ? ` · ${format(labels.hiddenByNodeCap, 'count', graph.hiddenCount)}` : ''}`}>
            {documentNodes.length} docs{graph.hiddenCount > 0 ? ` (+${graph.hiddenCount})` : ''}
          </span>
          {relationshipSummary && (
            <span className="insights-graph__rel-stats">
              <span className="insights-pill insights-pill--accent">
                Rel: <strong>1st</strong> ({relationshipSummary.l1})
                {relationshipSummary.l2 > 0 && <> · <strong>2nd</strong> ({relationshipSummary.l2})</>}
              </span>
              <button type="button" className="insights-graph__clear-sel" onClick={() => setSelectedId(null)} title="Clear selection" aria-label="Clear selection">
                ✕
              </button>
            </span>
          )}
        </div>
        <div className="insights-graph__search-wrap" ref={searchWrapRef}>
          <input
            type="search"
            className="insights-graph__search"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search nodes"
          />
          {normalizedQuery && (
            <span className="insights-graph__search-count" title={`${matchingNodes.length} found`}>
              {matchingNodes.length} found
            </span>
          )}
          {dropdownOpen && normalizedQuery && matchingNodes.length > 0 && (
            <ul className="insights-graph__search-dropdown" role="listbox">
              {matchingNodes.slice(0, 8).map(node => (
                <li
                  key={node.id}
                  role="option"
                  aria-selected={selected === node.id}
                  className="insights-graph__search-option"
                  onClick={() => selectAndCenter(node)}
                >
                  <span className="insights-graph__search-option-label" title={node.label}>{node.label}</span>
                  <span className="insights-graph__search-option-badge">{searchMatchInfo.get(node.id)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="insights-graph__canvas-wrap">
        <svg
          className={`insights-graph__canvas${isDragging ? ' is-dragging' : ''}`}
          role="img"
          aria-label={labels.graphAria}
          viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            <g aria-hidden="true" className="insights-graph__edges">
              {graph.edges.map(edge => {
                const source = graph.nodes.find(node => node.id === edge.source);
                const target = graph.nodes.find(node => node.id === edge.target);
                if (!source || !target) return null;
                const edgeDimmed = normalizedQuery && (!searchMatchInfo.has(source.id) && !searchMatchInfo.has(target.id));
                let edgeRelClass = '';
                if (nodeDistanceMap) {
                  const d1 = nodeDistanceMap.get(edge.source);
                  const d2 = nodeDistanceMap.get(edge.target);
                  if (d1 === undefined || d2 === undefined) edgeRelClass = ' is-unrelated';
                  else {
                    const minL = Math.min(d1, d2);
                    if (minL === 0) edgeRelClass = ' is-rel-1';
                    else if (minL === 1) edgeRelClass = ' is-rel-2';
                    else if (minL === 2) edgeRelClass = ' is-rel-3';
                  }
                }
                return (
                  <line
                    key={edge.id}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    className={`insights-graph__edge insights-graph__edge--${edge.kind}${edgeDimmed ? ' is-dimmed' : ''}${edgeRelClass}`}
                    data-edge-kind={edge.kind}
                    data-edge-relation={edge.relation}
                  />
                );
              })}
            </g>
            <g className="insights-graph__nodes">
              {graph.nodes.map(node => {
                const isSelected = selected === node.id;
                const isHighlighted = searchMatchInfo.has(node.id);
                const relLevel = nodeDistanceMap ? nodeDistanceMap.get(node.id) : undefined;
                const isDimmed = (normalizedQuery && !isHighlighted) || (nodeDistanceMap && relLevel === undefined);
                let relClass = '';
                if (nodeDistanceMap) {
                  if (relLevel === 0) relClass = ' is-rel-0';
                  else if (relLevel === 1) relClass = ' is-rel-1';
                  else if (relLevel === 2) relClass = ' is-rel-2';
                  else if (relLevel === 3) relClass = ' is-rel-3';
                  else if (relLevel !== undefined) relClass = ' is-rel-deep';
                  else relClass = ' is-unrelated';
                }
                return (
                  <g
                    key={node.id}
                    data-testid={`graph-node-${node.id}`}
                    data-selected={isSelected ? 'true' : 'false'}
                    data-node-kind={node.kind}
                    className={`insights-graph__node${isSelected ? ' is-selected' : ''}${isHighlighted ? ' is-highlighted' : ''}${isDimmed ? ' is-dimmed' : ''}${relClass}`}
                    transform={`translate(${node.x} ${node.y})`}
                    onClick={() => select(node)}
                  >
                    <circle r={nodeRadius(node, isHighlighted, relLevel)} />
                    <text x={nodeRadius(node, isHighlighted, relLevel) + 5} y="4">{node.label}</text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        <div className="insights-graph__controls" aria-label="Graph controls">
          <button type="button" className="btn btn--icon btn--sm" onClick={zoomIn} title="Zoom in" aria-label="Zoom in"><ZoomInIcon size={14} /></button>
          <button type="button" className="btn btn--icon btn--sm" onClick={zoomOut} title="Zoom out" aria-label="Zoom out"><ZoomOutIcon size={14} /></button>
          <button type="button" className="btn btn--icon btn--sm" onClick={resetZoom} title="Reset zoom" aria-label="Reset zoom"><ResetZoomIcon size={14} /></button>
          <button type="button" className="btn btn--icon btn--sm" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Toggle fullscreen"} aria-label={isFullscreen ? "Exit fullscreen" : "Toggle fullscreen"}>
            {isFullscreen ? <ExitFocusIcon size={13} /> : <FullscreenMenuIcon size={11} />}
          </button>
        </div>
      </div>

      <div className="insights-graph__accessible-list" aria-label={labels.graphDocumentsAria}>
        {visibleDocumentNodes.map(node => (
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
