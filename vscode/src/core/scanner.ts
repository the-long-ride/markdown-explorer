// ============================================================
// core/scanner.ts — Workspace .md file discovery & tree build
// ============================================================

import * as path from 'path';
import * as fs from 'fs';
import type { MdFile, FolderNode, ScanResult } from '../types';
import {
  getExtension,
  isMarkdownFilePath,
  isSupportedFilePath,
  stripKnownExtension,
} from './documentConversion';

export interface WorkspaceContext {
  workspaceFolders: Array<{ uri: { fsPath: string } }> | undefined;
  getConfiguration(section: string): { get<T>(key: string): T | undefined };
  findFiles(include: string, exclude: string, maxResults: number): Promise<Array<{ fsPath: string }>>;
  textDocuments: Array<{ fileName?: string; getText(): string }>;
}

function getDefaultWorkspaceContext(): WorkspaceContext | null {
  try {
    const vscode = require('vscode');
    return {
      get workspaceFolders() { return vscode.workspace.workspaceFolders; },
      getConfiguration(section: string) {
        return vscode.workspace.getConfiguration(section);
      },
      findFiles(include: string, exclude: string, maxResults: number) {
        return vscode.workspace.findFiles(include, exclude, maxResults);
      },
      get textDocuments() { return vscode.workspace.textDocuments; },
    };
  } catch {
    return null;
  }
}

let _defaultContext: WorkspaceContext | null | undefined;

function getContext(): WorkspaceContext | null {
  if (_defaultContext === undefined) {
    _defaultContext = getDefaultWorkspaceContext();
  }
  return _defaultContext;
}

export function setWorkspaceContextForTest(ctx: WorkspaceContext | null): void {
  _defaultContext = ctx;
}

export class WorkspaceScanner {
  private static readonly MAX_FILES = 1000;

  /** Scan workspace for all .md files, return tree + flat list */
  static async scan(
    documentConversionEnabled = false,
    reportProgress: (count: number) => void = () => {},
  ): Promise<ScanResult> {
    const ctx = getContext();
    if (!ctx) throw new Error('vscode workspace not available');

    const folders = ctx.workspaceFolders;
    const emptyResult: ScanResult = { tree: WorkspaceScanner.emptyRoot(), flat: [] };

    if (!folders?.length) return emptyResult;

    const config = ctx.getConfiguration('markdownExplorer');
    const excludePatterns: string[] = config.get('excludePatterns') ?? ['**/node_modules/**', '**/.git/**'];
    const excludeGlob = `{${excludePatterns.join(',')}}`;

    const includeGlob = documentConversionEnabled
      ? '**/*.{md,mdx,doc,docx,pdf,html,xls,xlsx,xlm,pptx,odt,odp,ods,rtf,txt}'
      : '**/*.{md,mdx,txt}';
    const uris = (await ctx.findFiles(
      includeGlob,
      excludeGlob,
      WorkspaceScanner.MAX_FILES,
    )).filter(uri => isSupportedFilePath(uri.fsPath, documentConversionEnabled));
    uris.sort((a, b) => a.fsPath.localeCompare(b.fsPath));

    const rootPath = folders[0].uri.fsPath;
    const flat: MdFile[] = [];
    for (const uri of uris) {
      flat.push(WorkspaceScanner.buildFileEntry(uri.fsPath, rootPath));
      if (flat.length % 100 === 0) {
        reportProgress(flat.length);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
    reportProgress(flat.length);
    const tree = WorkspaceScanner.buildTree(flat);

    return { tree, flat };
  }

  /** Safely read a file's contents */
  static readFile(fsPath: string): string {
    try {
      const ctx = getContext();
      if (ctx) {
        const openDoc = ctx.textDocuments.find(
          doc => doc.fileName && path.normalize(doc.fileName) === path.normalize(fsPath)
        );
        if (openDoc) {
          return openDoc.getText();
        }
      }
      return fs.readFileSync(fsPath, 'utf8');
    } catch {
      return '';
    }
  }

  // ── Helpers ────────────────────────────────────────

  static buildFileEntry(fsPath: string, rootPath: string): MdFile {
    const relativePath = path.relative(rootPath, fsPath);
    const parts = relativePath.split(path.sep);
    const fileName = parts[parts.length - 1];
    const ext = getExtension(fileName);
    const isMarkdown = isMarkdownFilePath(fileName);
    const isMdx = ext === '.mdx';
    const title = isMarkdown
      ? WorkspaceScanner.extractTitle(fsPath, isMdx) ?? stripKnownExtension(fileName)
      : stripKnownExtension(fileName);
    const documentKind = isMarkdown ? 'markdown' : 'document';
    return Object.freeze({ fsPath, relativePath, parts, fileName, title, extension: ext, documentKind });
  }

  static extractTitle(fsPath: string, isMdx = false): string | null {
    try {
      const ctx = getContext();
      if (ctx) {
        const openDoc = ctx.textDocuments.find(
          doc => doc.fileName && path.normalize(doc.fileName) === path.normalize(fsPath)
        );
        if (openDoc) {
          const content = openDoc.getText();
          if (isMdx) {
            const mdxTitle = WorkspaceScanner.extractMdxTitle(content);
            if (mdxTitle) return mdxTitle;
          }
          const match = /^#+\s+(.+)$/m.exec(content);
          return match?.[1]?.trim() ?? null;
        }
      }
      const content = fs.readFileSync(fsPath, 'utf8');
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
