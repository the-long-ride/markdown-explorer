// =============================================================================
// components/Search/SearchOverlay.tsx — Global search overlay (Ctrl+K)
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { SearchIcon } from '../shared/icons';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const { state, navigate } = useAppState();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results = query.length >= 2
    ? state.fileList
        .map((f) => ({
          f,
          score:
            (f.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 0) +
            (f.relativePath.toLowerCase().includes(query.toLowerCase()) ? 1 : 0),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
    : [];

  const handleSelect = useCallback(
    (fsPath: string) => {
      onClose();
      navigate(fsPath);
    },
    [onClose, navigate],
  );

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
            placeholder="Search across all markdown files…"
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
          {query.length >= 2 && results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--txm)', fontSize: 13 }}>
              No files matching "<strong>{query}</strong>"
            </div>
          )}
          {results.map(({ f }) => (
            <div
              key={f.fsPath}
              onClick={() => handleSelect(f.fsPath)}
              role="option"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(f.fsPath); }}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderBottom: '1px solid var(--bd)',
                transition: 'background .1s',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-h)'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
            >
              <span style={{ fontSize: 16 }}>📄</span>
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
