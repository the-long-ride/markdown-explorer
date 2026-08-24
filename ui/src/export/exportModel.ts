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

export function exportArtifactLabel(args: {
  format: ExportFormat;
  batchMode: ExportBatchMode;
  documentCount: number;
}): string {
  if (args.format === 'site') return 'Static Website (.zip)';
  if (args.format === 'pdf') {
    return args.batchMode === 'separate' && args.documentCount > 1 ? 'PDF files' : 'PDF (.pdf)';
  }
  const packaged = args.batchMode === 'separate' && args.documentCount > 1;
  return packaged ? 'HTML package (.zip)' : 'HTML (.html)';
}

export function folderOptions(files: readonly MdFile[]): string[] {
  const folders = new Set<string>();
  for (const file of files) {
    const parts = normalizeRelativePath(file.relativePath).split('/').slice(0, -1);
    for (let length = 1; length <= parts.length; length += 1) folders.add(parts.slice(0, length).join('/'));
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}

export function filesInFolder(files: readonly MdFile[], folderPath: string): MdFile[] {
  const folder = normalizeRelativePath(folderPath);
  if (!folder) return [...files];
  const prefix = `${folder}/`;
  return files.filter((file) => normalizeRelativePath(file.relativePath).startsWith(prefix));
}

export function buildExportJob(args: {
  format: ExportFormat;
  layout: ExportLayout;
  batchMode: ExportBatchMode;
  files: readonly MdFile[];
}): ExportJob {
  const byPath = new Map<string, MdFile>();
  for (const file of args.files) {
    if (!byPath.has(file.fsPath)) byPath.set(file.fsPath, file);
  }
  const files = [...byPath.values()];
  if (files.length === 0) throw new Error('Select at least one document');
  if (args.format === 'pdf' && args.layout !== 'document') {
    throw new Error('PDF export supports Document only layout');
  }
  return { format: args.format, layout: args.layout, batchMode: args.batchMode, files };
}
