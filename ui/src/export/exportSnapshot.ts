import type { AppState } from '../contexts/appStateModel';
import {
  runContentEnhancements,
  type ContentEnhancementOptions,
} from '../components/Content/runContentEnhancements';
import type { PlatformBridge } from '../platform/bridge';
import type { MdFile } from '../types/files';
import {
  loadDocumentSnapshot,
  type DocumentSnapshot,
} from './documentSnapshot';
import { capturePdfVisualBlocks } from './pdf/pdfVisualCapture';
import type { PdfVisualBlock } from './pdf/pdfModel';

export type ExportFeature = 'core' | 'htmlPreview' | 'mediaModal' | 'dataTable' | 'charts';
export type ExportVisualBlock = PdfVisualBlock;

export interface ExportDocumentSnapshot extends DocumentSnapshot {
  features: ReadonlySet<ExportFeature>;
  visualBlocks: readonly ExportVisualBlock[];
  warnings: readonly string[];
}

export interface EnhanceExportSnapshotOptions {
  isDark?: boolean;
  isCancelled?: () => boolean;
  enhance?: (options: ContentEnhancementOptions) => Promise<void>;
}

function has(root: ParentNode, selector: string): boolean {
  return root.querySelector(selector) !== null;
}

export function detectExportFeatures(root: ParentNode): ReadonlySet<ExportFeature> {
  const features = new Set<ExportFeature>(['core']);
  if (has(root, '.mdn-html-preview-iframe')) features.add('htmlPreview');
  if (has(root, 'img, .mermaid[data-mdn-rendered] svg, .mdn-mermaid-wrap .mermaid svg')) features.add('mediaModal');
  if (has(root, '.mdn-table-wrap, .mdn-table[data-mdn-enhanced]')) features.add('dataTable');
  if (has(root, '.mdn-table-view-dropdown')) { features.add('dataTable'); features.add('charts'); }
  return features;
}

export function collectExportVisualBlocks(root: ParentNode): readonly ExportVisualBlock[] {
  return capturePdfVisualBlocks(root);
}

function createStagingHost(snapshot: DocumentSnapshot): { host: HTMLElement; body: HTMLElement } {
  const host = document.createElement('div');
  host.dataset.mdnExportStaging = 'true';
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed', left: '-100000px', top: '0', width: '1200px', maxWidth: '1200px',
    opacity: '0', pointerEvents: 'none', zIndex: '-1',
  });
  const body = document.createElement('article');
  body.className = 'mdn-body mdn-export-staging-body';
  body.innerHTML = snapshot.html;
  host.appendChild(body);
  document.body.appendChild(host);
  return { host, body };
}

export async function enhanceExportSnapshot(
  snapshot: DocumentSnapshot,
  options: EnhanceExportSnapshotOptions = {},
): Promise<ExportDocumentSnapshot> {
  const isCancelled = options.isCancelled ?? (() => false);
  const enhance = options.enhance ?? runContentEnhancements;
  const { host, body } = createStagingHost(snapshot);
  try {
    await enhance({ body, isDark: options.isDark ?? false, isCancelled, mermaidRunIdRef: { current: 0 } });
    if (isCancelled()) throw new Error('Export snapshot cancelled');
    const visualBlocks = capturePdfVisualBlocks(body);
    return {
      ...snapshot,
      html: body.innerHTML,
      features: detectExportFeatures(body),
      visualBlocks,
      warnings: visualBlocks.flatMap((block) => block.warning ? [block.warning] : []),
    };
  } finally {
    host.remove();
  }
}

export async function loadEnhancedExportSnapshot(
  bridge: PlatformBridge,
  file: MdFile,
  settings: AppState['settings'],
  options: EnhanceExportSnapshotOptions = {},
): Promise<ExportDocumentSnapshot> {
  const snapshot = await loadDocumentSnapshot(bridge, file, settings);
  return enhanceExportSnapshot(snapshot, options);
}

export async function mapWithConcurrency<TInput, TResult>(
  items: readonly TInput[], concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TResult> | TResult,
): Promise<PromiseSettledResult<TResult>[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError('Concurrency must be a positive integer');
  const results = new Array<PromiseSettledResult<TResult>>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try { results[index] = { status: 'fulfilled', value: await mapper(items[index], index) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
