import type { GitRevisionFile, GitRevisionFileSnapshot } from './contracts';
import type { FolderNode, MdFile, WorkspaceSearchResult } from '../types';

export interface RevisionWorkspaceProjection {
  readonly fileList: readonly MdFile[];
  readonly tree: FolderNode;
}

const SEARCHABLE_TEXT_EXTENSION = /\.(?:md|mdx|txt|json|ya?ml|toml|csv|ts|tsx|js|jsx|css|html?|xml|sh|py|rs|go|java|c|cc|cpp|h|hpp|cs|sql)$/i;
const MAX_REVISION_SEARCH_FILES = 200;
const MAX_REVISION_SEARCH_RESULTS = 1000;

function normalizeRevisionPath(path: string): string {
  return String(path ?? '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
}

function basename(path: string): string {
  const normalized = normalizeRevisionPath(path);
  return normalized.split('/').filter(Boolean).pop() ?? normalized;
}

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(index) : '';
}

function titleOf(fileName: string): string {
  const extension = extensionOf(fileName);
  return extension ? fileName.slice(0, -extension.length) || fileName : fileName;
}

function folderPath(oid: string, relativePath: string): string {
  const normalized = normalizeRevisionPath(relativePath);
  return normalized ? `revision://${oid}/${normalized}` : `revision://${oid}/`;
}

export function revisionFilePath(oid: string, path: string): string {
  return `revision://${oid}/${normalizeRevisionPath(path)}`;
}

export function buildRevisionWorkspaceProjection(
  oid: string,
  files: readonly GitRevisionFile[],
): RevisionWorkspaceProjection {
  const root: FolderNode = { name: '', path: folderPath(oid, ''), children: [], files: [] };
  const folderByRelativePath = new Map<string, FolderNode>([['', root]]);
  const fileList: MdFile[] = [];

  const getFolder = (parts: readonly string[]): FolderNode => {
    let parent = root;
    let relative = '';
    for (const part of parts) {
      relative = relative ? `${relative}/${part}` : part;
      const existing = folderByRelativePath.get(relative);
      if (existing) {
        parent = existing;
        continue;
      }
      const folder: FolderNode = {
        name: part,
        path: folderPath(oid, relative),
        children: [],
        files: [],
      };
      parent.children.push(folder);
      folderByRelativePath.set(relative, folder);
      parent = folder;
    }
    return parent;
  };

  for (const entry of files) {
    const relativePath = normalizeRevisionPath(entry.path);
    if (!relativePath) continue;
    const parts = relativePath.split('/').filter(Boolean);
    const fileName = parts[parts.length - 1];
    if (!fileName) continue;
    const extension = extensionOf(fileName);
    const file: MdFile = {
      fsPath: revisionFilePath(oid, relativePath),
      relativePath,
      parts,
      fileName,
      title: titleOf(fileName),
      extension,
      documentKind: /^\.mdx?$/i.test(extension) ? 'markdown' : 'document',
      modifiedAt: 0,
    };
    fileList.push(file);
    getFolder(parts.slice(0, -1)).files.push(file);
  }

  const sortTree = (node: FolderNode): void => {
    node.files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    node.children.sort((left, right) => left.name.localeCompare(right.name));
    node.children.forEach(sortTree);
  };
  sortTree(root);

  return { fileList, tree: root };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('Revision search aborted', 'AbortError');
}

export async function searchRevisionWorkspace(
  oid: string,
  files: readonly GitRevisionFile[],
  readFile: (oid: string, path: string) => Promise<GitRevisionFileSnapshot>,
  query: string,
  matchCase: boolean,
  signal?: AbortSignal,
): Promise<WorkspaceSearchResult[]> {
  const needle = String(query ?? '').trim();
  if (!needle) return [];
  const comparableNeedle = matchCase ? needle : needle.toLocaleLowerCase();
  const searchable = files.filter((file) => SEARCHABLE_TEXT_EXTENSION.test(file.path)).slice(0, MAX_REVISION_SEARCH_FILES);
  const results: WorkspaceSearchResult[] = [];

  for (const file of searchable) {
    throwIfAborted(signal);
    let snapshot: GitRevisionFileSnapshot;
    try {
      snapshot = await readFile(oid, file.path);
    } catch (error) {
      if (signal?.aborted) throwIfAborted(signal);
      continue;
    }
    throwIfAborted(signal);

    const fileName = basename(file.path);
    const title = titleOf(fileName);
    const lines = snapshot.source.split('\n');
    let absoluteOffset = 0;
    let ordinal = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const comparableLine = matchCase ? line : line.toLocaleLowerCase();
      let from = 0;
      while (from <= comparableLine.length) {
        const index = comparableLine.indexOf(comparableNeedle, from);
        if (index < 0) break;
        ordinal += 1;
        results.push({
          fsPath: revisionFilePath(oid, file.path),
          relativePath: normalizeRevisionPath(file.path),
          fileName,
          title,
          excerpt: line,
          matchIndex: absoluteOffset + index,
          matchOrdinal: ordinal,
          matchLength: needle.length,
          lineNumber: lineIndex + 1,
        });
        if (results.length >= MAX_REVISION_SEARCH_RESULTS) return results;
        from = index + Math.max(1, comparableNeedle.length);
      }
      absoluteOffset += line.length + 1;
    }
  }

  return results;
}
