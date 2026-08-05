// =============================================================================
// components/Sidebar/SidebarSearch.tsx — Workspace search panel in sidebar
// =============================================================================

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { SearchIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { getTranslations } from '../../contexts/translations';
import { SearchResultFileView, SearchResultFolderView } from './sidebarSearchTree';
import { buildSearchResultTree } from './sidebarSearchResultTree';
import { filterWorkspaceSearchResultsByScope, getScopeSearchRevision } from './sidebarSearchScope';
import type { WorkspaceSearchResult } from '../../types';

export interface SidebarSearchStatus {
  isSearching: boolean;
  resultCount: number;
  showCount: boolean;
}

interface SidebarSearchProps {
  isVisible: boolean;
  selectedFilePaths: ReadonlySet<string>;
  hasScopeEntry: boolean;
  onStatusChange?: (status: SidebarSearchStatus) => void;
}

export function SidebarSearch({
  isVisible,
  selectedFilePaths,
  hasScopeEntry,
  onStatusChange,
}: SidebarSearchProps) {
  const { state } = useAppState();
  const bridge = usePlatform();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [rawResults, setRawResults] = useState<WorkspaceSearchResult[]>([]);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef('');
  const resultsTreeRef = useRef<HTMLDivElement>(null);
  const resultsScrollPosRef = useRef(0);
  const scopeRevision = `${hasScopeEntry ? 'focused' : 'all'}:${getScopeSearchRevision(selectedFilePaths)}`;
  const results = useMemo(
    () => filterWorkspaceSearchResultsByScope(rawResults, hasScopeEntry, selectedFilePaths),
    [hasScopeEntry, rawResults, scopeRevision, selectedFilePaths],
  );

  const handleResultsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    resultsScrollPosRef.current = event.currentTarget.scrollTop;
  };

  useLayoutEffect(() => {
    if (isVisible && resultsTreeRef.current) {
      resultsTreeRef.current.scrollTop = resultsScrollPosRef.current;
    }
  }, [isVisible]);

  useEffect(() => {
    resultsScrollPosRef.current = 0;
    if (resultsTreeRef.current) resultsTreeRef.current.scrollTop = 0;
  }, [query]);

  const togglePath = useCallback((path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  useEffect(() => {
    return bridge.onMessage((message) => {
      if (
        message.command === 'workspaceSearchResults' &&
        message.requestId === requestIdRef.current
      ) {
        setRawResults(message.results as WorkspaceSearchResult[]);
        setIsSearching(false);
      }
    });
  }, [bridge]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setRawResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    requestIdRef.current = requestId;
    setIsSearching(true);

    const handle = window.setTimeout(() => {
      bridge.postMessage({
        command: 'searchWorkspace',
        requestId,
        query,
        matchCase,
      });
    }, 250);

    return () => window.clearTimeout(handle);
  }, [bridge, query, matchCase, scopeRevision]);

  useEffect(() => {
    const focusInput = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('focus-sidebar-search-input', focusInput);
    return () => window.removeEventListener('focus-sidebar-search-input', focusInput);
  }, []);

  useEffect(() => {
    onStatusChange?.({
      isSearching,
      resultCount: results.length,
      showCount: query.trim().length >= 2 && results.length > 0,
    });
  }, [isSearching, results.length, query, onStatusChange]);

  const fileMap = useMemo(() => {
    const map = new Map<string, WorkspaceSearchResult[]>();
    for (const result of results) {
      const matches = map.get(result.fsPath) ?? [];
      matches.push(result);
      map.set(result.fsPath, matches);
    }
    return map;
  }, [results]);

  const searchResultTree = useMemo(
    () => buildSearchResultTree(fileMap),
    [fileMap],
  );
  const visibleSearchResultTree = searchResultTree &&
    (searchResultTree.files.length > 0 || searchResultTree.children.length > 0)
    ? searchResultTree
    : null;

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
            onChange={(event) => setQuery(event.target.value)}
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
      </div>

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
        {query.trim().length >= 2 && visibleSearchResultTree && (
          <>
            {visibleSearchResultTree.files.map((file) => (
              <SearchResultFileView
                key={file.fsPath}
                file={file}
                query={query}
                matchCase={matchCase}
                collapsedPaths={collapsedPaths}
                togglePath={togglePath}
              />
            ))}
            {visibleSearchResultTree.children.map((child) => (
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
    </>
  );
}
