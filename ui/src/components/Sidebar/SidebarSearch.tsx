// =============================================================================
// components/Sidebar/SidebarSearch.tsx — Workspace search panel in sidebar
// =============================================================================

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { CloseIcon, SearchIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { getTranslations } from '../../contexts/translations';
import { FileNode, FolderNodeView } from './TreeNode';
import { buildSearchResultTree, SearchResultFileView, SearchResultFolderView } from './sidebarSearchTree';
import type { ScopeFocusTreeProps } from './TreeNode';
import type { WorkspaceSearchResult } from '../../types';

export interface SidebarSearchStatus {
  isSearching: boolean;
  resultCount: number;
  showCount: boolean;
}

interface SidebarSearchProps {
  isVisible: boolean;
  onStatusChange?: (status: SidebarSearchStatus) => void;
}

function getWorkspaceScopeKey(workspacePath: string | undefined, workspaceName: string): string {
  return workspacePath || workspaceName || 'default';
}

export function SidebarSearch({ isVisible, onStatusChange }: SidebarSearchProps) {
  const { state, updateSettings } = useAppState();
  const bridge = usePlatform();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [scopeFocusEditing, setScopeFocusEditing] = useState(false);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef('');

  // Refs and state to preserve scroll positions
  const resultsTreeRef = useRef<HTMLDivElement>(null);
  const scopeTreeRef = useRef<HTMLDivElement>(null);
  const resultsScrollPosRef = useRef<number>(0);
  const scopeScrollPosRef = useRef<number>(0);

  const handleResultsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    resultsScrollPosRef.current = e.currentTarget.scrollTop;
  };

  const handleScopeScroll = (e: React.UIEvent<HTMLDivElement>) => {
    scopeScrollPosRef.current = e.currentTarget.scrollTop;
  };

  useLayoutEffect(() => {
    if (isVisible) {
      if (scopeFocusEditing && scopeTreeRef.current) {
        scopeTreeRef.current.scrollTop = scopeScrollPosRef.current;
      } else if (!scopeFocusEditing && resultsTreeRef.current) {
        resultsTreeRef.current.scrollTop = resultsScrollPosRef.current;
      }
    }
  }, [isVisible, scopeFocusEditing]);

  // Reset scroll position when query changes
  useEffect(() => {
    resultsScrollPosRef.current = 0;
    if (resultsTreeRef.current) {
      resultsTreeRef.current.scrollTop = 0;
    }
  }, [query]);

  // 1. Sidebar Search Tab Scope Focus States
  const searchScopeKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
  const searchScopeFocusMap = state.settings.searchScopeFocus ?? {};
  const hasSearchScopeEntry = Object.prototype.hasOwnProperty.call(searchScopeFocusMap, searchScopeKey);
  const allFilePaths = useMemo(
    () => state.fileList.map((file) => file.fsPath),
    [state.fileList],
  );
  const allFilePathSet = useMemo(() => new Set(allFilePaths), [allFilePaths]);
  const storedSearchScopePaths = searchScopeFocusMap[searchScopeKey] ?? [];
  const selectedSearchFilePaths = useMemo(() => {
    if (!hasSearchScopeEntry) return new Set(allFilePaths);
    return new Set(storedSearchScopePaths.filter((filePath) => allFilePathSet.has(filePath)));
  }, [allFilePathSet, allFilePaths, hasSearchScopeEntry, storedSearchScopePaths]);

  const selectedSearchFilePathsStr = useMemo(() => {
    return hasSearchScopeEntry
      ? storedSearchScopePaths.filter((filePath) => allFilePathSet.has(filePath)).sort().join(',')
      : 'all';
  }, [allFilePathSet, hasSearchScopeEntry, storedSearchScopePaths]);

  const searchScopeFocusCount = hasSearchScopeEntry ? selectedSearchFilePaths.size : allFilePaths.length;

  const updateSearchScopeFocusPaths = useCallback(
    (nextPaths: Iterable<string>) => {
      const normalized = [...new Set(nextPaths)].filter((filePath) =>
        allFilePathSet.has(filePath),
      );
      const nextSearchScopeFocus = { ...(state.settings.searchScopeFocus ?? {}) };
      if (normalized.length >= allFilePaths.length) {
        delete nextSearchScopeFocus[searchScopeKey];
      } else {
        nextSearchScopeFocus[searchScopeKey] = normalized;
      }
      updateSettings({ searchScopeFocus: nextSearchScopeFocus });
    },
    [allFilePathSet, allFilePaths.length, searchScopeKey, state.settings.searchScopeFocus, updateSettings],
  );

  const handleSearchScopeFileChange = useCallback(
    (filePath: string, checked: boolean) => {
      const nextSelection = new Set(hasSearchScopeEntry ? selectedSearchFilePaths : allFilePaths);
      if (checked) nextSelection.add(filePath);
      else nextSelection.delete(filePath);
      updateSearchScopeFocusPaths(nextSelection);
    },
    [allFilePaths, hasSearchScopeEntry, selectedSearchFilePaths, updateSearchScopeFocusPaths],
  );

  const handleSearchScopeFolderChange = useCallback(
    (filePaths: readonly string[], checked: boolean) => {
      const nextSelection = new Set(hasSearchScopeEntry ? selectedSearchFilePaths : allFilePaths);
      for (const filePath of filePaths) {
        if (checked) nextSelection.add(filePath);
        else nextSelection.delete(filePath);
      }
      updateSearchScopeFocusPaths(nextSelection);
    },
    [allFilePaths, hasSearchScopeEntry, selectedSearchFilePaths, updateSearchScopeFocusPaths],
  );

  const clearSearchScopeFocus = useCallback(() => {
    const nextSearchScopeFocus = { ...(state.settings.searchScopeFocus ?? {}) };
    delete nextSearchScopeFocus[searchScopeKey];
    updateSettings({ searchScopeFocus: nextSearchScopeFocus });
  }, [searchScopeKey, state.settings.searchScopeFocus, updateSettings]);

  const searchScopeFocusTree = useMemo<ScopeFocusTreeProps>(
    () => ({
      editing: scopeFocusEditing,
      hideUnselected: false,
      selectedFilePaths: selectedSearchFilePaths,
      onFileChange: handleSearchScopeFileChange,
      onFolderChange: handleSearchScopeFolderChange,
    }),
    [
      handleSearchScopeFileChange,
      handleSearchScopeFolderChange,
      scopeFocusEditing,
      selectedSearchFilePaths,
    ],
  );

  // 2. Tree toggle collapse state
  const togglePath = useCallback((path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // 3. Search IPC Wire
  useEffect(() => {
    return bridge.onMessage((msg) => {
      if (
        msg.command === 'workspaceSearchResults' &&
        msg.requestId === requestIdRef.current
      ) {
        setResults(msg.results as WorkspaceSearchResult[]);
        setIsSearching(false);
      }
    });
  }, [bridge]);

  // Debounced search logic
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    requestIdRef.current = requestId;
    setIsSearching(true);

    const itemsToSearch = state.fileList
      .filter((file) => selectedSearchFilePaths.has(file.fsPath))
      .map((file) => ({
        fsPath: file.fsPath,
        title: file.title,
        fileName: file.fileName,
        relativePath: file.relativePath,
      }));

    const handle = window.setTimeout(() => {
      bridge.postMessage({
        command: 'searchWorkspace',
        requestId,
        query,
        matchCase,
        items: itemsToSearch,
      });
    }, 250);

    return () => window.clearTimeout(handle);
  }, [bridge, query, matchCase, state.fileList, selectedSearchFilePathsStr]);

  // Focus event listener
  useEffect(() => {
    const focusInput = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('focus-sidebar-search-input', focusInput);
    return () => window.removeEventListener('focus-sidebar-search-input', focusInput);
  }, []);

  // Report status to parent for fading title-actions
  useEffect(() => {
    onStatusChange?.({
      isSearching,
      resultCount: results.length,
      showCount: query.trim().length >= 2 && results.length > 0 && !scopeFocusEditing,
    });
  }, [isSearching, results.length, query, scopeFocusEditing, onStatusChange]);

  // Build recursive tree from flat results
  const fileMap = useMemo(() => {
    const map = new Map<string, WorkspaceSearchResult[]>();
    for (const res of results) {
      const list = map.get(res.fsPath) ?? [];
      list.push(res);
      map.set(res.fsPath, list);
    }
    return map;
  }, [results]);

  const searchResultTree = useMemo(() => {
    if (!state.tree || fileMap.size === 0) return null;
    return buildSearchResultTree(state.tree, fileMap);
  }, [state.tree, fileMap]);

  const hasVisibleTreeItems =
    searchResultTree &&
    (searchResultTree.files.length > 0 || searchResultTree.children.length > 0);

  // Scope Focus Checklist Trees
  const visibleRootFiles = state.tree?.files.filter(
    (file) => !selectedSearchFilePaths || selectedSearchFilePaths.has(file.fsPath) || scopeFocusEditing
  ) ?? [];
  const visibleRootChildren = state.tree?.children ?? [];

  return (
    <>
      <div className="sidebar__header-fields">
        <div className="sidebar__search">
          <SearchIcon size={15} />
          <input
            ref={inputRef}
            type="text"
            placeholder={t.search.sidebarPlaceholder}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t.search.sidebarInputLabel}
          />
          <TooltipButton
            type="button"
            className={`sidebar__search-case${matchCase ? ' is-active' : ''}`}
            onClick={() => setMatchCase((value) => !value)}
            tooltip={`${t.search.matchCase} - ${matchCase ? (t.search.statusOn || 'On') : (t.search.statusOff || 'Off')}`}
            aria-label={t.search.matchCase}
            tooltipPos="below"
            tooltipAlign="right"
            aria-pressed={matchCase}
          >
            Aa
          </TooltipButton>
        </div>
        <div className="sidebar__scope">
          <button
            type="button"
            className={`sidebar__scope-btn${scopeFocusEditing || hasSearchScopeEntry ? ' is-active' : ''}`}
            onClick={() => setScopeFocusEditing((editing) => !editing)}
            aria-pressed={scopeFocusEditing}
          >
            <span>{t.sidebar.scopeFocus}</span>
            <span className="sidebar__scope-count">
              {searchScopeFocusCount}/{allFilePaths.length}
            </span>
          </button>
          {hasSearchScopeEntry && (
            <TooltipButton
              type="button"
              className="sidebar__scope-clear"
              onClick={clearSearchScopeFocus}
              tooltip={t.sidebar.clearScopeFocus}
              tooltipPos="below"
              tooltipAlign="right"
              icon={<CloseIcon size={12} />}
            />
          )}
        </div>
      </div>

      {scopeFocusEditing ? (
        <div
          className="sidebar__tree sidebar__tree--from-right"
          id="searchScopeTree"
          role="tree"
          ref={scopeTreeRef}
          onScroll={handleScopeScroll}
        >
          {visibleRootFiles.map((f) => (
            <FileNode
              key={f.fsPath}
              file={f}
              scopeFocus={searchScopeFocusTree}
            />
          ))}
          {visibleRootChildren.map((child) => (
            <FolderNodeView
              key={child.path}
              node={child}
              filter=""
              scopeFocus={searchScopeFocusTree}
            />
          ))}
        </div>
      ) : (
        <div
          className="sidebar__tree sidebar__tree--from-right"
          id="searchResultsTree"
          ref={resultsTreeRef}
          onScroll={handleResultsScroll}
        >
          {query.trim().length < 2 && (
            <div className="sidebar__empty-scope sidebar__search-empty">
              {t.search.minimumCharacters}
            </div>
          )}
          {query.trim().length >= 2 && isSearching && results.length === 0 && (
            <div className="sidebar__empty-scope sidebar__search-empty">
              {t.search.searchingWorkspace}
            </div>
          )}
          {query.trim().length >= 2 && !isSearching && results.length === 0 && (
            <div className="sidebar__empty-scope sidebar__search-empty">
              {t.search.noMatches}
            </div>
          )}
          {query.trim().length >= 2 && hasVisibleTreeItems && (
            <>
              {searchResultTree.files.map((file) => (
                <SearchResultFileView
                  key={file.fsPath}
                  file={file}
                  query={query}
                  matchCase={matchCase}
                  collapsedPaths={collapsedPaths}
                  togglePath={togglePath}
                />
              ))}
              {searchResultTree.children.map((child) => (
                <SearchResultFolderView
                  key={child.path}
                  node={child}
                  query={query}
                  matchCase={matchCase}
                  collapsedPaths={collapsedPaths}
                  togglePath={togglePath}
                />
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
