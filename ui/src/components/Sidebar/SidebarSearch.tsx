// =============================================================================
// components/Sidebar/SidebarSearch.tsx — Workspace search panel in sidebar
// =============================================================================

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { CloseIcon, SearchIcon, FolderIcon, FolderChevronIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { unicodeIndexOf } from '../../utils/unicodeSearch';
import { getTranslations } from '../../contexts/translations';
import { FileNode, FolderNodeView } from './TreeNode';
import type { ScopeFocusTreeProps } from './TreeNode';
import type { FolderNode, WorkspaceSearchResult } from '../../types';

export interface SidebarSearchStatus {
  isSearching: boolean;
  resultCount: number;
  showCount: boolean;
}

interface SidebarSearchProps {
  isVisible: boolean;
  onStatusChange?: (status: SidebarSearchStatus) => void;
}

interface SearchResultFileNode {
  kind: 'file';
  fsPath: string;
  fileName: string;
  relativePath: string;
  title: string;
  matches: WorkspaceSearchResult[];
}

interface SearchResultFolderNode {
  kind: 'folder';
  name: string;
  path: string;
  children: SearchResultFolderNode[];
  files: SearchResultFileNode[];
}

function getWorkspaceScopeKey(workspacePath: string | undefined, workspaceName: string): string {
  return workspacePath || workspaceName || 'default';
}

function buildSearchResultTree(
  node: FolderNode,
  fileMap: Map<string, WorkspaceSearchResult[]>,
): SearchResultFolderNode | null {
  const files: SearchResultFileNode[] = [];
  for (const file of node.files) {
    const matches = fileMap.get(file.fsPath);
    if (matches) {
      files.push({
        kind: 'file',
        fsPath: file.fsPath,
        fileName: file.fileName,
        relativePath: file.relativePath,
        title: file.title,
        matches,
      });
    }
  }

  const children: SearchResultFolderNode[] = [];
  for (const child of node.children) {
    const childTree = buildSearchResultTree(child, fileMap);
    if (childTree) {
      children.push(childTree);
    }
  }

  if (files.length > 0 || children.length > 0) {
    return {
      kind: 'folder',
      name: node.name,
      path: node.path,
      children,
      files,
    };
  }
  return null;
}

function renderHighlightedExcerpt(excerpt: string, query: string) {
  const needle = query.trim().replace(/\s+/g, ' ');
  if (!needle) return excerpt;

  const pieces = [];
  let cursor = 0;
  let result = unicodeIndexOf(excerpt, needle, 0);

  if (!result) return excerpt;

  while (result) {
    const matchIndex = result.index;
    const matchLength = result.matchLength;

    if (matchIndex > cursor) {
      pieces.push(excerpt.slice(cursor, matchIndex));
    }

    const matchEnd = matchIndex + matchLength;
    pieces.push(
      <strong key={`${matchIndex}-${matchEnd}`}>
        {excerpt.slice(matchIndex, matchEnd)}
      </strong>,
    );

    cursor = matchEnd;
    result = unicodeIndexOf(excerpt, needle, cursor);
  }

  if (cursor < excerpt.length) {
    pieces.push(excerpt.slice(cursor));
  }

  return pieces;
}

interface SearchResultFileViewProps {
  file: SearchResultFileNode;
  query: string;
  collapsedPaths: Set<string>;
  togglePath: (path: string) => void;
}

function SearchResultFileView({ file, query, collapsedPaths, togglePath }: SearchResultFileViewProps) {
  const { state, navigate } = useAppState();
  const isOpen = !collapsedPaths.has(file.fsPath);
  const displayName = state.settings.showTitle ? file.title : file.fileName;

  const handleClickMatch = (match: WorkspaceSearchResult) => {
    window.dispatchEvent(
      new CustomEvent('search-jump', {
        detail: {
          filePath: file.fsPath,
          query,
          matchOrdinal: match.matchOrdinal,
          matchIndex: match.matchIndex,
        },
      }),
    );
    navigate(file.fsPath);
  };

  return (
    <div className={`tree-file-search-group${isOpen ? ' is-open' : ''}`}>
      <div
        className="tree-file-search-header"
        onClick={() => togglePath(file.fsPath)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePath(file.fsPath);
          }
        }}
      >
        <span className="tree-file-search-chevron">
          <FolderChevronIcon />
        </span>
        <span className="tree-file-search-name" title={file.relativePath}>
          {displayName}
        </span>
        <span className="tree-file-search-count-badge">
          {file.matches.length}
        </span>
      </div>
      {isOpen && (
        <div className="tree-file-search-matches" role="group">
          {file.matches.map((match, idx) => (
            <div
              key={`${file.fsPath}:${match.matchIndex}:${idx}`}
              className="tree-file-search-match-row"
              onClick={() => handleClickMatch(match)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleClickMatch(match);
                }
              }}
            >
              {match.lineNumber && (
                <span className="tree-file-search-match-line">
                  {match.lineNumber}
                </span>
              )}
              <span className="tree-file-search-match-excerpt">
                {renderHighlightedExcerpt(match.excerpt || '', query)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SearchResultFolderViewProps {
  node: SearchResultFolderNode;
  query: string;
  collapsedPaths: Set<string>;
  togglePath: (path: string) => void;
}

function SearchResultFolderView({ node, query, collapsedPaths, togglePath }: SearchResultFolderViewProps) {
  const isOpen = !collapsedPaths.has(node.path);
  return (
    <div className={`tree-folder${isOpen ? ' is-open' : ''}`}>
      <div
        className="tree-folder__header"
        onClick={() => togglePath(node.path)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePath(node.path);
          }
        }}
      >
        <span className="tree-folder__chevron">
          <FolderChevronIcon />
        </span>
        <FolderIcon />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>
      {isOpen && (
        <div className="tree-folder__children" role="group">
          {node.files.map((file) => (
            <SearchResultFileView
              key={file.fsPath}
              file={file}
              query={query}
              collapsedPaths={collapsedPaths}
              togglePath={togglePath}
            />
          ))}
          {node.children.map((child) => (
            <SearchResultFolderView
              key={child.path}
              node={child}
              query={query}
              collapsedPaths={collapsedPaths}
              togglePath={togglePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarSearch({ isVisible, onStatusChange }: SidebarSearchProps) {
  const { state, updateSettings } = useAppState();
  const bridge = usePlatform();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
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
        items: itemsToSearch,
      });
    }, 250);

    return () => window.clearTimeout(handle);
  }, [bridge, query, state.fileList, selectedSearchFilePathsStr]);

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
            placeholder={t.sidebar.filterPlaceholder ? "Search files..." : "Search..."}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search files"
          />
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
            <div className="sidebar__empty-scope" style={{ fontSize: 11 }}>
              Enter at least 2 characters to search.
            </div>
          )}
          {query.trim().length >= 2 && isSearching && results.length === 0 && (
            <div className="sidebar__empty-scope" style={{ fontSize: 11 }}>
              Searching workspace content...
            </div>
          )}
          {query.trim().length >= 2 && !isSearching && results.length === 0 && (
            <div className="sidebar__empty-scope" style={{ fontSize: 11 }}>
              No matches found.
            </div>
          )}
          {query.trim().length >= 2 && hasVisibleTreeItems && (
            <>
              {searchResultTree.files.map((file) => (
                <SearchResultFileView
                  key={file.fsPath}
                  file={file}
                  query={query}
                  collapsedPaths={collapsedPaths}
                  togglePath={togglePath}
                />
              ))}
              {searchResultTree.children.map((child) => (
                <SearchResultFolderView
                  key={child.path}
                  node={child}
                  query={query}
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
