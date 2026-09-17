import type { MdFile } from './files';

export interface TocEntry {
  readonly level: number;
  readonly text: string;
  readonly id: string;
}

export type Frontmatter = Record<string, string>;

export type DocumentRevisionToken = string;

export interface DocumentWriteCapability {
  readonly supported: boolean;
  readonly revision: DocumentRevisionToken | null;
  readonly reason?: 'read-only-runtime' | 'permission-required' | 'unsupported-document';
}

export interface DocumentPreviewInfo {
  readonly kind: 'converted' | 'text';
  readonly sourceExtension: string;
  readonly sourceLabel: string;
  readonly durationMs?: number;
  readonly fromCache?: boolean;
  readonly qualityCode?: 'converted-preview' | 'legacy-best-effort' | 'conversion-failed';
  readonly qualityWarning?: string;
}

export interface WorkspaceOperationMetadata {
  readonly workspaceOperationId?: string;
  readonly workspaceTabId?: string;
}

export interface RenderContentMessage extends WorkspaceOperationMetadata {
  readonly command: 'renderContent';
  readonly html: string;
  readonly markdownSource?: string | null;
  readonly sourceDocumentText?: string | null;
  readonly frontmatter: Frontmatter;
  readonly toc: TocEntry[];
  readonly filePath: string;
  readonly relativePath: string;
  readonly title: string;
  readonly fileList: MdFile[];
  readonly previewInfo?: DocumentPreviewInfo | null;
  readonly documentWrite?: DocumentWriteCapability;
}

export interface ContentTab {
  readonly filePath: string;
  readonly relativePath: string;
  readonly fileName: string;
  readonly title: string;
  readonly contentHtml: string;
  readonly markdownSource: string | null;
  readonly sourceDocumentText?: string | null;
  readonly htmlPreviewOverride?: boolean;
  readonly frontmatter: Frontmatter;
  readonly toc: TocEntry[];
  readonly previewInfo: DocumentPreviewInfo | null;
  readonly documentWrite?: DocumentWriteCapability;
}
