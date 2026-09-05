import type { WikiResolution } from './wikiLinks.ts';

export type TransclusionReadResult =
  | { readonly status: 'ok'; readonly kind: 'markdown'; readonly source: string }
  | { readonly status: 'ok'; readonly kind: 'preview' }
  | { readonly status: 'missing' | 'unreadable' | 'unsupported' };

export interface TransclusionRenderContext {
  readonly sourceDocumentPath: string;
  readonly depth: number;
  readonly ancestorDocumentPaths: readonly string[];
  readonly documentCount: number;
  readonly maxDepth?: number;
  readonly maxDocuments?: number;
  readonly resolve: (
    rawTarget: string,
    sourceDocumentPath: string,
  ) => WikiResolution | Promise<WikiResolution>;
  readonly read: (canonicalPath: string) => TransclusionReadResult | Promise<TransclusionReadResult>;
  readonly renderMarkdown: (
    source: string,
    childContext: TransclusionRenderContext,
  ) => string | Promise<string>;
  readonly renderPreview: (canonicalPath: string) => string | Promise<string>;
}

export type TransclusionRenderResult =
  | { readonly status: 'rendered'; readonly html: string; readonly canonicalPath: string }
  | { readonly status: 'remote-unloaded'; readonly html: string }
  | { readonly status: 'cycle' | 'depth-limit' | 'document-limit' | 'missing' | 'outside-workspace' | 'invalid-anchor' | 'unreadable' | 'unsupported'; readonly html: string }
  | { readonly status: 'ambiguous'; readonly html: string; readonly candidates: readonly string[] };

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_DOCUMENTS = 50;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function placeholder(status: string, target: string): string {
  return `<span class="mdn-wiki-embed-placeholder" data-mdn-transclusion-status="${escapeHtml(status)}" data-mdn-wiki-target="${escapeHtml(target)}">${escapeHtml(target)}</span>`;
}

function normalizedPath(value: string): string {
  return value.replace(/\\/g, '/').normalize('NFC').toLocaleLowerCase('en-US');
}

export async function renderTransclusion(
  rawTarget: string,
  context: TransclusionRenderContext,
): Promise<TransclusionRenderResult> {
  if (/^https?:\/\//i.test(rawTarget.trim())) {
    return {
      status: 'remote-unloaded',
      html: placeholder('remote-unloaded', rawTarget),
    };
  }

  const maxDepth = context.maxDepth ?? DEFAULT_MAX_DEPTH;
  if (context.depth >= maxDepth) {
    return { status: 'depth-limit', html: placeholder('depth-limit', rawTarget) };
  }

  const maxDocuments = context.maxDocuments ?? DEFAULT_MAX_DOCUMENTS;
  if (context.documentCount >= maxDocuments) {
    return { status: 'document-limit', html: placeholder('document-limit', rawTarget) };
  }

  const resolution = await context.resolve(rawTarget, context.sourceDocumentPath);
  if (resolution.status === 'ambiguous') {
    return {
      status: 'ambiguous',
      candidates: resolution.candidates,
      html: placeholder('ambiguous', rawTarget),
    };
  }
  if (resolution.status !== 'resolved') {
    return {
      status: resolution.status,
      html: placeholder(resolution.status, rawTarget),
    };
  }

  const canonicalPath = resolution.canonicalPath;
  if (context.ancestorDocumentPaths.some((path) => normalizedPath(path) === normalizedPath(canonicalPath))) {
    return { status: 'cycle', html: placeholder('cycle', rawTarget) };
  }

  const source = await context.read(canonicalPath);
  if (source.status !== 'ok') {
    return { status: source.status, html: placeholder(source.status, rawTarget) };
  }

  if (source.kind === 'preview') {
    return {
      status: 'rendered',
      canonicalPath,
      html: await context.renderPreview(canonicalPath),
    };
  }

  const childContext: TransclusionRenderContext = {
    ...context,
    sourceDocumentPath: canonicalPath,
    depth: context.depth + 1,
    ancestorDocumentPaths: [...context.ancestorDocumentPaths, canonicalPath],
    documentCount: context.documentCount + 1,
  };
  return {
    status: 'rendered',
    canonicalPath,
    html: await context.renderMarkdown(source.source, childContext),
  };
}
