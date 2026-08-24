import type { ExportFeature } from './exportSnapshot';

export type ExportRuntimeBundleName = 'core' | 'html-preview' | 'media' | 'table' | 'charts';

export interface ExportRuntimeAsset {
  name: ExportRuntimeBundleName;
  fileName: string;
  code: string;
}

export interface ExportRuntimeLoadOptions {
  baseUrl?: string;
  readText?: (url: string) => Promise<string>;
  cache?: Map<string, Promise<string>>;
}

const BUNDLE_FILES: Record<ExportRuntimeBundleName, string> = {
  core: 'core.js',
  'html-preview': 'html-preview.js',
  media: 'media.js',
  table: 'table.js',
  charts: 'charts.js',
};
const defaultCache = new Map<string, Promise<string>>();

function defaultBaseUrl(): string {
  if (typeof document === 'undefined') return './export-runtime/';
  return new URL('./export-runtime/', document.baseURI).toString();
}

async function defaultReadText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load export runtime asset: ${url}`);
  return response.text();
}

export function exportRuntimeBundleNames(features: ReadonlySet<ExportFeature>): ExportRuntimeBundleName[] {
  const names: ExportRuntimeBundleName[] = ['core'];
  if (features.has('htmlPreview')) names.push('html-preview');
  if (features.has('mediaModal')) names.push('media');
  if (features.has('dataTable') || features.has('charts')) names.push('table');
  if (features.has('charts')) names.push('charts');
  return names;
}

export async function loadExportRuntimeAssets(
  features: ReadonlySet<ExportFeature>,
  options: ExportRuntimeLoadOptions = {},
): Promise<readonly ExportRuntimeAsset[]> {
  const baseUrl = options.baseUrl ?? defaultBaseUrl();
  const readText = options.readText ?? defaultReadText;
  const cache = options.cache ?? defaultCache;

  return Promise.all(exportRuntimeBundleNames(features).map(async (name) => {
    const fileName = BUNDLE_FILES[name];
    const url = new URL(fileName, baseUrl).toString();
    let pending = cache.get(url);
    if (!pending) {
      pending = readText(url).catch((error) => {
        cache.delete(url);
        throw error;
      });
      cache.set(url, pending);
    }
    const code = await pending;
    if (!code.trim()) throw new Error(`Export runtime asset is empty: ${fileName}`);
    return { name, fileName, code };
  }));
}

export function clearExportRuntimeAssetCache(): void {
  defaultCache.clear();
}
