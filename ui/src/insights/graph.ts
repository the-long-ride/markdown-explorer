import type { WorkspaceInsightsSnapshot } from './index.ts';

export interface FocusedGraphOptions {
  readonly centerPath?: string;
  readonly nodeCap?: number;
  readonly includeInferred?: boolean;
  readonly showTags?: boolean;
  readonly showHeadings?: boolean;
}

export interface FocusedGraphNode {
  readonly id: string;
  readonly label: string;
  readonly kind: 'document' | 'tag' | 'heading';
  readonly x: number;
  readonly y: number;
}

export interface FocusedGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'explicit' | 'inferred' | 'tag' | 'heading';
  readonly relation?: 'link' | 'embed';
}

export interface FocusedGraph {
  readonly centerPath?: string;
  readonly nodes: readonly FocusedGraphNode[];
  readonly edges: readonly FocusedGraphEdge[];
  readonly hiddenCount: number;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function inferredPairs(snapshot: WorkspaceInsightsSnapshot): Map<string, number> {
  const weights = new Map<string, number>();
  for (const paths of snapshot.tags.values()) {
    const list = [...paths].sort();
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const key = pairKey(list[i], list[j]);
        weights.set(key, (weights.get(key) ?? 0) + 1);
      }
    }
  }
  return weights;
}

function selectDocumentPaths(snapshot: WorkspaceInsightsSnapshot, centerPath: string | undefined, cap: number, includeInferred: boolean): string[] {
  const all = [...snapshot.documents.keys()].sort();
  if (!all.length) return [];
  const center = centerPath && snapshot.documents.has(centerPath) ? centerPath : all[0];
  const selected: string[] = [center];
  const seen = new Set(selected);
  const adjacency = new Map<string, Set<string>>();
  for (const edges of snapshot.outboundLinks.values()) {
    for (const edge of edges) {
      let from = adjacency.get(edge.sourcePath); if (!from) { from = new Set(); adjacency.set(edge.sourcePath, from); }
      let to = adjacency.get(edge.targetPath); if (!to) { to = new Set(); adjacency.set(edge.targetPath, to); }
      from.add(edge.targetPath); to.add(edge.sourcePath);
    }
  }
  const queue = [center];
  while (queue.length && selected.length < cap) {
    const current = queue.shift()!;
    for (const next of [...(adjacency.get(current) ?? [])].sort()) {
      if (seen.has(next)) continue;
      seen.add(next); selected.push(next); queue.push(next);
      if (selected.length >= cap) break;
    }
  }
  if (includeInferred && selected.length < cap) {
    const inferred = [...inferredPairs(snapshot).entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [key] of inferred) {
      const [a, b] = key.split('\u0000');
      if (!seen.has(a) && seen.has(b)) { seen.add(a); selected.push(a); }
      else if (!seen.has(b) && seen.has(a)) { seen.add(b); selected.push(b); }
      if (selected.length >= cap) break;
    }
  }
  for (const path of all) {
    if (selected.length >= cap) break;
    if (!seen.has(path)) { seen.add(path); selected.push(path); }
  }
  return selected;
}

function coordinates(ids: readonly string[], center?: string): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (!ids.length) return result;
  const centerId = center && ids.includes(center) ? center : ids[0];
  result.set(centerId, { x: 0, y: 0 });
  const others = ids.filter(id => id !== centerId).sort();
  for (let index = 0; index < others.length; index += 1) {
    const ring = Math.floor(index / 24);
    const indexInRing = index % 24;
    const ringCount = Math.min(24, others.length - ring * 24);
    const angle = (Math.PI * 2 * indexInRing) / Math.max(1, ringCount) - Math.PI / 2;
    const radius = 150 + ring * 110;
    result.set(others[index], {
      x: Math.round(Math.cos(angle) * radius * 1000) / 1000,
      y: Math.round(Math.sin(angle) * radius * 1000) / 1000,
    });
  }
  return result;
}

export function buildFocusedGraph(snapshot: WorkspaceInsightsSnapshot, options: FocusedGraphOptions = {}): FocusedGraph {
  const cap = Math.max(1, Math.round(options.nodeCap ?? 100));
  const documentPaths = selectDocumentPaths(snapshot, options.centerPath, cap, options.includeInferred === true);
  const selected = new Set(documentPaths);
  const center = options.centerPath && selected.has(options.centerPath) ? options.centerPath : documentPaths[0];
  const coords = coordinates(documentPaths, center);
  const nodes: FocusedGraphNode[] = documentPaths.map(path => ({
    id: path,
    label: snapshot.documents.get(path)?.title || path,
    kind: 'document',
    ...(coords.get(path) ?? { x: 0, y: 0 }),
  }));
  const edges: FocusedGraphEdge[] = [];
  const edgeIds = new Set<string>();
  const addEdge = (edge: FocusedGraphEdge) => { if (!edgeIds.has(edge.id)) { edgeIds.add(edge.id); edges.push(edge); } };

  for (const outbound of snapshot.outboundLinks.values()) {
    for (const edge of outbound) {
      if (!selected.has(edge.sourcePath) || !selected.has(edge.targetPath)) continue;
      addEdge({
        id: `explicit:${edge.sourcePath}->${edge.targetPath}:${edge.kind}`,
        source: edge.sourcePath,
        target: edge.targetPath,
        kind: 'explicit',
        relation: edge.kind,
      });
    }
  }

  if (options.includeInferred) {
    for (const [key] of [...inferredPairs(snapshot).entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const [a, b] = key.split('\u0000');
      if (!selected.has(a) || !selected.has(b)) continue;
      addEdge({ id: `inferred:${a}<->${b}`, source: a, target: b, kind: 'inferred' });
    }
  }

  const secondaryCandidates: Array<{ id: string; label: string; kind: 'tag' | 'heading'; paths: readonly string[] }> = [];
  if (options.showTags) {
    for (const [tag, paths] of snapshot.tags) {
      const visible = [...paths].filter(path => selected.has(path)).sort();
      if (visible.length) secondaryCandidates.push({ id: `tag:${tag}`, label: `#${tag}`, kind: 'tag', paths: visible });
    }
  }
  if (options.showHeadings) {
    for (const [heading, paths] of snapshot.headings) {
      const visible = [...paths].filter(path => selected.has(path)).sort();
      if (visible.length) secondaryCandidates.push({ id: `heading:${heading}`, label: heading, kind: 'heading', paths: visible });
    }
  }
  secondaryCandidates.sort((a, b) => a.id.localeCompare(b.id));
  for (const candidate of secondaryCandidates) {
    if (nodes.length >= cap) break;
    const angleIndex = nodes.length;
    const angle = (angleIndex * 2.399963229728653) % (Math.PI * 2);
    const radius = 260 + 30 * Math.floor(angleIndex / 20);
    nodes.push({ id: candidate.id, label: candidate.label, kind: candidate.kind, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    for (const path of candidate.paths) {
      addEdge({ id: `${candidate.kind}:${path}->${candidate.id}`, source: path, target: candidate.id, kind: candidate.kind });
    }
  }

  edges.sort((a, b) => a.id.localeCompare(b.id));
  const totalPotential = snapshot.documents.size + secondaryCandidates.length;
  return {
    ...(center ? { centerPath: center } : {}),
    nodes,
    edges,
    hiddenCount: Math.max(0, totalPotential - nodes.length),
  };
}
