import {
  documentWriteCapability,
  documentRevision,
  resolveFileHandle,
} from './file-access';
import type { MdFile } from '../../ui/src/types';
import { isExtraDocumentFile, convertWebDocumentToMarkdown } from './web-document-converter';

export function isEditableMarkdownPath(filePath: string): boolean {
  return /\.mdx?$/i.test(filePath);
}

export async function singleFileDocumentWriteCapability(handle: FileSystemFileHandle) {
  const permission = await (handle as any).queryPermission?.({ mode: 'readwrite' });
  if (permission !== 'granted') return { supported: false, revision: null, reason: 'permission-required' as const };
  return { supported: true, revision: await documentRevision(handle) };
}

export function buildMdFileFromName(fileName: string, modifiedAt = 0): MdFile {
  const dot = fileName.lastIndexOf('.');
  const ext = dot !== -1 ? fileName.slice(dot).toLowerCase() : '';
  const base = dot !== -1 ? fileName.slice(0, dot) : fileName;
  const isMd = ext === '.md' || ext === '.mdx' || ext === '.markdown';
  return {
    fsPath: fileName,
    relativePath: fileName,
    parts: [fileName],
    fileName,
    title: base || fileName,
    extension: ext,
    documentKind: isMd ? 'markdown' : 'document',
    modifiedAt,
  };
}

export async function readAndConvertFile(
  fileOrHandle: FileSystemFileHandle | File,
  relativePath: string,
  containerHandle?: FileSystemDirectoryHandle,
): Promise<{ markdownSource: string; rawText: string; previewInfo: any; documentWrite: any }> {
  const file = fileOrHandle instanceof File ? fileOrHandle : await fileOrHandle.getFile();
  if (isExtraDocumentFile(relativePath)) {
    const converted = await convertWebDocumentToMarkdown(file);
    const documentWrite = converted.previewInfo?.readOnly
      ? { supported: false, revision: null, reason: 'read-only-runtime' as const }
      : (containerHandle ? await documentWriteCapability(containerHandle, relativePath) : await singleFileDocumentWriteCapability(fileOrHandle as FileSystemFileHandle));
    return {
      markdownSource: converted.markdown,
      rawText: converted.markdown,
      previewInfo: converted.previewInfo,
      documentWrite,
    };
  }

  const rawText = await file.text();
  const documentWrite = isEditableMarkdownPath(relativePath)
    ? (containerHandle ? await documentWriteCapability(containerHandle, relativePath) : await singleFileDocumentWriteCapability(fileOrHandle as FileSystemFileHandle))
    : undefined;

  return {
    markdownSource: rawText,
    rawText,
    previewInfo: null,
    documentWrite,
  };
}

export async function readContainerDocument(
  container: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<{ markdownSource: string; rawText: string; previewInfo: any; documentWrite: any }> {
  const handle = await resolveFileHandle(container, relativePath);
  if (!handle) throw new Error(`File not found: ${relativePath}`);
  return readAndConvertFile(handle, relativePath, container);
}
