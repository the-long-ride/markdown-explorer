// =============================================================================
// components/Sidebar/TreeNode.tsx — Recursive file/folder tree node
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import type { FolderNode, MdFile } from '../../types';
import { FolderIcon, FolderChevronIcon } from '../shared/icons';

export interface ScopeFocusTreeProps {
  editing: boolean;
  hideUnselected: boolean;
  selectedFilePaths: Set<string>;
  onFileChange: (filePath: string, checked: boolean) => void;
  onFolderChange: (filePaths: readonly string[], checked: boolean) => void;
}

function matchesFileSearch(file: MdFile, q: string): boolean {
  if (!q) return true;
  return (
    file.title.toLowerCase().includes(q) ||
    file.relativePath.toLowerCase().includes(q)
  );
}

function getFolderFilePaths(node: FolderNode): string[] {
  return [
    ...node.files.map((file) => file.fsPath),
    ...node.children.flatMap(getFolderFilePaths),
  ];
}

function isFileVisible(file: MdFile, q: string, scopeFocus: ScopeFocusTreeProps): boolean {
  if (!matchesFileSearch(file, q)) return false;
  if (scopeFocus.hideUnselected && !scopeFocus.selectedFilePaths.has(file.fsPath)) {
    return false;
  }
  return true;
}

function folderHasVisibleContent(
  node: FolderNode,
  q: string,
  scopeFocus: ScopeFocusTreeProps,
): boolean {
  return (
    node.files.some((file) => isFileVisible(file, q, scopeFocus)) ||
    node.children.some((child) => folderHasVisibleContent(child, q, scopeFocus))
  );
}

function ScopeCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="scope-focus-checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    />
  );
}

export function FileNode({
  file,
  scopeFocus,
}: {
  file: MdFile;
  scopeFocus?: ScopeFocusTreeProps;
}) {
  const { state, navigate } = useAppState();
  const isActive = state.currentFile === file.fsPath;
  const displayName = state.settings.showTitle ? file.title : file.fileName;
  const isChecked = scopeFocus?.selectedFilePaths.has(file.fsPath) ?? true;

  return (
    <div
      className={`tree-file${isActive ? ' is-active' : ''}${scopeFocus?.editing ? ' is-scope-editing' : ''}`}
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
      {scopeFocus?.editing && (
        <ScopeCheckbox
          checked={isChecked}
          label={`Show ${displayName}`}
          onChange={(checked) => scopeFocus.onFileChange(file.fsPath, checked)}
        />
      )}
    </div>
  );
}

export function FolderNodeView({
  node,
  filter,
  scopeFocus,
}: {
  node: FolderNode;
  filter: string;
  scopeFocus: ScopeFocusTreeProps;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const q = filter.toLowerCase().trim();
  const descendantFilePaths = getFolderFilePaths(node);
  const selectedDescendantCount = descendantFilePaths.filter((filePath) =>
    scopeFocus.selectedFilePaths.has(filePath),
  ).length;
  const folderChecked =
    descendantFilePaths.length > 0 &&
    selectedDescendantCount === descendantFilePaths.length;
  const folderIndeterminate =
    selectedDescendantCount > 0 &&
    selectedDescendantCount < descendantFilePaths.length;

  const visibleFiles = node.files.filter((file) => isFileVisible(file, q, scopeFocus));
  const visibleChildren = node.children.filter((child) =>
    folderHasVisibleContent(child, q, scopeFocus),
  );

  if (!folderHasVisibleContent(node, q, scopeFocus)) return null;

  return (
    <div
      className={`tree-folder${isOpen ? ' is-open' : ''}${scopeFocus.editing ? ' is-scope-editing' : ''}`}
      role="treeitem"
    >
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
        {scopeFocus.editing && (
          <ScopeCheckbox
            checked={folderChecked}
            indeterminate={folderIndeterminate}
            label={`Show ${node.name}`}
            onChange={(checked) => scopeFocus.onFolderChange(descendantFilePaths, checked)}
          />
        )}
      </div>
      {isOpen && (
        <div className="tree-folder__children" role="group">
          {visibleFiles.map((f) => (
            <FileNode key={f.fsPath} file={f} scopeFocus={scopeFocus} />
          ))}
          {visibleChildren.map((child) => (
            <FolderNodeView
              key={child.path}
              node={child}
              filter={filter}
              scopeFocus={scopeFocus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
