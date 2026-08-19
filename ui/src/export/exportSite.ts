import type { MdFile } from '../types/files';
import {
  buildStandaloneExportHtml,
  escapeExportHtml,
  exportHtmlPath,
  injectExportScripts,
  type ExportPage,
  type ExportScript,
} from './exportHtml';
import type { ExportAsset } from './exportAssets';
import type { ExportBatchMode, ExportLayout } from './exportModel';
import { exportRuntimeBundleNames, type ExportRuntimeAsset } from './exportRuntimeAssets';
import type { ExportDocumentSnapshot, ExportFeature } from './exportSnapshot';
import { renderExportThemeCss, serializeExportThemeAttributes, type ExportThemeSnapshot } from './exportTheme';
import { createStoreZip, type StoreZipEntry } from './zipStore';

const encoder = new TextEncoder();

export interface WebExportArtifact {
  kind: 'html' | 'zip';
  fileName: string;
  bytes: Uint8Array;
  entries?: readonly StoreZipEntry[];
}

function dirname(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '' : normalized.slice(0, index);
}

function relativePath(fromFile: string, toFile: string): string {
  const fromParts = dirname(fromFile).split('/').filter(Boolean);
  const toParts = toFile.replace(/\\/g, '/').split('/').filter(Boolean);
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) common += 1;
  return [
    ...Array.from({ length: fromParts.length - common }, () => '..'),
    ...toParts.slice(common),
  ].join('/') || './';
}

function featureUnion(documents: readonly ExportDocumentSnapshot[]): Set<ExportFeature> {
  const features = new Set<ExportFeature>(['core']);
  for (const document of documents) for (const feature of document.features) features.add(feature);
  return features;
}

function runtimeMap(assets: readonly ExportRuntimeAsset[]): Map<string, ExportRuntimeAsset> {
  return new Map(assets.map((asset) => [asset.name, asset]));
}

function requiredRuntimeAssets(
  features: ReadonlySet<ExportFeature>,
  assets: readonly ExportRuntimeAsset[],
): ExportRuntimeAsset[] {
  const map = runtimeMap(assets);
  return exportRuntimeBundleNames(features).map((name) => {
    const asset = map.get(name);
    if (!asset) throw new Error(`Missing export runtime bundle: ${name}`);
    return asset;
  });
}

function inlineScripts(assets: readonly ExportRuntimeAsset[]): ExportScript[] {
  return assets.map((asset) => ({ inline: asset.code }));
}

function externalScripts(pagePath: string, assets: readonly ExportRuntimeAsset[]): ExportScript[] {
  return assets.map((asset) => ({ src: relativePath(pagePath, `_runtime/${asset.fileName}`) }));
}

function assetEntries(assets: readonly ExportAsset[]): StoreZipEntry[] {
  const seen = new Set<string>();
  const entries: StoreZipEntry[] = [];
  for (const asset of assets) {
    if (seen.has(asset.outputPath)) continue;
    seen.add(asset.outputPath);
    entries.push({ path: asset.outputPath, data: asset.bytes });
  }
  return entries;
}

function uniqueEntries(entries: readonly StoreZipEntry[]): StoreZipEntry[] {
  const seen = new Set<string>();
  return entries.map((entry) => {
    if (seen.has(entry.path)) throw new Error(`Duplicate export package path: ${entry.path}`);
    seen.add(entry.path);
    return entry;
  });
}

function page(
  document: ExportDocumentSnapshot,
  html: string,
  layout: ExportLayout,
  theme: ExportThemeSnapshot,
  navigationFiles: readonly MdFile[],
  runtimes: readonly ExportRuntimeAsset[],
  scripts: 'inline' | { pagePath: string },
): string {
  const built = buildStandaloneExportHtml({
    pages: [{ file: document.file, html }],
    layout,
    title: document.file.title,
    theme,
    navigationFiles,
  });
  return injectExportScripts(
    built,
    scripts === 'inline' ? inlineScripts(runtimes) : externalScripts(scripts.pagePath, runtimes),
  );
}

function mergedPage(args: {
  documents: readonly ExportDocumentSnapshot[];
  html: readonly string[];
  layout: ExportLayout;
  title: string;
  theme: ExportThemeSnapshot;
  runtimes: readonly ExportRuntimeAsset[];
  scripts: 'inline' | { pagePath: string };
}): string {
  const pages: ExportPage[] = args.documents.map((document, index) => ({ file: document.file, html: args.html[index] }));
  const built = buildStandaloneExportHtml({ pages, layout: args.layout, title: args.title, theme: args.theme });
  return injectExportScripts(
    built,
    args.scripts === 'inline' ? inlineScripts(args.runtimes) : externalScripts(args.scripts.pagePath, args.runtimes),
  );
}

function siteIndex(files: readonly MdFile[], title: string, theme: ExportThemeSnapshot): string {
  const attributes = serializeExportThemeAttributes(theme);
  const links = files.map((file) => `<li><a href="${escapeExportHtml(exportHtmlPath(file))}">${escapeExportHtml(file.relativePath)}</a></li>`).join('');
  return `<!doctype html><html data-mdn-export="true"${attributes ? ` ${attributes}` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeExportHtml(title)}</title><style>${renderExportThemeCss(theme)}\nhtml,body{min-height:100%;height:auto;overflow-y:auto;overflow-x:hidden}body{margin:0;background:var(--bg,#fff);color:var(--tx,#202124);font-family:var(--font-body,system-ui,sans-serif)}.mdn-export-page{box-sizing:border-box;width:min(100%,980px);margin:0 auto;padding:36px 42px 72px}</style></head><body><main class="mdn-body mdn-export-page"><h1>${escapeExportHtml(title)}</h1><ul>${links}</ul></main></body></html>`;
}

export function composeHtmlExport(args: {
  documents: readonly ExportDocumentSnapshot[];
  html: readonly string[];
  layout: ExportLayout;
  batchMode: ExportBatchMode;
  title: string;
  baseName: string;
  theme: ExportThemeSnapshot;
  runtimeAssets: readonly ExportRuntimeAsset[];
  extras?: readonly ExportAsset[];
}): WebExportArtifact {
  if (args.documents.length === 0 || args.documents.length !== args.html.length) throw new Error('HTML export has no complete document set');
  const extras = args.extras ?? [];
  const navigationFiles = args.documents.map((document) => document.file);
  const merged = args.batchMode === 'merged';

  if (merged) {
    const runtimes = requiredRuntimeAssets(featureUnion(args.documents), args.runtimeAssets);
    const html = mergedPage({ ...args, runtimes, scripts: 'inline' });
    if (extras.length === 0) return { kind: 'html', fileName: `${args.baseName}-merged.html`, bytes: encoder.encode(html) };
    const entries = uniqueEntries([{ path: 'index.html', data: encoder.encode(html) }, ...assetEntries(extras)]);
    return { kind: 'zip', fileName: `${args.baseName}-html.zip`, bytes: createStoreZip(entries), entries };
  }

  const pages = args.documents.map((document, index) => {
    const runtimes = requiredRuntimeAssets(document.features, args.runtimeAssets);
    const outputPath = exportHtmlPath(document.file);
    return { path: outputPath, data: encoder.encode(page(document, args.html[index], args.layout, args.theme, navigationFiles, runtimes, 'inline')) };
  });

  if (pages.length === 1 && extras.length === 0) {
    return { kind: 'html', fileName: `${args.baseName}.html`, bytes: pages[0].data };
  }
  const entries = uniqueEntries([...pages, ...assetEntries(extras)]);
  return { kind: 'zip', fileName: `${args.baseName}-html.zip`, bytes: createStoreZip(entries), entries };
}

export function composeStaticSiteExport(args: {
  documents: readonly ExportDocumentSnapshot[];
  html: readonly string[];
  referencedAssets: readonly ExportAsset[];
  extras?: readonly ExportAsset[];
  layout: ExportLayout;
  batchMode: ExportBatchMode;
  title: string;
  baseName: string;
  theme: ExportThemeSnapshot;
  runtimeAssets: readonly ExportRuntimeAsset[];
}): WebExportArtifact {
  if (args.documents.length === 0 || args.documents.length !== args.html.length) throw new Error('Static Website export has no complete document set');
  const unionRuntimes = requiredRuntimeAssets(featureUnion(args.documents), args.runtimeAssets);
  const runtimeEntries = unionRuntimes.map((asset) => ({ path: `_runtime/${asset.fileName}`, data: encoder.encode(asset.code) }));
  const entries: StoreZipEntry[] = [];

  if (args.batchMode === 'merged') {
    entries.push({
      path: 'index.html',
      data: encoder.encode(mergedPage({ ...args, runtimes: unionRuntimes, scripts: { pagePath: 'index.html' } })),
    });
  } else {
    const files = args.documents.map((document) => document.file);
    entries.push({ path: 'index.html', data: encoder.encode(siteIndex(files, args.title, args.theme)) });
    args.documents.forEach((document, index) => {
      const pagePath = exportHtmlPath(document.file);
      const runtimes = requiredRuntimeAssets(document.features, args.runtimeAssets);
      entries.push({
        path: pagePath,
        data: encoder.encode(page(document, args.html[index], args.layout, args.theme, files, runtimes, { pagePath })),
      });
    });
  }

  entries.push(...runtimeEntries, ...assetEntries(args.referencedAssets), ...assetEntries(args.extras ?? []));
  const unique = uniqueEntries(entries);
  return { kind: 'zip', fileName: `${args.baseName}-site.zip`, bytes: createStoreZip(unique), entries: unique };
}
