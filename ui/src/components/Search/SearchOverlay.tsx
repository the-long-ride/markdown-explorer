// =============================================================================
// components/Search/SearchOverlay.tsx — Global search overlay (Ctrl+K)
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { SearchIcon } from '../shared/icons';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  scopeLabel?: string;
  crossTabItems?: readonly CrossTabSearchItem[];
  onCrossTabSelect?: (item: CrossTabSearchItem) => void;
}

export interface CrossTabSearchItem {
  tabId: string;
  tabLabel: string;
  fsPath: string;
  title: string;
  fileName: string;
  relativePath: string;
  excerpt?: string;
}

export function SearchOverlay({
  isOpen,
  onClose,
  scopeLabel,
  crossTabItems,
  onCrossTabSelect,
}: SearchOverlayProps) {
  const { state, navigate } = useAppState();
  const bridge = usePlatform();
  const [query, setQuery] = useState('');
  const [remoteQuery, setRemoteQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<CrossTabSearchItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const queryLower = query.toLowerCase();
  const currentTabResults = query.length >= 2
    ? state.fileList
        .map((f) => ({
          f,
          score:
            (f.title.toLowerCase().includes(queryLower) ? 2 : 0) +
            (f.relativePath.toLowerCase().includes(queryLower) ? 1 : 0),
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
            (item.title.toLowerCase().includes(queryLower) ? 3 : 0) +
            (item.fileName.toLowerCase().includes(queryLower) ? 2 : 0) +
            (item.relativePath.toLowerCase().includes(queryLower) ? 1 : 0) +
            (item.tabLabel.toLowerCase().includes(queryLower) ? 1 : 0),
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

  const handleSelect = useCallback(
    (fsPath: string) => {
      onClose();
      navigate(fsPath);
    },
    [onClose, navigate],
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

  const resultCount = hasCrossTabSearch ? displayedCrossTabResults.length : currentTabResults.length;

  if (!isOpen) return null;

  return (
    <div
      id="searchOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.6)',
        zIndex: 1000,
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--bd)',
          }}
        >
          <SearchIcon size={16} style={{ color: 'var(--txm)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder={scopeLabel ?? "Search across all markdown files…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: 'var(--tx)',
              fontFamily: 'var(--font-ui)',
            }}
            aria-label="Search query"
          />
          <kbd style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-e)', borderRadius: 4, color: 'var(--txm)', border: '1px solid var(--bd)' }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', padding: '8px 0', flex: 1 }} role="listbox">
          {query.length >= 2 && resultCount === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--txm)', fontSize: 13 }}>
              No files matching "<strong>{query}</strong>"
            </div>
          )}
          {hasCrossTabSearch
            ? displayedCrossTabResults.map(({ item }) => (
                <div
                  key={`${item.tabId}:${item.fsPath}`}
                  onClick={() => {
                    onClose();
                    onCrossTabSelect(item);
                  }}
                  role="option"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onClose();
                      onCrossTabSelect(item);
                    }
                  }}
                  className="search-result-row"
                >
                  <span className="search-result-row__icon">MD</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx)' }}>
                      {state.settings.showTitle ? item.title : item.fileName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txm)', fontFamily: 'var(--font-mono)' }}>
                      {item.tabLabel} / {item.relativePath}
                    </div>
                    {item.excerpt && (
                      <div className="search-result-row__excerpt">
                        {item.excerpt}
                      </div>
                    )}
                  </div>
                </div>
              ))
            : currentTabResults.map(({ f }) => (
                <div
                  key={f.fsPath}
                  onClick={() => handleSelect(f.fsPath)}
                  role="option"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(f.fsPath); }}
                  className="search-result-row"
                >
                  <span className="search-result-row__icon">MD</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx)' }}>
                      {state.settings.showTitle ? f.title : f.fileName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txm)', fontFamily: 'var(--font-mono)' }}>
                      {f.relativePath}
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
