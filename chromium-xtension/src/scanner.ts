// =============================================================================
// chrome/src/scanner.ts — Async directory scanner for local File System Access API
// =============================================================================

import type { MdFile, FolderNode } from '../../ui/src/types';

export class BrowserScanner {
  static async scan(rootHandle: FileSystemDirectoryHandle): Promise<{ tree: FolderNode; flat: MdFile[] }> {
    const flat: MdFile[] = [];
    const maxFiles = 1000;
    const excludes = ['.git', 'node_modules', '.vscode', 'out', 'dist'];

    // Define traverse as a local recursive helper
    async function traverse(currentHandle: FileSystemDirectoryHandle, currentRelativePath: string) {
      if (flat.length >= maxFiles) return;

      // Typecast values iterator since TS types for FileSystemDirectoryHandle might vary
      const entries = (currentHandle as any).values();
      for await (const entry of entries) {
        if (excludes.includes(entry.name)) continue;

        const relativePath = currentRelativePath ? `${currentRelativePath}/${entry.name}` : entry.name;

        if (entry.kind === 'directory') {
          await traverse(entry, relativePath);
        } else if (entry.kind === 'file') {
          const lowerName = entry.name.toLowerCase();
          if (lowerName.endsWith('.md') || lowerName.endsWith('.mdx')) {
            const fileEntry = await BrowserScanner.buildFileEntry(entry, relativePath);
            flat.push(fileEntry);
            if (flat.length >= maxFiles) break;
          }
        }
      }
    }

    await traverse(rootHandle, '');
    flat.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
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
    try {
      const file = await fileHandle.getFile();
      const content = await file.text();
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
      documentKind: 'markdown'
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
    const root: FolderNode = { name: 'root', path: '', children: [], files: [] };

    for (const file of flat) {
      let node = root;
      const dirs = file.parts.slice(0, -1);

      for (let i = 0; i < dirs.length; i++) {
        const name = dirs[i];
        let child = node.children.find(c => c.name === name);
        if (!child) {
          child = { name, path: dirs.slice(0, i + 1).join('/'), children: [], files: [] };
          node.children.push(child);
        }
        node = child;
      }

      node.files.push(file);
    }

    return root;
  }
}
