// =============================================================================
// website-app/src/virtual-workspace.ts
// Builds a virtual MdFile[] + FolderNode tree from bundled test markdown files.
// Vite's import.meta.glob with ?raw imports all test/*.md files as strings.
// =============================================================================

import type { MdFile, FolderNode } from '../../ui/src/types';

// Vite glob import — all .md and .mdx files in the test directory, as raw strings.
// The keys are relative paths like '../../test/test-basic.md'
const rawTestFiles = import.meta.glob('../../test/*.{md,mdx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// ── Internal helpers ──────────────────────────────────────────────────────────

function extractTitle(raw: string, isMdx: boolean): string | null {
  if (isMdx) {
    // Try frontmatter title
    const fmMatch = /^---\n([\s\S]*?)\n---/.exec(raw);
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const sep = line.indexOf(':');
        if (sep > 0 && line.slice(0, sep).trim() === 'title') {
          return line.slice(sep + 1).trim().replace(/^['"]|['"]$/g, '');
        }
      }
    }
  }
  const match = /^#+\s+(.+)$/m.exec(raw);
  return match?.[1]?.trim() ?? null;
}

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx !== -1 ? fileName.slice(0, idx) : fileName;
}

function buildFileEntry(globKey: string, raw: string): MdFile {
  // globKey: '../../test/test-basic.md' → fileName: 'test-basic.md'
  const fileName = globKey.split('/').pop()!;
  const ext = fileName.includes('.') ? ('.' + fileName.split('.').pop()!.toLowerCase()) : '';
  const isMdx = ext === '.mdx';
  const relativePath = fileName; // flat — all test files are at root level
  const parts = [fileName];
  const title = extractTitle(raw, isMdx) || stripExtension(fileName);

  return {
    fsPath: relativePath,
    relativePath,
    parts,
    fileName,
    title,
    extension: ext,
    documentKind: 'markdown',
    modifiedAt: 0,
  };
}

function buildTree(flat: MdFile[]): FolderNode {
  return {
    name: 'Test Workspace',
    path: '',
    children: [],
    files: [...flat],
    modifiedAt: Math.max(0, ...flat.map((file) => file.modifiedAt ?? 0)),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** All virtual files as a flat list (sorted by fileName). */
export const virtualFiles: MdFile[] = Object.entries(rawTestFiles)
  .map(([key, raw]) => buildFileEntry(key, raw as string))
  .sort((a, b) => a.fileName.localeCompare(b.fileName));

/** Folder tree — single root node containing all test files. */
export const virtualTree: FolderNode = buildTree(virtualFiles);

/** Map of relativePath → raw markdown string for fast lookup. */
export const virtualContent = new Map<string, string>(
  Object.entries(rawTestFiles).map(([key, raw]) => {
    const fileName = key.split('/').pop()!;
    return [fileName, raw as string];
  }),
);

/** Returns the raw markdown for a given relative path, or null if not found. */
export function getVirtualContent(relativePath: string): string | null {
  return virtualContent.get(relativePath) ?? null;
}
