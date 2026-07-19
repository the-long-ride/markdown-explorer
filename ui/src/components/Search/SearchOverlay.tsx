// =============================================================================
// components/Search/SearchOverlay.tsx — Scoped search overlay
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';
import { usePlatform } from '../../contexts/PlatformContext';
import { SearchIcon } from '../shared/icons';
import { normalizeForSearch, unicodeIndexOf } from '../../utils/unicodeSearch';
import type { MdFile, WorkspaceSearchResult } from '../../types';

const CROSS_TAB_RESULT_PAGE_SIZE = 100;

export function renderHighlightedExcerpt(excerpt: string, query: string) {
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

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  scopeKey?: string;
  scopeLabel?: string;
  crossTabItems?: readonly CrossTabSearchItem[];
  onWorkspaceSelect?: (item: WorkspaceSearchResult, query: string) => void;
  onCrossTabSelect?: (item: CrossTabSearchItem, query: string) => void;
  isIndexing?: boolean;
}

export interface CrossTabSearchItem {
  tabId: string;
  tabLabel: string;
  fsPath: string;
  title: string;
  fileName: string;
  relativePath: string;
  excerpt?: string;
  matchIndex?: number;
  matchOrdinal?: number;
}

export function SearchOverlay({
  isOpen,
  onClose,
  scopeKey,
  scopeLabel,
  crossTabItems,
  onWorkspaceSelect,
  onCrossTabSelect,
  isIndexing,
}: SearchOverlayProps) {
  const { state, navigate } = useAppState();
  const bridge = usePlatform();
  const t = getTranslations(state.settings.language || 'en');
  const [query, setQuery] = useState('');
  const [remoteQuery, setRemoteQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<CrossTabSearchItem[]>([]);
  const [visibleCrossTabCount, setVisibleCrossTabCount] = useState(CROSS_TAB_RESULT_PAGE_SIZE);
  const [isCrossTabSearching, setIsCrossTabSearching] = useState(false);
  const [workspaceRemoteQuery, setWorkspaceRemoteQuery] = useState('');
  const [workspaceRemoteResults, setWorkspaceRemoteResults] = useState<WorkspaceSearchResult[]>([]);
  const [isWorkspaceSearching, setIsWorkspaceSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef('');
  const workspaceRequestIdRef = useRef('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setRemoteQuery('');
      setRemoteResults([]);
      setVisibleCrossTabCount(CROSS_TAB_RESULT_PAGE_SIZE);
      setIsCrossTabSearching(false);
      setWorkspaceRemoteQuery('');
      setWorkspaceRemoteResults([]);
      setIsWorkspaceSearching(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, scopeKey]);

  const normQuery = normalizeForSearch(query);
  const toWorkspaceSearchResult = (file: MdFile): WorkspaceSearchResult => ({
    fsPath: file.fsPath,
    title: file.title,
    fileName: file.fileName,
    relativePath: file.relativePath,
  });
  const currentTabResults = query.length >= 2
    ? state.fileList
        .map((f) => ({
          item: toWorkspaceSearchResult(f),
          score:
            (normalizeForSearch(f.title).includes(normQuery) ? 3 : 0) +
            (normalizeForSearch(f.fileName).includes(normQuery) ? 2 : 0) +
            (normalizeForSearch(f.relativePath).includes(normQuery) ? 1 : 0),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
    : [];

  const hasCrossTabSearch = !!crossTabItems && !!onCrossTabSelect;
  const displayedCrossTabResults =
    hasCrossTabSearch && remoteQuery === query
      ? remoteResults
          .slice(0, visibleCrossTabCount)
          .map((item) => ({ item, score: 0 }))
      : [];
  const displayedWorkspaceResults =
    !hasCrossTabSearch && workspaceRemoteQuery === query
      ? workspaceRemoteResults.map((item) => ({ item, score: 0 }))
      : currentTabResults;

  const handleSelect = useCallback(
    (item: WorkspaceSearchResult) => {
      onClose();
      if (onWorkspaceSelect) {
        onWorkspaceSelect(item, query);
        return;
      }
      navigate(item.fsPath);
    },
    [onClose, onWorkspaceSelect, navigate, query],
  );

  useEffect(() => {
    if (!isOpen || !hasCrossTabSearch) return;
    return bridge.onMessage((msg) => {
      if (
        msg.command === 'crossTabSearchResults' &&
        msg.requestId === requestIdRef.current
      ) {
        setRemoteQuery(query);
        if (msg.done) {
          setIsCrossTabSearching(false);
        } else {
          const nextBatch = msg.results as CrossTabSearchItem[];
          setRemoteResults((current) => [...current, ...nextBatch]);
        }
      }
    });
  }, [bridge, hasCrossTabSearch, isOpen, query]);

  useEffect(() => {
    if (!isOpen || hasCrossTabSearch) return;
    return bridge.onMessage((msg) => {
      if (
        msg.command === 'workspaceSearchResults' &&
        msg.requestId === workspaceRequestIdRef.current
      ) {
        setWorkspaceRemoteQuery(query);
        setWorkspaceRemoteResults(msg.results as WorkspaceSearchResult[]);
        setIsWorkspaceSearching(false);
      }
    });
  }, [bridge, hasCrossTabSearch, isOpen, query]);

  useEffect(() => {
    if (!isOpen || !hasCrossTabSearch || !crossTabItems || query.length < 2) {
      setRemoteQuery('');
      setRemoteResults([]);
      setVisibleCrossTabCount(CROSS_TAB_RESULT_PAGE_SIZE);
      setIsCrossTabSearching(false);
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    requestIdRef.current = requestId;
    setRemoteQuery(query);
    setRemoteResults([]);
    setVisibleCrossTabCount(CROSS_TAB_RESULT_PAGE_SIZE);
    setIsCrossTabSearching(true);
    const handle = window.setTimeout(() => {
      bridge.postMessage({
        command: 'searchAcrossWorkspaces',
        requestId,
        query,
      });
    }, 160);

    return () => window.clearTimeout(handle);
  }, [bridge, crossTabItems, hasCrossTabSearch, isOpen, query]);

  useEffect(() => {
    if (!isOpen || !hasCrossTabSearch || !crossTabItems || crossTabItems.length === 0) return;

    const handle = window.setTimeout(() => {
      bridge.postMessage({
        command: 'indexWorkspaceSearchItems',
        items: crossTabItems,
      });
    }, 100);

    return () => window.clearTimeout(handle);
  }, [bridge, crossTabItems, hasCrossTabSearch, isOpen]);

  useEffect(() => {
    if (!isOpen || hasCrossTabSearch || query.length < 2) {
      setWorkspaceRemoteQuery('');
      setWorkspaceRemoteResults([]);
      setIsWorkspaceSearching(false);
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    workspaceRequestIdRef.current = requestId;
    setIsWorkspaceSearching(true);
    const handle = window.setTimeout(() => {
      bridge.postMessage({
        command: 'searchWorkspace',
        requestId,
        query,
        items: state.fileList.map(toWorkspaceSearchResult),
      });
    }, 160);

    return () => window.clearTimeout(handle);
  }, [bridge, hasCrossTabSearch, isOpen, query, state.fileList]);

  const resultCount = hasCrossTabSearch ? displayedCrossTabResults.length : displayedWorkspaceResults.length;

  if (!isOpen) return null;

  const overlay = (
    <div
      className="search-overlay"
      id="searchOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="search-overlay-card"
      >
        {/* Search input */}
        <div
          className="search-overlay-input-row"
        >
          {isIndexing ? (
            <div className="spinner" />
          ) : (
            <SearchIcon size={16} className="search-icon" />
          )}
          <input
            ref={inputRef}
            type="text"
            className="search-overlay-input"
            placeholder={isIndexing ? "Indexing other workspaces…" : (scopeLabel ?? "Search current workspace…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isIndexing}
            aria-label="Search query"
          />
          <kbd>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="search-overlay-results" role="listbox">
          {query.length >= 2 && hasCrossTabSearch && isCrossTabSearching && resultCount === 0 && (
            <div className="search-overlay-message">
              Searching file contents…
            </div>
          )}
          {query.length >= 2 && !hasCrossTabSearch && isWorkspaceSearching && resultCount === 0 && (
            <div className="search-overlay-message">
              Searching file contents…
            </div>
          )}
          {query.length >= 2 && resultCount === 0 && !isCrossTabSearching && (!isWorkspaceSearching || hasCrossTabSearch) && (
            <div className="search-overlay-message">
              No files matching "<strong>{query}</strong>"
            </div>
          )}
          {hasCrossTabSearch
            ? displayedCrossTabResults.map(({ item }) => (
                <div
                  key={`${item.tabId}:${item.fsPath}:${item.matchIndex ?? 'file'}`}
                  onClick={() => {
                    onClose();
                    onCrossTabSelect?.(item, query);
                  }}
                  role="option"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onClose();
                      onCrossTabSelect?.(item, query);
                    }
                  }}
                  className="search-result-row"
                >
                  <span className="search-result-row__icon">MD</span>
                  <div className="search-result-row__content">
                    <div className="search-result-row__title">
                      {state.settings.showTitle ? item.title : item.fileName}
                    </div>
                    <div className="search-result-row__path">
                      {item.tabLabel} / {item.relativePath}
                    </div>
                    {item.excerpt && (
                      <div className="search-result-row__excerpt">
                        {renderHighlightedExcerpt(item.excerpt, query)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            : displayedWorkspaceResults.map(({ item }) => (
                <div
                  key={`${item.fsPath}:${item.matchIndex ?? 'file'}`}
                  onClick={() => handleSelect(item)}
                  role="option"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(item); }}
                  className="search-result-row"
                >
                  <span className="search-result-row__icon">MD</span>
                  <div className="search-result-row__content">
                    <div className="search-result-row__title">
                      {state.settings.showTitle ? item.title : item.fileName}
                    </div>
                    <div className="search-result-row__path">
                      {item.relativePath}
                    </div>
                    {item.excerpt && (
                      <div className="search-result-row__excerpt">
                        {renderHighlightedExcerpt(item.excerpt, query)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          {hasCrossTabSearch && remoteResults.length > displayedCrossTabResults.length && (
            <div className="search-overlay-load-more">
              <button
                type="button"
                className="btn"
                onClick={() => setVisibleCrossTabCount((count) => count + CROSS_TAB_RESULT_PAGE_SIZE)}
              >
                {t.actions.loadMore}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
