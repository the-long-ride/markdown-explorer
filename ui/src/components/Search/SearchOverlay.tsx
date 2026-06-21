// =============================================================================
// components/Search/SearchOverlay.tsx — Scoped search overlay
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { SearchIcon } from '../shared/icons';
import { normalizeForSearch, unicodeIndexOf } from '../../utils/unicodeSearch';
import type { MdFile, WorkspaceSearchResult } from '../../types';

const SEARCH_OVERLAY_Z_INDEX = 2147483647;

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
  const [query, setQuery] = useState('');
  const [remoteQuery, setRemoteQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<CrossTabSearchItem[]>([]);
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

  const crossTabResults = query.length >= 2 && crossTabItems
    ? crossTabItems
        .map((item) => ({
          item,
          score:
            (normalizeForSearch(item.title).includes(normQuery) ? 3 : 0) +
            (normalizeForSearch(item.fileName).includes(normQuery) ? 2 : 0) +
            (normalizeForSearch(item.relativePath).includes(normQuery) ? 1 : 0) +
            (normalizeForSearch(item.tabLabel).includes(normQuery) ? 1 : 0),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 40)
    : [];
  const hasCrossTabSearch = !!crossTabItems && !!onCrossTabSelect;
  const displayedCrossTabResults =
    hasCrossTabSearch && remoteQuery === query
      ? remoteResults.map((item) => ({ item, score: 0 }))
      : crossTabResults;
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
        setRemoteResults(msg.results as CrossTabSearchItem[]);
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
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    requestIdRef.current = requestId;
    const handle = window.setTimeout(() => {
      bridge.postMessage({
        command: 'searchAcrossWorkspaces',
        requestId,
        query,
        items: crossTabItems,
      });
    }, 160);

    return () => window.clearTimeout(handle);
  }, [bridge, crossTabItems, hasCrossTabSearch, isOpen, query]);

  useEffect(() => {
    if (!isOpen || !hasCrossTabSearch || !crossTabItems || crossTabItems.length === 0) {
      return;
    }

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
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.6)',
        zIndex: SEARCH_OVERLAY_Z_INDEX,
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="search-overlay-card"
        style={{
          background: 'var(--bg-s)',
          border: '1px solid var(--bd)',
          borderRadius: 12,
          width: 560,
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--sh-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div
          className="search-overlay-input-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--bd)',
          }}
        >
          {isIndexing ? (
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 1.5, flexShrink: 0 }} />
          ) : (
            <SearchIcon size={16} style={{ color: 'var(--tx2)' }} />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder={isIndexing ? "Indexing other workspaces…" : (scopeLabel ?? "Search current workspace…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isIndexing}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: 'var(--tx)',
              fontFamily: 'var(--font-ui)',
              cursor: isIndexing ? 'not-allowed' : 'text',
              opacity: 1,
            }}
            aria-label="Search query"
          />
          <kbd style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-e)', borderRadius: 4, color: 'var(--txm)', border: '1px solid var(--bd)' }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="search-overlay-results" style={{ overflowY: 'auto', padding: '8px 0', flex: 1 }} role="listbox">
          {query.length >= 2 && !hasCrossTabSearch && isWorkspaceSearching && resultCount === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--tx2)', fontSize: 13 }}>
              Searching file contents…
            </div>
          )}
          {query.length >= 2 && resultCount === 0 && (!isWorkspaceSearching || hasCrossTabSearch) && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--tx2)', fontSize: 13 }}>
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
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx)' }}>
                      {state.settings.showTitle ? item.title : item.fileName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--tx2)', fontFamily: 'var(--font-mono)' }}>
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
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx)' }}>
                      {state.settings.showTitle ? item.title : item.fileName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--tx2)', fontFamily: 'var(--font-mono)' }}>
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
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
