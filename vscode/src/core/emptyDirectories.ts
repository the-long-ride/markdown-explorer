import * as fs from 'fs';
import * as path from 'path';
import type { FolderNode } from '../types';

type ReaddirApi = Pick<typeof fs.promises, 'readdir'>;

/** `**\/name/**` and `**\/name` become `name`; anything with wildcards inside the name is skipped. */
export function ignoredFolderNamesFromGlobs(patterns: readonly string[]): string[] {
  return patterns.flatMap((pattern) => {
    const match = /^\*\*\/([^/*?{}[\]]+)(?:\/\*\*)?$/.exec(pattern.trim());
    return match ? [match[1]] : [];
  });
}

/** True when any descendant folder has no files and no subfolders. */
export function treeHasEmptyFolder(node: FolderNode | null | undefined): boolean {
  return node?.children?.some((child) => (child.children.length === 0 && child.files.length === 0)
    || treeHasEmptyFolder(child)) ?? false;
}

/** findFiles never reports directories, so empty folders need their own walk. */
export async function listEmptyDirectories(
  rootPath: string,
  ignoredNames: readonly string[],
  fsApi: ReaddirApi = fs.promises,
): Promise<string[]> {
  const ignored = new Set(ignoredNames);
  const empty: string[] = [];
  const queue: string[] = [rootPath];
  for (let index = 0; index < queue.length; index += 1) {
    const dir = queue[index];
    let entries: fs.Dirent[];
    try {
      entries = await fsApi.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    if (entries.length === 0 && dir !== rootPath) {
      empty.push(path.relative(rootPath, dir).split(path.sep).join('/'));
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !ignored.has(entry.name)) queue.push(path.join(dir, entry.name));
    }
  }
  return empty.sort();
}
