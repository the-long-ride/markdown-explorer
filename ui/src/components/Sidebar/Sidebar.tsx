import { useState, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { CloseIcon, SearchIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { FileNode, FolderNodeView } from './TreeNode';
import type { ScopeFocusTreeProps } from './TreeNode';
import { getTranslations } from '../../contexts/translations';
import type { FolderNode, MdFile } from '../../types';

function getWorkspaceScopeKey(workspacePath: string | undefined, workspaceName: string): string {
  return workspacePath || workspaceName || 'default';
}

function matchesFileSearch(file: MdFile, filter: string): boolean {
  const q = filter.toLowerCase().trim();
  if (!q) return true;
  return (
    file.title.toLowerCase().includes(q) ||
    file.relativePath.toLowerCase().includes(q)
  );
}

function folderHasVisibleContent(
  node: FolderNode,
  filter: string,
  hideUnselected: boolean,
  selectedFilePaths: Set<string>,
): boolean {
  return (
    node.files.some(
      (file) =>
        matchesFileSearch(file, filter) &&
        (!hideUnselected || selectedFilePaths.has(file.fsPath)),
    ) ||
    node.children.some((child) =>
      folderHasVisibleContent(child, filter, hideUnselected, selectedFilePaths),
    )
  );
}

export function Sidebar() {
  const { state, updateSettings } = useAppState();
  const [filter, setFilter] = useState('');
  const [scopeFocusEditing, setScopeFocusEditing] = useState(false);
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);

  const treeRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  const lastWorkspaceRef = useRef(state.workspaceName);

  const onFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value),
    [],
  );

  const scopeKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
  const scopeFocusMap = state.settings.scopeFocus ?? {};
  const hasScopeEntry = Object.prototype.hasOwnProperty.call(scopeFocusMap, scopeKey);
  const allFilePaths = useMemo(
    () => state.fileList.map((file) => file.fsPath),
    [state.fileList],
  );
  const allFilePathSet = useMemo(() => new Set(allFilePaths), [allFilePaths]);
  const storedScopePaths = scopeFocusMap[scopeKey] ?? [];
  const selectedFilePaths = useMemo(() => {
    if (!hasScopeEntry) return new Set(allFilePaths);
    return new Set(storedScopePaths.filter((filePath) => allFilePathSet.has(filePath)));
  }, [allFilePathSet, allFilePaths, hasScopeEntry, storedScopePaths]);
  const hideUnselected =
    hasScopeEntry &&
    !scopeFocusEditing &&
    selectedFilePaths.size < allFilePaths.length;
  const scopeFocusCount = hasScopeEntry ? selectedFilePaths.size : allFilePaths.length;

  const updateScopeFocusPaths = useCallback(
    (nextPaths: Iterable<string>) => {
      const normalized = [...new Set(nextPaths)].filter((filePath) =>
        allFilePathSet.has(filePath),
      );
      const nextScopeFocus = { ...(state.settings.scopeFocus ?? {}) };
      if (normalized.length >= allFilePaths.length) {
        delete nextScopeFocus[scopeKey];
      } else {
        nextScopeFocus[scopeKey] = normalized;
      }
      updateSettings({ scopeFocus: nextScopeFocus });
    },
    [
      allFilePathSet,
      allFilePaths.length,
      scopeKey,
      state.settings.scopeFocus,
      updateSettings,
    ],
  );

  const handleScopeFileChange = useCallback(
    (filePath: string, checked: boolean) => {
      const nextSelection = new Set(hasScopeEntry ? selectedFilePaths : allFilePaths);
      if (checked) nextSelection.add(filePath);
      else nextSelection.delete(filePath);
      updateScopeFocusPaths(nextSelection);
    },
    [allFilePaths, hasScopeEntry, selectedFilePaths, updateScopeFocusPaths],
  );

  const handleScopeFolderChange = useCallback(
    (filePaths: readonly string[], checked: boolean) => {
      const nextSelection = new Set(hasScopeEntry ? selectedFilePaths : allFilePaths);
      for (const filePath of filePaths) {
        if (checked) nextSelection.add(filePath);
        else nextSelection.delete(filePath);
      }
      updateScopeFocusPaths(nextSelection);
    },
    [allFilePaths, hasScopeEntry, selectedFilePaths, updateScopeFocusPaths],
  );

  const clearScopeFocus = useCallback(() => {
    const nextScopeFocus = { ...(state.settings.scopeFocus ?? {}) };
    delete nextScopeFocus[scopeKey];
    updateSettings({ scopeFocus: nextScopeFocus });
  }, [scopeKey, state.settings.scopeFocus, updateSettings]);

  const scopeFocusTree = useMemo<ScopeFocusTreeProps>(
    () => ({
      editing: scopeFocusEditing,
      hideUnselected,
      selectedFilePaths,
      onFileChange: handleScopeFileChange,
      onFolderChange: handleScopeFolderChange,
    }),
    [
      handleScopeFileChange,
      handleScopeFolderChange,
      hideUnselected,
      scopeFocusEditing,
      selectedFilePaths,
    ],
  );

  const visibleRootFiles = state.tree?.files.filter(
    (file) =>
      matchesFileSearch(file, filter) &&
      (!hideUnselected || selectedFilePaths.has(file.fsPath)),
  ) ?? [];
  const visibleRootChildren = state.tree?.children.filter((child) =>
    folderHasVisibleContent(child, filter, hideUnselected, selectedFilePaths),
  ) ?? [];
  const hasVisibleTreeItems = visibleRootFiles.length > 0 || visibleRootChildren.length > 0;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollPosRef.current = e.currentTarget.scrollTop;
  }, []);

  useLayoutEffect(() => {
    if (treeRef.current) {
      if (lastWorkspaceRef.current !== state.workspaceName) {
        lastWorkspaceRef.current = state.workspaceName;
        scrollPosRef.current = 0;
        treeRef.current.scrollTop = 0;
      } else {
        treeRef.current.scrollTop = scrollPosRef.current;
      }
    }
  }, [state.tree, state.workspaceName]);

  if (!state.tree) return null;

  return (
    <nav
      className={`sidebar${state.sidebarCollapsed ? ' is-collapsed' : ''}`}
      id="sidebar"
      aria-label="File navigation"
    >
      <div className="sidebar__header">
        <div className="sidebar__title">
          {t.sidebar.files}
          <span className="sidebar__count" id="fileCount">
            {state.fileList.length}
          </span>
        </div>
        <div className="sidebar__search">
          <SearchIcon size={12} />
          <input
            type="text"
            placeholder={t.sidebar.filterPlaceholder}
            autoComplete="off"
            value={filter}
            onChange={onFilterChange}
            aria-label={t.sidebar.filterAriaLabel}
          />
        </div>
        <div className="sidebar__scope">
          <button
            type="button"
            className={`sidebar__scope-btn${scopeFocusEditing || hasScopeEntry ? ' is-active' : ''}`}
            onClick={() => setScopeFocusEditing((editing) => !editing)}
            aria-pressed={scopeFocusEditing}
          >
            <span>{t.sidebar.scopeFocus}</span>
            <span className="sidebar__scope-count">
              {scopeFocusCount}/{allFilePaths.length}
            </span>
          </button>
          {hasScopeEntry && (
            <TooltipButton
              type="button"
              className="sidebar__scope-clear"
              onClick={clearScopeFocus}
              tooltip={t.sidebar.clearScopeFocus}
              tooltipPos="below"
              tooltipAlign="right"
              icon={<CloseIcon size={12} />}
            />
          )}
        </div>
      </div>
      <div 
        className="sidebar__tree" 
        id="sidebarTree" 
        role="tree"
        ref={treeRef}
        onScroll={handleScroll}
      >
        {visibleRootFiles.map((f) => (
          <FileNode key={f.fsPath} file={f} scopeFocus={scopeFocusTree} />
        ))}
        {visibleRootChildren.map((child) => (
          <FolderNodeView
            key={child.path}
            node={child}
            filter={filter}
            scopeFocus={scopeFocusTree}
          />
        ))}
        {!hasVisibleTreeItems && (
          <div className="sidebar__empty-scope">
            {hasScopeEntry ? t.sidebar.noScopeFiles : t.sidebar.noFiles}
          </div>
        )}
      </div>
    </nav>
  );
}
