import type { MdFile } from '../types/files';

interface ExportNavigationFileNode {
  kind: 'file';
  file: MdFile;
  label: string;
}

interface ExportNavigationFolderNode {
  kind: 'folder';
  label: string;
  children: ExportNavigationNode[];
  folders: Map<string, ExportNavigationFolderNode>;
}

type ExportNavigationNode = ExportNavigationFileNode | ExportNavigationFolderNode;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
}

function pathParts(file: MdFile): string[] {
  return file.relativePath.replace(/\\/g, '/').split('/').filter((part) => part && part !== '.');
}

function buildTree(files: readonly MdFile[]): ExportNavigationNode[] {
  const root: ExportNavigationFolderNode = { kind: 'folder', label: '', children: [], folders: new Map() };

  for (const file of files) {
    const parts = pathParts(file);
    if (parts.length === 0) continue;
    let parent = root;
    for (const folderLabel of parts.slice(0, -1)) {
      let folder = parent.folders.get(folderLabel);
      if (!folder) {
        folder = { kind: 'folder', label: folderLabel, children: [], folders: new Map() };
        parent.folders.set(folderLabel, folder);
        parent.children.push(folder);
      }
      parent = folder;
    }
    parent.children.push({ kind: 'file', file, label: parts[parts.length - 1] || file.fileName || file.relativePath });
  }

  return root.children;
}

function renderFileLink(file: MdFile, label: string, currentFile: MdFile | null, hrefFor: (file: MdFile) => string): string {
  const active = Boolean(currentFile && currentFile.fsPath === file.fsPath);
  const className = `mdn-export-tree-file${active ? ' is-active' : ''}`;
  const current = active ? ' aria-current="page"' : '';
  return `<a class="${className}"${current} href="${escapeHtml(hrefFor(file))}">${escapeHtml(label)}</a>`;
}

function renderNodes(nodes: readonly ExportNavigationNode[], currentFile: MdFile | null, hrefFor: (file: MdFile) => string): string {
  return nodes.map((node) => {
    if (node.kind === 'file') return renderFileLink(node.file, node.label, currentFile, hrefFor);
    return `<details class="mdn-export-tree-folder" open><summary>${escapeHtml(node.label)}</summary><div class="mdn-export-tree-children">${renderNodes(node.children, currentFile, hrefFor)}</div></details>`;
  }).join('');
}

export function buildExportExplorerNavigation(
  files: readonly MdFile[],
  currentFile: MdFile | null,
  hrefFor: (file: MdFile) => string,
): { treeHtml: string; listHtml: string } {
  const treeHtml = renderNodes(buildTree(files), currentFile, hrefFor);
  const listHtml = files.map((file) => renderFileLink(file, file.relativePath, currentFile, hrefFor)).join('');
  return { treeHtml, listHtml };
}
