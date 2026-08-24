import type { AppState } from '../contexts/appStateModel';
import type { PlatformBridge } from '../platform/bridge';
import type { AppRuntime } from '../types/settings';
import {
  collectReferencedExportAssets,
  type ExportAsset,
} from './exportAssets';
import { exportHtmlPath, rewriteExportLinks } from './exportHtml';
import type { ExportJob } from './exportModel';
import { safeBaseName } from './exportModel';
import { readWorkspaceExportResource } from './exportResources';
import { loadExportRuntimeAssets } from './exportRuntimeAssets';
import { saveExportArtifact } from './exportSave';
import { composeHtmlExport, composeStaticSiteExport, type WebExportArtifact } from './exportSite';
import {
  loadEnhancedExportSnapshot,
  mapWithConcurrency,
  type ExportDocumentSnapshot,
  type ExportFeature,
} from './exportSnapshot';
import { captureExportThemeSnapshot } from './exportTheme';
import { composePdfArtifacts } from './pdf/pdfComposer';
import { loadPdfMakeRuntime } from './pdf/pdfMakeLoader';

export type ExportActivityStage =
  | 'queued'
  | 'rendering'
  | 'capturing'
  | 'packaging'
  | 'saved'
  | 'warning'
  | 'failed';

export interface ExportActivityEvent {
  stage: ExportActivityStage;
  path: string;
  message?: string;
}

export interface ExportRunResult {
  savedPaths: string[];
  successCount: number;
  failureCount: number;
  warningCount: number;
  cancelled: boolean;
}

export interface ExportJobRunnerDependencies {
  loadSnapshot: typeof loadEnhancedExportSnapshot;
  captureTheme: typeof captureExportThemeSnapshot;
  loadRuntimeAssets: typeof loadExportRuntimeAssets;
  readResource: typeof readWorkspaceExportResource;
  saveArtifact: typeof saveExportArtifact;
  composeHtml: typeof composeHtmlExport;
  composeSite: typeof composeStaticSiteExport;
  composePdf: typeof composePdfArtifacts;
  loadPdfMake: typeof loadPdfMakeRuntime;
}

export interface ExportJobRunnerArgs {
  bridge: PlatformBridge;
  runtime: AppRuntime;
  settings: AppState['settings'];
  workspaceName: string;
  job: ExportJob;
  isDark?: boolean;
  isCancelled?: () => boolean;
  onEvent?: (event: ExportActivityEvent) => void;
}

const DEFAULT_DEPENDENCIES: ExportJobRunnerDependencies = {
  loadSnapshot: loadEnhancedExportSnapshot,
  captureTheme: captureExportThemeSnapshot,
  loadRuntimeAssets: loadExportRuntimeAssets,
  readResource: readWorkspaceExportResource,
  saveArtifact: saveExportArtifact,
  composeHtml: composeHtmlExport,
  composeSite: composeStaticSiteExport,
  composePdf: composePdfArtifacts,
  loadPdfMake: loadPdfMakeRuntime,
};

function featureUnion(documents: readonly ExportDocumentSnapshot[]): Set<ExportFeature> {
  const features = new Set<ExportFeature>(['core']);
  for (const document of documents) for (const feature of document.features) features.add(feature);
  return features;
}

function preferredBaseName(documents: readonly ExportDocumentSnapshot[], workspaceName: string): string {
  if (documents.length === 1) return safeBaseName(documents[0].file.title || documents[0].file.fileName);
  return safeBaseName(workspaceName || documents[0]?.file.title || 'export');
}

function webMimeType(artifact: WebExportArtifact): string {
  return artifact.kind === 'html' ? 'text/html;charset=utf-8' : 'application/zip';
}

function resolvedDarkMode(explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  const mode = document.documentElement.dataset.theme;
  return mode === 'dark' || (mode === 'auto' && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches === true);
}

export async function runExportJob(
  args: ExportJobRunnerArgs,
  overrides: Partial<ExportJobRunnerDependencies> = {},
): Promise<ExportRunResult> {
  const deps = { ...DEFAULT_DEPENDENCIES, ...overrides };
  const cancelled = args.isCancelled ?? (() => false);
  const result: ExportRunResult = { savedPaths: [], successCount: 0, failureCount: 0, warningCount: 0, cancelled: false };
  const emit = (event: ExportActivityEvent) => args.onEvent?.(event);
  const warn = (path: string, message: string) => {
    result.warningCount += 1;
    emit({ stage: 'warning', path, message });
  };
  const fail = (path: string, error: unknown) => {
    result.failureCount += 1;
    emit({ stage: 'failed', path, message: error instanceof Error ? error.message : String(error) });
  };

  args.job.files.forEach((file) => emit({ stage: 'queued', path: file.relativePath }));
  const settled = await mapWithConcurrency(args.job.files, 2, async (file) => {
    emit({ stage: 'rendering', path: file.relativePath });
    const snapshot = await deps.loadSnapshot(args.bridge, file, args.settings, { isDark: resolvedDarkMode(args.isDark) });
    emit({ stage: 'capturing', path: file.relativePath });
    snapshot.warnings.forEach((message) => warn(file.relativePath, message));
    return snapshot;
  });

  const documents: ExportDocumentSnapshot[] = [];
  settled.forEach((entry, index) => {
    if (entry.status === 'fulfilled') documents.push(entry.value);
    else fail(args.job.files[index].relativePath, entry.reason);
  });
  if (args.job.batchMode === 'merged' && result.failureCount > 0) return result;
  if (documents.length === 0) return result;
  if (cancelled()) { result.cancelled = true; return result; }

  const theme = deps.captureTheme();
  const baseName = preferredBaseName(documents, args.workspaceName);

  if (args.job.format === 'pdf') {
    const groups = args.job.batchMode === 'merged' ? [documents] : documents.map((document) => [document]);
    for (const group of groups) {
      if (cancelled()) { result.cancelled = true; break; }
      const label = args.job.batchMode === 'merged' ? `${baseName}-merged.pdf` : group[0].file.relativePath;
      emit({ stage: 'packaging', path: label });
      try {
        const artifacts = await deps.composePdf({
          documents: group,
          batchMode: args.job.batchMode === 'merged' ? 'merged' : 'separate',
          title: args.workspaceName || group[0].file.title,
          baseName,
          theme,
          loadPdfMake: deps.loadPdfMake,
        });
        for (const artifact of artifacts) {
          artifact.warnings.forEach((message) => warn(artifact.fileName, message));
          if (cancelled()) { result.cancelled = true; break; }
          const saved = await deps.saveArtifact(args.bridge, args.runtime, {
            fileName: artifact.fileName,
            mimeType: 'application/pdf',
            bytes: artifact.bytes,
          });
          if (saved.cancelled) { result.cancelled = true; break; }
          if (!saved.ok) { fail(artifact.fileName, saved.error || 'PDF save failed'); continue; }
          const path = saved.path || artifact.fileName;
          result.savedPaths.push(path);
          result.successCount += 1;
          emit({ stage: 'saved', path });
        }
      } catch (error) {
        fail(label, error);
        if (args.job.batchMode === 'merged') break;
      }
    }
    return result;
  }

  const exportedFiles = documents.map((document) => document.file);
  const referencedAssets: ExportAsset[] = [];
  const html: string[] = [];
  const resourceReader = (path: string, options?: { documentPath?: string }) =>
    deps.readResource(args.bridge, path, options);

  for (const document of documents) {
    const packaged = args.job.format === 'site';
    const pageOutputPath = args.job.batchMode === 'merged' ? 'index.html' : exportHtmlPath(document.file);
    const assets = await collectReferencedExportAssets({
      snapshot: document,
      readResource: resourceReader,
      mode: packaged ? 'package' : 'inline',
      pageOutputPath,
    });
    assets.warnings.forEach((message) => warn(document.file.relativePath, message));
    referencedAssets.push(...assets.assets);
    html.push(args.job.batchMode === 'separate'
      ? rewriteExportLinks(assets.html, document.file, exportedFiles)
      : assets.html);
  }

  if (cancelled()) { result.cancelled = true; return result; }
  try {
    const runtimeAssets = await deps.loadRuntimeAssets(featureUnion(documents));
    emit({ stage: 'packaging', path: args.job.format === 'site' ? `${baseName}-site.zip` : baseName });
    const artifact = args.job.format === 'site'
      ? deps.composeSite({
          documents,
          html,
          referencedAssets,
          layout: args.job.layout,
          batchMode: args.job.batchMode,
          title: args.workspaceName || documents[0].file.title,
          baseName,
          theme,
          runtimeAssets,
        })
      : deps.composeHtml({
          documents,
          html,
          layout: args.job.layout,
          batchMode: args.job.batchMode,
          title: args.workspaceName || documents[0].file.title,
          baseName,
          theme,
          runtimeAssets,
        });
    if (cancelled()) { result.cancelled = true; return result; }
    const saved = await deps.saveArtifact(args.bridge, args.runtime, {
      fileName: artifact.fileName,
      mimeType: webMimeType(artifact),
      bytes: artifact.bytes,
    });
    if (saved.cancelled) { result.cancelled = true; return result; }
    if (!saved.ok) { fail(artifact.fileName, saved.error || 'Export save failed'); return result; }
    const path = saved.path || artifact.fileName;
    result.savedPaths.push(path);
    result.successCount += 1;
    emit({ stage: 'saved', path });
  } catch (error) {
    fail('Export package', error);
  }
  return result;
}
