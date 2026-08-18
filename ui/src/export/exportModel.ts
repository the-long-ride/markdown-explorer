import type { MdFile } from '../types/files';

export type ExportFormat = 'html' | 'pdf' | 'site';
export type ExportLayout = 'document' | 'explorer';
export type ExportBatchMode = 'separate' | 'merged';
export type ExportSourceMode = 'current' | 'selected' | 'folder';

export interface ExportJob {
  format: ExportFormat;
  layout: ExportLayout;
  batchMode: ExportBatchMode;
  files: MdFile[];
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
}

export function filesInFolder(files: readonly MdFile[], folderPath: string): MdFile[] {
  const folder = normalizeRelativePath(folderPath);
  if (!folder) return [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const prefix = `${folder}/`;
  return files
    .filter((file) => normalizeRelativePath(file.relativePath).startsWith(prefix))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function buildExportJob(args: {
  format: ExportFormat;
  layout: ExportLayout;
  batchMode: ExportBatchMode;
  files: readonly MdFile[];
}): ExportJob {
  const byPath = new Map<string, MdFile>();
  for (const file of args.files) byPath.set(file.fsPath, file);
  const files = [...byPath.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  if (files.length === 0) throw new Error('Select at least one document');
  return {
    format: args.format,
    layout: args.layout,
    batchMode: args.batchMode,
    files,
  };
}
