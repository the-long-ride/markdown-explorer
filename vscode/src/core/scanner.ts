// ============================================================
// core/scanner.ts — Workspace .md file discovery & tree build
// ============================================================

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { MdFile, FolderNode, ScanResult } from '../types';

export class WorkspaceScanner {
  private static readonly MAX_FILES = 1000;

  /** Scan workspace for all .md files, return tree + flat list */
  static async scan(): Promise<ScanResult> {
    const folders = vscode.workspace.workspaceFolders;
    const emptyResult: ScanResult = { tree: WorkspaceScanner.emptyRoot(), flat: [] };

    if (!folders?.length) return emptyResult;

    const config = vscode.workspace.getConfiguration('markdownExplorer');
    const excludePatterns: string[] = config.get('excludePatterns') ?? ['**/node_modules/**', '**/.git/**'];
    const excludeGlob = `{${excludePatterns.join(',')}}`;

    const uris = await vscode.workspace.findFiles('**/*.{md,mdx}', excludeGlob, WorkspaceScanner.MAX_FILES);
    uris.sort((a, b) => a.fsPath.localeCompare(b.fsPath));

    const rootPath = folders[0].uri.fsPath;
    const flat: MdFile[] = uris.map(uri => WorkspaceScanner.buildFileEntry(uri.fsPath, rootPath));
    const tree = WorkspaceScanner.buildTree(flat);

    return { tree, flat };
  }

  /** Safely read a file's contents */
  static readFile(fsPath: string): string {
    try {
      const openDoc = vscode.workspace.textDocuments.find(
        doc => doc.fileName && path.normalize(doc.fileName) === path.normalize(fsPath)
      );
      if (openDoc) {
        return openDoc.getText();
      }
      return fs.readFileSync(fsPath, 'utf8');
    } catch {
      return '';
    }
  }

  // ── Private helpers ────────────────────────────────────────

  private static buildFileEntry(fsPath: string, rootPath: string): MdFile {
    const relativePath = path.relative(rootPath, fsPath);
    const parts = relativePath.split(path.sep);
    const fileName = parts[parts.length - 1];
    const isMdx = fileName.endsWith('.mdx');
    const title = WorkspaceScanner.extractTitle(fsPath, isMdx) ?? fileName.replace(/\.(md|mdx)$/i, '');
    return Object.freeze({ fsPath, relativePath, parts, fileName, title });
  }

  private static extractTitle(fsPath: string, isMdx = false): string | null {
    try {
      const openDoc = vscode.workspace.textDocuments.find(
        doc => doc.fileName && path.normalize(doc.fileName) === path.normalize(fsPath)
      );
      const content = openDoc ? openDoc.getText() : fs.readFileSync(fsPath, 'utf8');
      if (isMdx) {
        const mdxTitle = WorkspaceScanner.extractMdxTitle(content);
        if (mdxTitle) return mdxTitle;
      }
      const match = /^#+\s+(.+)$/m.exec(content);
      return match?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  private static extractMdxTitle(content: string): string | null {
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

  private static buildTree(flat: MdFile[]): FolderNode {
    const root = WorkspaceScanner.emptyRoot();

    for (const file of flat) {
      let node = root;
      const dirs = file.parts.slice(0, -1); // all but filename

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

  private static emptyRoot(): FolderNode {
    return { name: 'root', path: '', children: [], files: [] };
  }
}
