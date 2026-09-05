import type { AnalyzedDocument } from './analyzeDocument.ts';
import type { DocumentReference } from '../markdown/references.ts';
import { slugify } from '../markdown/utils.ts';

export type ResolvedLinkKind = 'link' | 'embed';
export type BrokenLinkStatus = 'missing' | 'ambiguous' | 'invalid-anchor' | 'outside-workspace';

export interface ResolvedInsightsLink {
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly kind: ResolvedLinkKind;
  readonly referenceKind: DocumentReference['kind'];
  readonly fragment?: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly caseMismatch?: boolean;
}

export interface BrokenInsightsLink {
  readonly sourcePath: string;
  readonly target: string;
  readonly fragment?: string;
  readonly referenceKind: DocumentReference['kind'];
  readonly status: BrokenLinkStatus;
  readonly candidates?: readonly string[];
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

export interface WorkspaceInsightsSnapshot {
  readonly documents: ReadonlyMap<string, AnalyzedDocument>;
  readonly outboundLinks: ReadonlyMap<string, readonly ResolvedInsightsLink[]>;
  readonly backlinks: ReadonlyMap<string, readonly ResolvedInsightsLink[]>;
  readonly brokenLinks: readonly BrokenInsightsLink[];
  readonly tags: ReadonlyMap<string, ReadonlySet<string>>;
  readonly headings: ReadonlyMap<string, ReadonlySet<string>>;
  readonly titles: ReadonlyMap<string, ReadonlySet<string>>;
  readonly revision: number;
}

export interface IndexDeltaResult {
  readonly changedPaths: readonly string[];
  readonly revision: number;
}

export interface HighConfidenceRename {
  readonly fromPath: string;
  readonly toPath: string;
  readonly document?: AnalyzedDocument;
}

interface Resolution {
  readonly status: 'resolved' | BrokenLinkStatus;
  readonly targetPath?: string;
  readonly candidates?: readonly string[];
  readonly fragment?: string;
  readonly caseMismatch?: boolean;
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return '../';
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/').normalize('NFC');
}

function lower(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('en-US');
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  const slash = normalized.lastIndexOf('/');
  return slash < 0 ? '' : normalized.slice(0, slash);
}

function basename(path: string): string {
  const normalized = normalizePath(path);
  const slash = normalized.lastIndexOf('/');
  return slash < 0 ? normalized : normalized.slice(slash + 1);
}

function stem(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? name : name.slice(0, dot);
}

function resolveRelative(sourcePath: string, target: string): { path?: string; outside: boolean } {
  if (/^file:/i.test(target)) return { outside: true };
  const absolute = target.startsWith('/');
  const segments = absolute ? [] : dirname(sourcePath).split('/').filter(Boolean);
  for (const part of target.replace(/\\/g, '/').replace(/^\//, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!segments.length) return { outside: true };
      segments.pop();
    } else {
      segments.push(part);
    }
  }
  return { path: segments.join('/').normalize('NFC'), outside: false };
}

function mapSetAdd(map: Map<string, Set<string>>, key: string, value: string): void {
  let set = map.get(key);
  if (!set) { set = new Set(); map.set(key, set); }
  set.add(value);
}

function effectiveDocuments(base: ReadonlyMap<string, AnalyzedDocument>, overlays: ReadonlyMap<string, AnalyzedDocument>): Map<string, AnalyzedDocument> {
  const result = new Map(base);
  for (const [path, document] of overlays) result.set(path, document);
  return result;
}

function indexCatalog(documents: ReadonlyMap<string, AnalyzedDocument>) {
  const byPath = new Map<string, string>();
  const byStem = new Map<string, Set<string>>();
  const byTitleAlias = new Map<string, Set<string>>();
  for (const [path, document] of documents) {
    byPath.set(lower(path), path);
    mapSetAdd(byStem, lower(stem(path)), path);
    mapSetAdd(byTitleAlias, lower(document.title), path);
    for (const alias of document.aliases) mapSetAdd(byTitleAlias, lower(alias), path);
  }
  return { byPath, byStem, byTitleAlias };
}

function validateFragment(document: AnalyzedDocument, fragment?: string): { valid: boolean; anchor?: string } {
  if (!fragment) return { valid: true };
  const decoded = (() => { try { return decodeURIComponent(fragment); } catch { return fragment; } })();
  const normalized = lower(decoded);
  const slug = lower(slugify(decoded));
  for (const anchor of document.anchors) {
    if (lower(anchor) === normalized || lower(anchor) === slug) return { valid: true, anchor };
  }
  return { valid: false };
}

function resolveReference(
  sourcePath: string,
  reference: DocumentReference,
  documents: ReadonlyMap<string, AnalyzedDocument>,
  catalog: ReturnType<typeof indexCatalog>,
): Resolution {
  if (reference.remote || reference.kind === 'media' || reference.kind === 'html-media') return { status: 'missing' };

  const isWiki = reference.kind === 'wiki-link' || reference.kind === 'wiki-embed';
  const target = reference.target.trim();
  let candidates: string[] = [];
  let requestedPath = '';

  if (!target) {
    candidates = [sourcePath];
  } else if (!isWiki || target.startsWith('.') || target.startsWith('/') || target.includes('/') || /\.mdx?$/i.test(target)) {
    const resolved = resolveRelative(sourcePath, target);
    if (resolved.outside || !resolved.path) return { status: 'outside-workspace' };
    requestedPath = resolved.path;
    const direct = catalog.byPath.get(lower(requestedPath));
    if (direct) candidates = [direct];
    else if (!/\.[^/]+$/.test(requestedPath)) {
      const md = catalog.byPath.get(lower(`${requestedPath}.md`));
      const mdx = catalog.byPath.get(lower(`${requestedPath}.mdx`));
      candidates = [md, mdx].filter((value): value is string => Boolean(value));
    }
  } else {
    const key = lower(target);
    candidates = [...new Set([...(catalog.byStem.get(key) ?? []), ...(catalog.byTitleAlias.get(key) ?? [])])].sort();
  }

  if (candidates.length === 0) return { status: 'missing' };
  if (candidates.length > 1) return { status: 'ambiguous', candidates };
  const targetPath = candidates[0];
  const targetDocument = documents.get(targetPath);
  if (!targetDocument) return { status: 'missing' };
  const fragment = validateFragment(targetDocument, reference.fragment);
  if (!fragment.valid) return { status: 'invalid-anchor' };
  const query = requestedPath || target;
  const caseMismatch = Boolean(query) && lower(query.replace(/^\//, '')) === lower(targetPath) && normalizePath(query.replace(/^\//, '')) !== targetPath;
  return {
    status: 'resolved',
    targetPath,
    ...(fragment.anchor ? { fragment: fragment.anchor } : {}),
    ...(caseMismatch ? { caseMismatch: true } : {}),
  };
}

function renamedDocument(document: AnalyzedDocument, toPath: string): AnalyzedDocument {
  return {
    ...document,
    path: toPath,
    persisted: { ...document.persisted, path: toPath },
  };
}

export class WorkspaceInsightsIndex {
  private readonly baseDocuments = new Map<string, AnalyzedDocument>();
  private readonly overlays = new Map<string, AnalyzedDocument>();
  private indexRevision = 0;

  applyDocument(document: AnalyzedDocument): IndexDeltaResult {
    const path = normalizePath(document.path);
    this.baseDocuments.set(path, document.path === path ? document : renamedDocument(document, path));
    this.indexRevision += 1;
    return { changedPaths: [path], revision: this.indexRevision };
  }

  removeDocument(canonicalPath: string): IndexDeltaResult {
    const path = normalizePath(canonicalPath);
    this.baseDocuments.delete(path);
    this.overlays.delete(path);
    this.indexRevision += 1;
    return { changedPaths: [path], revision: this.indexRevision };
  }

  renameDocument(change: HighConfidenceRename): IndexDeltaResult {
    const fromPath = normalizePath(change.fromPath);
    const toPath = normalizePath(change.toPath);
    const base = change.document ?? this.baseDocuments.get(fromPath);
    const overlay = this.overlays.get(fromPath);
    this.baseDocuments.delete(fromPath);
    this.overlays.delete(fromPath);
    if (base) this.baseDocuments.set(toPath, renamedDocument(base, toPath));
    if (overlay) this.overlays.set(toPath, renamedDocument(overlay, toPath));
    this.indexRevision += 1;
    return { changedPaths: [fromPath, toPath], revision: this.indexRevision };
  }

  applyActiveOverlay(document: AnalyzedDocument): IndexDeltaResult {
    const path = normalizePath(document.path);
    this.overlays.set(path, document.path === path ? document : renamedDocument(document, path));
    this.indexRevision += 1;
    return { changedPaths: [path], revision: this.indexRevision };
  }

  clearActiveOverlay(canonicalPath: string): IndexDeltaResult {
    const path = normalizePath(canonicalPath);
    this.overlays.delete(path);
    this.indexRevision += 1;
    return { changedPaths: [path], revision: this.indexRevision };
  }

  snapshot(): WorkspaceInsightsSnapshot {
    const documents = effectiveDocuments(this.baseDocuments, this.overlays);
    const catalog = indexCatalog(documents);
    const outboundLinks = new Map<string, ResolvedInsightsLink[]>();
    const backlinks = new Map<string, ResolvedInsightsLink[]>();
    const brokenLinks: BrokenInsightsLink[] = [];
    const tags = new Map<string, Set<string>>();
    const headings = new Map<string, Set<string>>();
    const titles = new Map<string, Set<string>>();

    for (const [path, document] of documents) {
      for (const tag of document.tags) mapSetAdd(tags, lower(tag), path);
      for (const heading of document.headings) mapSetAdd(headings, lower(heading.text), path);
      mapSetAdd(titles, lower(document.title), path);
      for (const alias of document.aliases) mapSetAdd(titles, lower(alias), path);

      const edges: ResolvedInsightsLink[] = [];
      for (const reference of document.references) {
        if (reference.remote || reference.kind === 'media' || reference.kind === 'html-media') continue;
        const resolution = resolveReference(path, reference, documents, catalog);
        if (resolution.status !== 'resolved' || !resolution.targetPath) {
          brokenLinks.push({
            sourcePath: path,
            target: reference.target,
            ...(reference.fragment ? { fragment: reference.fragment } : {}),
            referenceKind: reference.kind,
            status: resolution.status as BrokenLinkStatus,
            ...(resolution.candidates ? { candidates: resolution.candidates } : {}),
            sourceStart: reference.sourceStart,
            sourceEnd: reference.sourceEnd,
          });
          continue;
        }
        if (resolution.targetPath === path) continue;
        const edge: ResolvedInsightsLink = {
          sourcePath: path,
          targetPath: resolution.targetPath,
          kind: reference.kind === 'wiki-embed' ? 'embed' : 'link',
          referenceKind: reference.kind,
          ...(resolution.fragment ? { fragment: resolution.fragment } : {}),
          sourceStart: reference.sourceStart,
          sourceEnd: reference.sourceEnd,
          ...(resolution.caseMismatch ? { caseMismatch: true } : {}),
        };
        edges.push(edge);
        const inbound = backlinks.get(edge.targetPath) ?? [];
        inbound.push(edge);
        backlinks.set(edge.targetPath, inbound);
      }
      outboundLinks.set(path, edges);
    }

    return {
      documents,
      outboundLinks,
      backlinks,
      brokenLinks: brokenLinks.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath) || a.sourceStart - b.sourceStart),
      tags,
      headings,
      titles,
      revision: this.indexRevision,
    };
  }
}
