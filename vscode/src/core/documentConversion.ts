import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

export type DocumentPreviewKind = 'converted' | 'text';

export interface DocumentPreviewInfo {
  readonly kind: DocumentPreviewKind;
  readonly sourceExtension: string;
  readonly sourceLabel: string;
  readonly durationMs?: number;
  readonly fromCache?: boolean;
  readonly qualityWarning?: string;
}

export interface ReadMarkdownResult {
  readonly markdown: string;
  readonly previewInfo: DocumentPreviewInfo | null;
}

interface CacheEntry {
  readonly mtimeMs: number;
  readonly size: number;
  readonly markdown: string;
  readonly durationMs: number;
}

export const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);
export const TEXT_DOCUMENT_EXTENSIONS = new Set(['.txt']);
export const CONVERTIBLE_DOCUMENT_EXTENSIONS = new Set([
  '.doc',
  '.docx',
  '.pdf',
  '.html',
  '.xls',
  '.xlsx',
  '.xlm',
  '.pptx',
  '.odt',
  '.odp',
  '.ods',
  '.rtf',
]);
export const EXTRA_DOCUMENT_EXTENSIONS = new Set([
  ...CONVERTIBLE_DOCUMENT_EXTENSIONS,
  ...TEXT_DOCUMENT_EXTENSIONS,
]);
export const ALL_SUPPORTED_EXTENSIONS = new Set([
  ...MARKDOWN_EXTENSIONS,
  ...EXTRA_DOCUMENT_EXTENSIONS,
]);

let markdownThem: typeof import('@the-long-ride/markdown-them') | null = null;

function getMarkdownThem(): typeof import('@the-long-ride/markdown-them') {
  if (!markdownThem) {
    const bundledRuntimePath = path.join(__dirname, '..', 'vendor', 'markdown-them.cjs');
    markdownThem = (
      fsSync.existsSync(bundledRuntimePath)
        ? require(bundledRuntimePath)
        : require('@the-long-ride/markdown-them')
    ) as typeof import('@the-long-ride/markdown-them');
  }
  return markdownThem;
}

export function getExtension(filePath: string): string {
  return path.extname(filePath || '').toLowerCase();
}

export function isMarkdownFilePath(filePath: string): boolean {
  return MARKDOWN_EXTENSIONS.has(getExtension(filePath));
}

export function isTextDocumentFilePath(filePath: string): boolean {
  return TEXT_DOCUMENT_EXTENSIONS.has(getExtension(filePath));
}

export function isConvertibleDocumentFilePath(filePath: string): boolean {
  return CONVERTIBLE_DOCUMENT_EXTENSIONS.has(getExtension(filePath));
}

export function isExtraDocumentFilePath(filePath: string): boolean {
  return EXTRA_DOCUMENT_EXTENSIONS.has(getExtension(filePath));
}

export function isSupportedFilePath(
  filePath: string,
  documentConversionEnabled = false,
): boolean {
  if (isMarkdownFilePath(filePath)) return true;
  if (isTextDocumentFilePath(filePath)) return true;
  return documentConversionEnabled && isConvertibleDocumentFilePath(filePath);
}

export function isKnownSupportedFilePath(filePath: string): boolean {
  return ALL_SUPPORTED_EXTENSIONS.has(getExtension(filePath));
}

export function stripKnownExtension(fileName: string): string {
  const ext = path.extname(fileName);
  return ext ? fileName.slice(0, -ext.length) : fileName;
}

export function getFileTypeLabel(filePath: string): string {
  const ext = getExtension(filePath);
  return ext ? ext.slice(1).toUpperCase() : 'Document';
}

function normalizePreviewMarkdown(markdown: string, filePath: string): string {
  const trimmed = String(markdown || '').trim();
  const title = stripKnownExtension(path.basename(filePath)).replace(/[\r\n]+/g, ' ').trim();
  if (!trimmed) {
    return `# ${title}\n\n_No readable content was found while preparing this preview._`;
  }
  if (/^#\s+.+$/m.test(trimmed)) return trimmed;
  return `# ${title}\n\n${trimmed}`;
}

export function createFailureMarkdown(filePath: string, err: unknown): string {
  const title = stripKnownExtension(path.basename(filePath)).replace(/[\r\n]+/g, ' ').trim();
  const message = err instanceof Error ? err.message : String(err || 'Unknown conversion error');
  return [
    `# ${title}`,
    '',
    `Markdown Explorer could not convert this ${getFileTypeLabel(filePath)} file.`,
    '',
    '```text',
    message,
    '```',
  ].join('\n');
}

export class DocumentConverter {
  private readonly cache = new Map<string, CacheEntry>();

  async readMarkdown(filePath: string): Promise<ReadMarkdownResult> {
    const ext = getExtension(filePath);

    if (MARKDOWN_EXTENSIONS.has(ext)) {
      return {
        markdown: await fs.readFile(filePath, 'utf8'),
        previewInfo: null,
      };
    }

    if (TEXT_DOCUMENT_EXTENSIONS.has(ext)) {
      return {
        markdown: normalizePreviewMarkdown(await fs.readFile(filePath, 'utf8'), filePath),
        previewInfo: {
          kind: 'text',
          sourceExtension: ext,
          sourceLabel: getFileTypeLabel(filePath),
        },
      };
    }

    if (!CONVERTIBLE_DOCUMENT_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported file type: ${ext || path.basename(filePath)}`);
    }

    const stat = await fs.stat(filePath);
    const cached = this.cache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return {
        markdown: cached.markdown,
        previewInfo: {
          kind: 'converted',
          sourceExtension: ext,
          sourceLabel: getFileTypeLabel(filePath),
          durationMs: cached.durationMs,
          fromCache: true,
        },
      };
    }

    const startedAt = Date.now();
    const markdown = normalizePreviewMarkdown(
      await getMarkdownThem().generateMarkdown(filePath),
      filePath,
    );
    const durationMs = Date.now() - startedAt;

    this.cache.set(filePath, {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      markdown,
      durationMs,
    });

    return {
      markdown,
      previewInfo: {
        kind: 'converted',
        sourceExtension: ext,
        sourceLabel: getFileTypeLabel(filePath),
        durationMs,
        fromCache: false,
      },
    };
  }
}
