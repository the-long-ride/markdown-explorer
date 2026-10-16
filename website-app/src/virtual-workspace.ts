// =============================================================================
// website-app/src/virtual-workspace.ts
// Seeds a simulated workspace from bundled Markdown, then restores browser-local changes.
// =============================================================================

import type { MdFile, FolderNode } from '../../ui/src/types';
import { BrowserScanner } from '../../chromium-xtension/src/scanner';
import { DemoEntryStore } from './demo-entry-store';

// Vite glob import — all .md and .mdx files in the manual-tests directory, as raw strings.
// The keys are relative paths like '../../manual-tests/test-basic.md'
const rawTestFiles = import.meta.glob('../../manual-tests/*.{md,mdx}', {
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
  // Paths may include simulated folders after create/rename operations.
  const fileName = globKey.split('/').pop()!;
  const ext = fileName.includes('.') ? ('.' + fileName.split('.').pop()!.toLowerCase()) : '';
  const isMdx = ext === '.mdx';
  const relativePath = globKey;
  const parts = relativePath.split('/');
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

// ── Public API ────────────────────────────────────────────────────────────────

/** All virtual files as a flat list (sorted by fileName). */
export let virtualFiles: MdFile[] = [];

/** Current folder tree, including simulated empty folders. */
export let virtualTree: FolderNode;

/** Map of relativePath → raw markdown string for fast lookup. */
const bundledContent = new Map<string, string>(
  Object.entries(rawTestFiles).map(([key, raw]) => {
    const fileName = key.split('/').pop()!;
    return [fileName, raw as string];
  }),
);
export const virtualContent = new Map<string, string>();
export const demoEntryStore = new DemoEntryStore(
  [...bundledContent.keys()].map(path => ({ path, kind: 'file', source: path })),
  {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  },
);

export function refreshVirtualWorkspace(): void {
  virtualContent.clear();
  for (const entry of demoEntryStore.entries) {
    if (entry.kind === 'file') virtualContent.set(entry.path, entry.source ? bundledContent.get(entry.source) ?? '' : '');
  }
  virtualFiles = [...virtualContent].map(([path, raw]) => buildFileEntry(path, raw))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  virtualTree = { ...BrowserScanner.buildTree(virtualFiles, demoEntryStore.entries.filter(e => e.kind === 'folder').map(e => e.path)), name: 'Test Workspace' };
}
refreshVirtualWorkspace();

/** Returns the raw markdown for a given relative path, or null if not found. */
export function getVirtualContent(relativePath: string): string | null {
  return virtualContent.get(relativePath) ?? null;
}
