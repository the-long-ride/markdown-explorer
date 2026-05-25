// =============================================================================
// components/Sidebar/Sidebar.tsx — File navigation sidebar
// =============================================================================

import { useState, useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { SearchIcon } from '../shared/icons';
import { FileNode, FolderNodeView } from './TreeNode';

export function Sidebar() {
  const { state } = useAppState();
  const [filter, setFilter] = useState('');

  const onFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value),
    [],
  );

  if (!state.tree) return null;

  return (
    <nav
      className={`sidebar${state.sidebarCollapsed ? ' is-collapsed' : ''}`}
      id="sidebar"
      aria-label="File navigation"
    >
      <div className="sidebar__header">
        <div className="sidebar__title">
          Files
          <span className="sidebar__count" id="fileCount">
            {state.fileList.length}
          </span>
        </div>
        <div className="sidebar__search">
          <SearchIcon size={12} />
          <input
            type="text"
            placeholder="Filter files…"
            autoComplete="off"
            value={filter}
            onChange={onFilterChange}
            aria-label="Filter file list"
          />
        </div>
      </div>
      <div className="sidebar__tree" id="sidebarTree" role="tree">
        {state.tree.files.map((f) => (
          <FileNode key={f.fsPath} file={f} />
        ))}
        {state.tree.children.map((child) => (
          <FolderNodeView key={child.path} node={child} filter={filter} />
        ))}
      </div>
    </nav>
  );
}
