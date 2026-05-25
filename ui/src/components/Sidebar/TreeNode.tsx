// =============================================================================
// components/Sidebar/TreeNode.tsx — Recursive file/folder tree node
// =============================================================================

import { useState, useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import type { FolderNode, MdFile } from '../../types';
import { FolderIcon, FolderChevronIcon } from '../shared/icons';

export function FileNode({ file }: { file: MdFile }) {
  const { state, navigate } = useAppState();
  const isActive = state.currentFile === file.fsPath;
  const displayName = state.settings.showTitle ? file.title : file.fileName;

  return (
    <div
      className={`tree-file${isActive ? ' is-active' : ''}`}
      data-path={file.fsPath}
      data-title={file.title}
      data-filename={file.fileName}
      onClick={() => navigate(file.fsPath)}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(file.fsPath); }}
      title={file.relativePath}
      role="treeitem"
      tabIndex={0}
    >
      <span className="tree-file__name">{displayName}</span>
    </div>
  );
}

export function FolderNodeView({ node, filter }: { node: FolderNode; filter: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const q = filter.toLowerCase().trim();

  // Filter files
  const visibleFiles = q
    ? node.files.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.relativePath.toLowerCase().includes(q),
      )
    : node.files;

  // Recursively check if folder has any visible content
  const hasVisibleChildren = (n: FolderNode): boolean => {
    if (q) {
      const hasFiles = n.files.some(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.relativePath.toLowerCase().includes(q),
      );
      if (hasFiles) return true;
      return n.children.some(hasVisibleChildren);
    }
    return n.files.length > 0 || n.children.some(hasVisibleChildren);
  };

  if (q && !hasVisibleChildren(node)) return null;

  return (
    <div className={`tree-folder${isOpen ? ' is-open' : ''}`} role="treeitem">
      <div
        className="tree-folder__header"
        onClick={toggle}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
      >
        <span className="tree-folder__chevron" aria-hidden="true">
          <FolderChevronIcon />
        </span>
        <FolderIcon />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>
      {isOpen && (
        <div className="tree-folder__children" role="group">
          {visibleFiles.map((f) => (
            <FileNode key={f.fsPath} file={f} />
          ))}
          {node.children.map((child) => (
            <FolderNodeView key={child.path} node={child} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}
