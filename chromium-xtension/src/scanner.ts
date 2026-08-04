// =============================================================================
// chrome/src/scanner.ts — Async directory scanner for local File System Access API
// =============================================================================

import type { MdFile, FolderNode } from '../../ui/src/types';

export class BrowserScanner {
  private static readonly TITLE_CHUNK_BYTES = 8 * 1024;
  private static readonly TITLE_CONCURRENCY = 32;

  static async scan(
    rootHandle: FileSystemDirectoryHandle,
    options: {
      onProgress?: (count: number) => void;
      onFile?: (file: MdFile, count: number) => void;
      isCurrent?: () => boolean;
    } = {},
  ): Promise<{ tree: FolderNode; flat: MdFile[] }> {
    const flat: MdFile[] = [];
    const discovered: Array<{
      handle: FileSystemFileHandle;
      relativePath: string;
    }> = [];
    const excludes = ['.git', 'node_modules', '.vscode', 'out', 'dist'];
    const isCurrent = options.isCurrent ?? (() => true);

    // Define traverse as a local recursive helper
    async function traverse(currentHandle: FileSystemDirectoryHandle, currentRelativePath: string) {
      if (!isCurrent()) return;
      // Typecast values iterator since TS types for FileSystemDirectoryHandle might vary
      const entries = (currentHandle as any).values();
      for await (const entry of entries) {
        if (!isCurrent()) return;
        if (excludes.includes(entry.name)) continue;

        const relativePath = currentRelativePath ? `${currentRelativePath}/${entry.name}` : entry.name;

        if (entry.kind === 'directory') {
          await traverse(entry, relativePath);
        } else if (entry.kind === 'file') {
          const lowerName = entry.name.toLowerCase();
          if (lowerName.endsWith('.md') || lowerName.endsWith('.mdx')) {
            discovered.push({ handle: entry, relativePath });
          }
        }
      }
    }

    await traverse(rootHandle, '');
    if (!isCurrent()) return { tree: BrowserScanner.buildTree([]), flat: [] };
    for (let index = 0; index < discovered.length; index += BrowserScanner.TITLE_CONCURRENCY) {
      if (!isCurrent()) return { tree: BrowserScanner.buildTree(flat), flat };
      const batch = discovered.slice(index, index + BrowserScanner.TITLE_CONCURRENCY);
      await Promise.all(
        batch.map(async file => {
          if (!isCurrent()) return null;
          const entry = await BrowserScanner.buildFileEntry(file.handle, file.relativePath);
          if (!isCurrent()) return null;
          options.onFile?.(entry, flat.length + 1);
          flat.push(entry);
          return entry;
        }),
      );
      if (!isCurrent()) return { tree: BrowserScanner.buildTree(flat), flat };
      options.onProgress?.(flat.length);
    }
    flat.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    if (discovered.length === 0) options.onProgress?.(0);
    const tree = BrowserScanner.buildTree(flat);
    return { tree, flat };
  }

  static async buildFileEntry(fileHandle: FileSystemFileHandle, relativePath: string): Promise<MdFile> {
    const parts = relativePath.split('/');
    const fileName = parts[parts.length - 1];
    const extIdx = fileName.lastIndexOf('.');
    const ext = extIdx !== -1 ? fileName.slice(extIdx).toLowerCase() : '';
    const isMdx = ext === '.mdx';

    let title = '';
    let modifiedAt = 0;
    try {
      const file = await fileHandle.getFile();
      modifiedAt = Number.isFinite(file.lastModified) ? file.lastModified : 0;
      const titleSource = typeof file.slice === 'function'
        ? file.slice(0, BrowserScanner.TITLE_CHUNK_BYTES)
        : file;
      const content = await titleSource.text();
      title = BrowserScanner.extractTitle(content, isMdx) || BrowserScanner.stripKnownExtension(fileName);
    } catch (err) {
      title = BrowserScanner.stripKnownExtension(fileName);
    }

    return {
      fsPath: relativePath,
      relativePath,
      parts,
      fileName,
      title,
      extension: ext,
      documentKind: 'markdown',
      modifiedAt
    };
  }

  static stripKnownExtension(fileName: string): string {
    const extIdx = fileName.lastIndexOf('.');
    return extIdx !== -1 ? fileName.slice(0, extIdx) : fileName;
  }

  static extractTitle(content: string, isMdx = false): string | null {
    if (isMdx) {
      const mdxTitle = BrowserScanner.extractMdxTitle(content);
      if (mdxTitle) return mdxTitle;
    }
    const match = /^#+\s+(.+)$/m.exec(content);
    return match?.[1]?.trim() ?? null;
  }

  static extractMdxTitle(content: string): string | null {
    // 1. Frontmatter title
    const fmMatch = /^---\n([\s\S]*?)\n---/.exec(content);
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const sep = line.indexOf(':');
        if (sep > 0 && line.slice(0, sep).trim() === 'title') {
          return line.slice(sep + 1).trim().replace(/^['"]|['"]$/g, '');
        }
      }
    }

    // 2. export const title = ...
    const exportMatch = /export\s+(?:const|let|var)\s+title\s*=\s*(['"`])(.*?)\1/.exec(content);
    if (exportMatch) {
      return exportMatch[2].trim();
    }

    // 3. export const meta = { title: ... }
    const metaMatch = /export\s+(?:const|let|var)\s+meta\s*=\s*\{[\s\S]*?title\s*:\s*(['"`])(.*?)\1/.exec(content);
    if (metaMatch) {
      return metaMatch[2].trim();
    }

    // 4. JSX title prop
    const jsxMatch = /<[A-Z]\w*\s+[^>]*?title=(?:(['"`])(.*?)\1|\{(['"`])(.*?)\3\})/.exec(content);
    if (jsxMatch) {
      return jsxMatch[2]?.trim() ?? jsxMatch[4]?.trim() ?? null;
    }

    return null;
  }

  static buildTree(flat: MdFile[]): FolderNode {
    const root: FolderNode = { name: 'root', path: '', children: [], files: [], modifiedAt: 0 };
    const childIndexes = new WeakMap<FolderNode, Map<string, FolderNode>>();

    for (const file of flat) {
      let node = root;
      const modifiedAt = file.modifiedAt ?? 0;
      node.modifiedAt = Math.max(node.modifiedAt ?? 0, modifiedAt);
      const dirs = file.parts.slice(0, -1);

      for (let i = 0; i < dirs.length; i++) {
        const name = dirs[i];
        let childIndex = childIndexes.get(node);
        if (!childIndex) {
          childIndex = new Map<string, FolderNode>();
          childIndexes.set(node, childIndex);
        }
        let child = childIndex.get(name);
        if (!child) {
          child = { name, path: dirs.slice(0, i + 1).join('/'), children: [], files: [], modifiedAt: 0 };
          node.children.push(child);
          childIndex.set(name, child);
        }
        node = child;
        node.modifiedAt = Math.max(node.modifiedAt ?? 0, modifiedAt);
      }

      node.files.push(file);
    }

    return root;
  }
}
