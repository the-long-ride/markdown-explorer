import type { FolderNode, MdFile, WorkspaceEntryKind } from '../types';

const ALWAYS_LISTED_EXTENSION = /\.(md|mdx|markdown)$/i;

export interface SelectedEntry {
  readonly kind: WorkspaceEntryKind;
  /** Workspace-relative, '/'-separated. */
  readonly path: string;
  /** Selection/pin key: `file:<fsPath>` or `folder:<node.path>`. */
  readonly key: string;
}

export function toEntryPath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/');
}

export function isSameOrDescendant(path: string, ancestor: string): boolean {
  return ancestor === '' || path === ancestor || path.startsWith(`${ancestor}/`);
}

export function pruneDescendantPaths(paths: readonly string[]): string[] {
  const kept: string[] = [];
  for (const path of [...new Set(paths)].sort((a, b) => a.length - b.length)) {
    if (!kept.some((ancestor) => isSameOrDescendant(path, ancestor))) kept.push(path);
  }
  return kept.sort((a, b) => a.localeCompare(b));
}

export function parentEntryPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

export function entryBaseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function findFolderNode(tree: FolderNode | null, path: string): FolderNode | null {
  if (!tree) return null;
  if (path === '') return tree;
  const parts = path.split('/');
  let node: FolderNode | undefined = tree;
  for (let index = 0; node && index < parts.length; index += 1) {
    const childPath = parts.slice(0, index + 1).join('/');
    node = node.children.find((child) => child.path === childPath);
  }
  return node ?? null;
}

export function hasSiblingNamed(tree: FolderNode | null, parentPath: string, name: string, caseSensitive: boolean): boolean {
  const folder = findFolderNode(tree, parentPath);
  if (!folder) return false;
  const normalize = (value: string) => (caseSensitive ? value : value.toLowerCase());
  const wanted = normalize(name);
  return folder.children.some((child) => normalize(child.name) === wanted)
    || folder.files.some((file) => normalize(file.fileName) === wanted);
}

/** Markdown always shows; other extensions only when the tree already lists that extension. */
export function isListedFileName(name: string, fileList: readonly MdFile[]): boolean {
  if (ALWAYS_LISTED_EXTENSION.test(name)) return true;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  const extension = name.slice(dot).toLowerCase();
  return fileList.some((file) => (file.extension ?? '').toLowerCase() === extension);
}

export function resolveSelectionEntries(keys: Iterable<string>, fileList: readonly MdFile[]): SelectedEntry[] {
  const byFsPath = new Map(fileList.map((file) => [file.fsPath, file]));
  const entries = new Map<string, SelectedEntry>();
  for (const key of keys) {
    const separator = key.indexOf(':');
    const kind = key.slice(0, separator);
    const raw = key.slice(separator + 1);
    if (kind === 'folder' && raw !== '') entries.set(raw, { kind: 'folder', path: raw, key });
    if (kind === 'file') {
      const file = byFsPath.get(raw);
      if (file) entries.set(toEntryPath(file.relativePath), { kind: 'file', path: toEntryPath(file.relativePath), key });
    }
  }
  const kept = new Set(pruneDescendantPaths([...entries.keys()]));
  return [...entries.values()].filter((entry) => kept.has(entry.path)).sort((a, b) => a.path.localeCompare(b.path));
}

/** Preserve the original path spelling except for the renamed segment. */
export function replaceEntryPrefix(path: string, oldPath: string, newPath: string): string {
  const normalized = path.replace(/\\/g, '/');
  const old = oldPath.replace(/\\/g, '/');
  if (normalized !== old && !normalized.startsWith(`${old}/`)) return path;
  const next = newPath + normalized.slice(old.length);
  return path.includes('\\') ? next.replace(/\//g, '\\') : next;
}
