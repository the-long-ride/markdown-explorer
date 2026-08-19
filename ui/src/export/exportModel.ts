import type { MdFile } from '../types/files';

export type ExportFormat = 'html' | 'pdf' | 'site';
export type ExportLayout = 'document' | 'explorer';
export type ExportBatchMode = 'separate' | 'merged';
export type ExportSourceMode = 'current' | 'selected' | 'folder' | 'workspace';

export interface ExportJob {
  format: ExportFormat;
  layout: ExportLayout;
  batchMode: ExportBatchMode;
  files: MdFile[];
  extraResourcePaths: string[];
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
}

export function safeBaseName(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'markdown-explorer';
}

export function pdfOutputName(file: MdFile, multiple: boolean): string {
  const source = multiple ? file.relativePath.replace(/\\/g, '/').replace(/\//g, '-') : file.title;
  return `${safeBaseName(source)}.pdf`;
}

export function fileNameFromPath(value: string): string {
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}

export function folderOptions(files: readonly MdFile[]): string[] {
  const folders = new Set<string>();
  for (const file of files) {
    const parts = normalizeRelativePath(file.relativePath).split('/').slice(0, -1);
    for (let length = 1; length <= parts.length; length += 1) {
      folders.add(parts.slice(0, length).join('/'));
    }
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
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
  extraResourcePaths?: readonly string[];
}): ExportJob {
  const byPath = new Map<string, MdFile>();
  for (const file of args.files) byPath.set(file.fsPath, file);
  const files = [...byPath.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  if (files.length === 0) throw new Error('Select at least one document');

  const extraResourcePaths = [...new Set(
    (args.extraResourcePaths ?? [])
      .map(normalizeRelativePath)
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));
  if (args.format === 'pdf' && extraResourcePaths.length > 0) {
    throw new Error('Additional workspace files are not supported for PDF export');
  }

  return {
    format: args.format,
    layout: args.layout,
    batchMode: args.batchMode,
    files,
    extraResourcePaths,
  };
}
