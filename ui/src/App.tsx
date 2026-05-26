// =============================================================================
// App.tsx — Root component
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppState } from './contexts/AppStateContext';
// import { usePlatform } from './contexts/PlatformContext'; // TODO: re-enable when drop-to-open workspace is fixed
import { WorkspaceSelection } from './components/Workspace/WorkspaceSelection';
import { Topbar } from './components/Topbar/Topbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Content } from './components/Content/Content';
import { TableOfContents } from './components/TOC/TableOfContents';
import { SearchOverlay } from './components/Search/SearchOverlay';
import { MediaModal } from './components/Modal/MediaModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { TermsModal } from './components/Modal/TermsModal';
import { TooltipButton } from './components/shared/TooltipButton';
import { ChevronUpIcon } from './components/shared/icons';
import { useKeyboard } from './hooks/useKeyboard';
import { useResize } from './hooks/useResize';
import { useScrollVisibility } from './hooks/useScrollVisibility';

export function App() {
  const { state, toggleTheme } = useAppState();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // TODO: Drop-to-open workspace is disabled — buggy, not ready.
  // const [isDragging, setIsDragging] = useState(false);
  // const dragCounter = useRef(0);
  // const bridge = usePlatform(); // TODO: re-enable when drop-to-open workspace is fixed

  const workspaceNameRef = useRef(state.workspaceName);
  useEffect(() => {
    workspaceNameRef.current = state.workspaceName;
  }, [state.workspaceName]);

  // TODO: Drop-to-open workspace is disabled — buggy, not ready.
  // useEffect(() => {
  //   const isFileDrag = (e: DragEvent) => {
  //     const types = e.dataTransfer?.types;
  //     if (!types) return false;
  //     return types.includes('Files');
  //   };
  //   const onDragEnter = (e: DragEvent) => {
  //     if (!isFileDrag(e)) return;
  //     if (workspaceNameRef.current) return;
  //     if (modalOpen) return;
  //     e.preventDefault();
  //     dragCounter.current++;
  //     if (dragCounter.current === 1) {
  //       setIsDragging(true);
  //       document.body.classList.add('is-dragging-files');
  //     }
  //   };
  //   const onDragLeave = (e: DragEvent) => {
  //     if (!isFileDrag(e)) return;
  //     if (e.relatedTarget !== null) return;
  //     e.preventDefault();
  //     dragCounter.current = 0;
  //     setIsDragging(false);
  //     document.body.classList.remove('is-dragging-files');
  //   };
  //   const onDragOver = (e: DragEvent) => {
  //     if (isFileDrag(e)) {
  //       e.preventDefault();
  //       if (e.dataTransfer) e.dataTransfer.dropEffect = workspaceNameRef.current ? 'none' : 'copy';
  //     }
  //   };
  //   const onDrop = (e: DragEvent) => {
  //     if (!isFileDrag(e)) return;
  //     e.preventDefault();
  //     setIsDragging(false);
  //     dragCounter.current = 0;
  //     document.body.classList.remove('is-dragging-files');
  //     if (workspaceNameRef.current) return;
  //     if (modalOpen) return;
  //     const files = Array.from(e.dataTransfer?.files ?? []);
  //     if (files.length > 0) {
  //       const filePath = (files[0] as any).path;
  //       if (filePath) bridge.postMessage({ command: 'openPath', path: filePath });
  //     }
  //   };
  //   const onDragEnd = () => {
  //     if (dragCounter.current > 0) {
  //       dragCounter.current = 0;
  //       setIsDragging(false);
  //       document.body.classList.remove('is-dragging-files');
  //     }
  //   };
  //   window.addEventListener('dragenter', onDragEnter);
  //   window.addEventListener('dragleave', onDragLeave);
  //   window.addEventListener('dragover', onDragOver);
  //   window.addEventListener('drop', onDrop);
  //   window.addEventListener('dragend', onDragEnd);
  //   return () => {
  //     window.removeEventListener('dragenter', onDragEnter);
  //     window.removeEventListener('dragleave', onDragLeave);
  //     window.removeEventListener('dragover', onDragOver);
  //     window.removeEventListener('drop', onDrop);
  //     window.removeEventListener('dragend', onDragEnd);
  //     document.body.classList.remove('is-dragging-files');
  //   };
  // }, [bridge, modalOpen]);

  const { isVisible: scrollTopVisible, scrollToTop } = useScrollVisibility(scrollRef);

  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const [termsAccepted, setTermsAccepted] = useState(() => {
    if (!isElectron) return true;
    return localStorage.getItem('markdown-explorer-terms-accepted') === 'true';
  });

  const handleAgreeTerms = useCallback(() => {
    localStorage.setItem('markdown-explorer-terms-accepted', 'true');
    setTermsAccepted(true);
  }, []);

  // Initialize sidebar width from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('markdown-explorer-sidebar-width');
    if (stored) {
      document.documentElement.style.setProperty('--sidebar-width', `${stored}px`);
    }
  }, []);

  // Sidebar resize handle
  useResize('sidebarResize', 'sidebar', state.workspaceName);

  // Expand / Collapse all sections
  const expandAll = useCallback(() => {
    document.querySelectorAll('.mdn-section').forEach((s) => {
      (s as HTMLElement).dataset.expanded = 'true';
    });
  }, []);

  const collapseAll = useCallback(() => {
    document.querySelectorAll('.mdn-section').forEach((s) => {
      (s as HTMLElement).dataset.expanded = 'false';
    });
  }, []);

  // Keyboard shortcuts
  useKeyboard({
    onSearchOpen: () => setSearchOpen(true),
    onSearchClose: () => setSearchOpen(false),
    onSettingsOpen: () => setSettingsOpen(true),
    onSettingsClose: () => setSettingsOpen(false),
    onExpandAll: expandAll,
    onCollapseAll: collapseAll,
    isSearchOpen: searchOpen,
    isSettingsOpen: settingsOpen,
    isModalOpen: modalOpen,
    isTermsOpen: !termsAccepted,
  });


  // Image click → open media modal
  const onImageClick = useCallback((el: HTMLElement) => {
    setModalTarget(el);
    setModalOpen(true);
  }, []);

  if (!termsAccepted && isElectron) {
    return (
      <div className="app" style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        {/* Custom top bar for window dragging & controls */}
        <div style={{
          height: '44px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingRight: '12px',
          WebkitAppRegion: 'drag',
          position: 'relative',
          zIndex: 200000
        } as any}>
          <div className="window-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' } as any}>
            <TooltipButton
              className="btn btn--icon window-control-btn"
              onClick={toggleTheme}
              tooltip="Toggle Theme"
              icon={
                state.theme === 'dark' || (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )
              }
            />
            <div style={{ width: '1px', height: '16px', background: 'var(--bd-s)' }} />
            <TooltipButton
              className="btn btn--icon window-control-btn"
              onClick={() => (window as any).electronAPI.postMessage({ command: 'window-minimize' })}
              tooltip="Minimize"
              icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            />
            <TooltipButton
              className="btn btn--icon window-control-btn"
              onClick={() => (window as any).electronAPI.postMessage({ command: 'window-maximize' })}
              tooltip={state.isMaximized ? "Restore" : "Maximize"}
              icon={state.isMaximized ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M8 3h13v13H8z" />
                  <path d="M16 16v5H3V8h5" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
              )}
            />
            <TooltipButton
              className="btn btn--icon window-control-btn window-control-btn--close"
              onClick={() => (window as any).electronAPI.postMessage({ command: 'window-close' })}
              tooltip="Close App"
              tooltipAlign="right"
              icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
            />
          </div>
        </div>
        <TermsModal isOpen={true} onAgree={handleAgreeTerms} />
      </div>
    );
  }

  if (state.isLoading && !state.workspaceName) {
    return (
      <div className="state-screen" style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--tx)' }}>
        <div className="spinner" />
        <div className="state-screen__title" style={{ marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>Loading docs…</div>
      </div>
    );
  }

  return (
    <div className="app">
      {!state.workspaceName ? (
        <WorkspaceSelection />
      ) : (
        <>
          <Topbar
            onSearchOpen={() => setSearchOpen(true)}
            onSettingsOpen={() => setSettingsOpen(true)}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
          />
          <div className="body">
            <Sidebar />
            <div className="sidebar-resize" id="sidebarResize" role="separator" aria-label="Resize sidebar" />
            <div style={{ position: 'relative', display: 'flex', flex: 1, overflow: 'hidden' }}>
              <Content onImageClick={onImageClick} scrollRef={scrollRef} />
              {/* Scroll to top button */}
              <TooltipButton
                className={`scroll-to-top-btn${scrollTopVisible ? ' is-visible' : ''}`}
                onClick={scrollToTop}
                tooltip="Scroll to Top"
                tooltipPos="above"
                tooltipAlign="right"
                icon={<ChevronUpIcon />}
              />
            </div>
            <TableOfContents />
          </div>
        </>
      )}

      {/* Overlays */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <MediaModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setModalTarget(null); }} clickedElement={modalTarget} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* TODO: Drop-to-open workspace is disabled — buggy, not ready. */}
      {/* {isDragging && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--modal-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '2.5px dashed var(--accent)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, color: 'var(--tx)',
          pointerEvents: 'none', transition: 'all 0.2s ease'
        }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Drop folder or file to open</div>
          <div style={{ fontSize: '13px', color: 'var(--tx2)', marginTop: '8px' }}>Supports folders and .md / .mdx files</div>
        </div>
      )} */}
    </div>
  );
}

// ── Global handlers for inline event attributes from HtmlRenderer ───────────
// The host-side HtmlRenderer produces HTML with inline onclick attributes
// (e.g., onclick="UI.toggleSection(this)"). These globals bridge that HTML
// into the React app. This is a pragmatic migration step — eventually
// the renderer should produce handler-free HTML.
function initGlobalHandlers() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;

  // Listen for iframe resizing messages from HTML preview sandboxes
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'resize-iframe') {
      const iframe = document.getElementById(data.id) as HTMLIFrameElement | null;
      if (iframe) {
        const maxH = window.innerHeight * 0.8;
        const height = Math.min(data.height, maxH);
        iframe.style.height = `${height}px`;
      }
    }
  });

  // UI.toggleSection
  if (!win.UI) win.UI = {};
  win.UI.toggleSection = (headerEl: HTMLElement) => {
    const section = headerEl.closest('.mdn-section') as HTMLElement | null;
    if (!section) return;
    const expanded = section.dataset.expanded === 'true';
    section.dataset.expanded = expanded ? 'false' : 'true';
    headerEl.setAttribute('aria-expanded', String(!expanded));
  };
  win.UI.expandAll = () => {
    document.querySelectorAll('.mdn-section').forEach((s) => {
      (s as HTMLElement).dataset.expanded = 'true';
    });
  };
  win.UI.collapseAll = () => {
    document.querySelectorAll('.mdn-section').forEach((s) => {
      (s as HTMLElement).dataset.expanded = 'false';
    });
  };
  win.UI.setHtmlMode = (wrap: HTMLElement, mode: string) => {
    wrap.dataset.mode = mode;
    const langLabel = wrap.querySelector('.mdn-codeblock-lang') as HTMLElement | null;
    const previewBody = wrap.querySelector('.mdn-html-preview-body') as HTMLElement | null;
    const codeBody = wrap.querySelector('.mdn-codeblock-body') as HTMLElement | null;
    const toggleBtn = wrap.querySelector('.mdn-toggle-preview-btn') as HTMLElement | null;
    const tooltipText = wrap.querySelector('.mdn-toggle-preview-btn .tooltip-text') as HTMLElement | null;
    if (mode === 'preview') {
      if (langLabel) langLabel.textContent = 'HTML Preview';
      if (previewBody) previewBody.style.display = '';
      if (codeBody) codeBody.style.display = 'none';
      if (tooltipText) tooltipText.textContent = 'Show Code';
      if (toggleBtn) {
        const svg = toggleBtn.querySelector('svg');
        if (svg) {
          svg.outerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>';
        }
      }
    } else {
      if (langLabel) langLabel.textContent = 'HTML';
      if (previewBody) previewBody.style.display = 'none';
      if (codeBody) codeBody.style.display = 'flex';
      if (tooltipText) tooltipText.textContent = 'Show Preview';
      if (toggleBtn) {
        const svg = toggleBtn.querySelector('svg');
        if (svg) {
          svg.outerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
      }
    }
  };
  win.UI.toggleHtmlMode = (btn: HTMLElement) => {
    const wrap = btn.closest('.mdn-codeblock') as HTMLElement | null;
    if (!wrap) return;
    const currentMode = wrap.dataset.mode || 'preview';
    win.UI.setHtmlMode(wrap, currentMode === 'preview' ? 'code' : 'preview');
  };
  win.UI.refresh = () => {
    // Handled by React bridge, but provide a fallback
  };

  // UI_copyCode (global function referenced by rendered HTML)
  win.UI_copyCode = (btn: HTMLElement) => {
    const code = btn.closest('.mdn-codeblock')?.querySelector('code')?.innerText ?? '';
    // Use platform bridge for clipboard (injected separately if needed)
    try {
      navigator.clipboard.writeText(code);
    } catch {
      // Fallback: post message if available
    }
    btn.classList.add('is-copied');
    const tooltip = btn.querySelector('.tooltip-text');
    if (tooltip) tooltip.textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('is-copied');
      if (tooltip) tooltip.textContent = 'Copy code';
    }, 2000);
  };

  // Table object (for inline onclick handlers)
  if (!win.Table) win.Table = {};
  // Table object (for inline onclick handlers)
  if (!win.Table) win.Table = {};
  win.Table.states = win.Table.states || {};

  win.Table.initState = (tableId: string) => {
    if (!win.Table.states[tableId]) {
      win.Table.states[tableId] = {
        expanded: false,
        searchQuery: '',
        filters: {},
        chartInstance: null,
        currentView: 'table',
        chartable: false,
        labelColIdx: 0,
        dataColIdxs: []
      };
    }
    return win.Table.states[tableId];
  };

  win.Table.sort = (tableId: string, colIndex: number) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = [...tbody.querySelectorAll('tr')];
    const th = table.querySelectorAll('.mdn-th')[colIndex] as HTMLElement | null;
    if (!th) return;
    const asc = !th.classList.contains('sort-asc');
    table.querySelectorAll('.mdn-th').forEach((h) => h.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(asc ? 'sort-asc' : 'sort-desc');
    rows.sort((a, b) => {
      const at = a.cells[colIndex]?.textContent?.trim() ?? '';
      const bt = b.cells[colIndex]?.textContent?.trim() ?? '';
      const an = parseFloat(at.replace(/[\$,%]/g, ''));
      const bn = parseFloat(bt.replace(/[\$,%]/g, ''));
      if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
      return asc ? at.localeCompare(bt) : bt.localeCompare(at);
    });
    rows.forEach((r) => tbody.appendChild(r));

    const state = win.Table.initState(tableId);
    if (state.currentView !== 'table') {
      win.Table.renderChart(tableId, state.currentView);
    }
  };

  win.Table.applyAllFilters = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.states[tableId];
    if (!state) return;

    const searchQ = (state.searchQuery || '').toLowerCase().trim();
    const rows = ([...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[]);
    let visible = 0;

    rows.forEach((row) => {
      const matchesSearch = !searchQ || row.textContent!.toLowerCase().includes(searchQ);

      let matchesColumnFilters = true;
      if (state.filters) {
        Object.entries(state.filters).forEach(([colIdxStr, filterVal]) => {
          if (filterVal) {
            const colIdx = parseInt(colIdxStr, 10);
            const cellVal = (row.cells[colIdx]?.textContent ?? '').trim();
            if (cellVal !== filterVal) matchesColumnFilters = false;
          }
        });
      }

      const isVisible = matchesSearch && matchesColumnFilters;
      (row as HTMLElement).classList.toggle('is-hidden', !isVisible);
      if (isVisible) visible++;
    });

    const countEl = document.getElementById(tableId + '-count');
    if (countEl) {
      countEl.textContent = visible < rows.length ? `${visible} / ${rows.length} rows` : `${rows.length} rows`;
    }

    // Show/hide the standalone toggle button (lives outside the table)
    const toggleBtn = document.getElementById(tableId + '-toggle-btn');
    if (toggleBtn) {
      // Hide the toggle when a search/filter is active (all rows visible)
      toggleBtn.style.display = visible > 15 && !searchQ && Object.keys(state.filters || {}).length === 0 ? '' : 'none';
    }

    if (state.currentView !== 'table') {
      win.Table.renderChart(tableId, state.currentView);
    }
  };

  win.Table.filter = (tableId: string, query: string) => {
    const state = win.Table.initState(tableId);
    state.searchQuery = query;
    win.Table.applyAllFilters(tableId);
  };

  win.Table.showFilterMenu = (tableId: string, colIndex: number, buttonEl: HTMLElement) => {
    const existing = document.querySelector('.mdn-filter-dropdown');
    if (existing) existing.remove();

    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);

    const rows = ([...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[]);
    const values = rows
      .map(row => (row.cells[colIndex]?.textContent ?? '').trim())
      .filter(Boolean);
    const uniqueValues = Array.from(new Set(values)).sort();

    const dropdown = document.createElement('div');
    dropdown.className = 'mdn-filter-dropdown';

    const header = document.createElement('div');
    header.className = 'mdn-filter-dropdown-header';
    header.textContent = 'Filter Column';
    dropdown.appendChild(header);

    const allItem = document.createElement('div');
    allItem.className = `mdn-filter-item${!state.filters[colIndex] ? ' is-active' : ''}`;
    allItem.textContent = '(All)';
    allItem.onclick = () => {
      state.filters[colIndex] = null;
      buttonEl.classList.remove('is-active');
      win.Table.applyAllFilters(tableId);
      dropdown.remove();
    };
    dropdown.appendChild(allItem);

    uniqueValues.forEach(val => {
      const isActive = state.filters[colIndex] === val;
      const item = document.createElement('div');
      item.className = `mdn-filter-item${isActive ? ' is-active' : ''}`;
      item.textContent = val;
      item.onclick = () => {
        state.filters[colIndex] = val;
        buttonEl.classList.add('is-active');
        win.Table.applyAllFilters(tableId);
        dropdown.remove();
      };
      dropdown.appendChild(item);
    });

    document.body.appendChild(dropdown);
    const rect = buttonEl.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
    
    const dropdownWidth = dropdown.offsetWidth || 160;
    const viewportWidth = window.innerWidth;
    let leftPos = rect.left + window.scrollX;
    
    if (rect.left + dropdownWidth > viewportWidth) {
      leftPos = rect.right + window.scrollX - dropdownWidth;
    }
    leftPos = Math.max(12, Math.min(leftPos, viewportWidth - dropdownWidth - 12));
    
    dropdown.style.left = `${leftPos}px`;

    const outsideClickListener = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node) && e.target !== buttonEl) {
        dropdown.remove();
        document.removeEventListener('click', outsideClickListener);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', outsideClickListener);
    }, 0);
  };

  win.Table.toggleCollapse = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLElement[];
    const btn = document.getElementById(tableId + '-toggle-btn');
    const isCurrentlyCollapsed = rows[15]?.classList.contains('is-collapsed-row');
    rows.forEach((row, idx) => {
      if (idx >= 15) row.classList.toggle('is-collapsed-row', !isCurrentlyCollapsed);
    });
    state.expanded = isCurrentlyCollapsed;
    if (btn) btn.textContent = isCurrentlyCollapsed ? 'Show Less' : 'Show More';
  };

  win.Table.updateCount = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const total = table.querySelectorAll('tbody tr').length;
    const countEl = document.getElementById(tableId + '-count');
    if (countEl) countEl.textContent = `${total} rows`;
  };

  win.Table.detectChartable = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    const headers = [...table.querySelectorAll('thead th')];
    const rows = ([...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[]);

    // Find numeric columns and text label columns
    const numericCols: number[] = [];
    const labelCols: number[] = [];

    headers.forEach((_, idx) => {
      let isNumeric = true;
      let hasVal = false;
      rows.slice(0, 10).forEach(row => {
        const text = row.cells[idx]?.textContent?.trim() ?? '';
        if (!text) return;
        const clean = text.replace(/[\$,%]/g, '');
        if (isNaN(Number(clean))) {
          isNumeric = false;
        } else {
          hasVal = true;
        }
      });
      if (isNumeric && hasVal) {
        numericCols.push(idx);
      } else {
        labelCols.push(idx);
      }
    });

    if (numericCols.length > 0) {
      const labelColIdx = labelCols.length > 0 ? labelCols[0] : 0;
      const dataColIdxs = numericCols.filter(idx => idx !== labelColIdx);

      if (dataColIdxs.length > 0) {
        state.chartable = true;
        state.labelColIdx = labelColIdx;
        state.dataColIdxs = dataColIdxs;

        const switcher = document.getElementById(tableId + '-switcher');
        if (switcher) {
          // Always re-populate switcher (clear first to handle re-renders)
          switcher.innerHTML = `
            <button id="${tableId}-view-table" class="is-active" onclick="Table.switchView('${tableId}', 'table')" title="View Table">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Table
            </button>
            <button id="${tableId}-view-bar" onclick="Table.switchView('${tableId}', 'bar')" title="Bar Chart">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Bar
            </button>
            <button id="${tableId}-view-line" onclick="Table.switchView('${tableId}', 'line')" title="Line Chart">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 3v18h18"/><path d="m18.7 8-5.1 5.2-2.8-2.7L7 14.3"/></svg> Line
            </button>
            <button id="${tableId}-view-pie" onclick="Table.switchView('${tableId}', 'pie')" title="Pie Chart">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg> Pie
            </button>
          `;
        }
      }
    }
  };

  win.Table.switchView = (tableId: string, view: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const state = win.Table.initState(tableId);
    state.currentView = view;

    const switcher = document.getElementById(tableId + '-switcher');
    if (switcher) {
      switcher.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('is-active', btn.id === `${tableId}-view-${view}`);
      });
    }

    const scrollEl = document.getElementById(tableId + '-scroll');
    const chartContainer = document.getElementById(tableId + '-chart-container');
    const toggleBtn = document.getElementById(tableId + '-toggle-btn');
    const toggleRow = document.getElementById(tableId + '-toggle-row');

    if (view === 'table') {
      if (scrollEl) scrollEl.style.display = '';
      if (chartContainer) chartContainer.style.display = 'none';

      // Re-apply collapsed state
      const rows = [...table.querySelectorAll('tbody tr')].filter(r => r.id !== tableId + '-toggle-row');
      const totalRows = rows.length;
      if (totalRows > 15) {
        const isSearchOrFilterActive = !!state.searchQuery || Object.keys(state.filters || {}).length > 0;
        const isExpanded = !!state.expanded;
        
        rows.forEach((row, idx) => {
          if (idx >= 15) {
            (row as HTMLElement).classList.toggle('is-collapsed-row', !isExpanded && !isSearchOrFilterActive);
          }
        });

        if (toggleBtn) {
          toggleBtn.style.display = isSearchOrFilterActive ? 'none' : '';
          toggleBtn.textContent = isExpanded ? 'Show Less' : 'Show More';
        }
        if (toggleRow) {
          toggleRow.classList.toggle('is-hidden', isSearchOrFilterActive);
        }
      }
    } else {
      if (scrollEl) scrollEl.style.display = 'none';
      if (toggleBtn) toggleBtn.style.display = 'none';
      if (toggleRow) toggleRow.classList.add('is-hidden');
      if (chartContainer) chartContainer.style.display = 'block';
      win.Table.renderChart(tableId, view);
    }
  };

  win.Table.getChartColors = (count: number, isDark: boolean) => {
    const baseColors = isDark 
      ? ['#8b7cf8', '#34d399', '#f87171', '#60a5fa', '#fbbf24', '#ec4899', '#a855f7', '#14b8a6']
      : ['#6d5ef0', '#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#db2777', '#8b5cf6', '#0d9488'];
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(baseColors[i % baseColors.length]);
    }
    return result;
  };

  win.Table.renderChart = (tableId: string, viewType: string) => {
    const state = win.Table.initState(tableId);
    if (!state.chartable) return;

    const canvas = document.getElementById(tableId + '-chart-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }

    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;

    const rows = ([...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[]).filter(
      row => !row.classList.contains('is-hidden') && row.id !== tableId + '-toggle-row'
    );

    if (rows.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = 'var(--txm)';
        ctx.textAlign = 'center';
        ctx.fillText('No data to display in chart', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    const MAX_CHART_ROWS = 50;
    const chartRows = rows.slice(0, MAX_CHART_ROWS);

    const labels = chartRows.map(row => {
      const text = row.cells[state.labelColIdx]?.textContent?.trim() ?? '';
      return text.length > 25 ? text.slice(0, 22) + '...' : text;
    });

    const isDark = document.documentElement.dataset.theme === 'dark' || 
      (document.documentElement.dataset.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const styles = getComputedStyle(document.documentElement);
    const colors = win.Table.getChartColors(state.dataColIdxs.length, isDark);

    const datasets = state.dataColIdxs.map((colIdx: number, dsIdx: number) => {
      const headerText = table.querySelectorAll('thead th')[colIdx]?.querySelector('.mdn-th-text')?.textContent?.trim() ?? `Series ${dsIdx + 1}`;
      const data = chartRows.map(row => {
        const text = row.cells[colIdx]?.textContent?.trim() ?? '0';
        const clean = text.replace(/[\$,%]/g, '').trim();
        return parseFloat(clean) || 0;
      });

      const color = colors[dsIdx];

      if (viewType === 'pie') {
        const pieColors = win.Table.getChartColors(data.length, isDark);
        return {
          label: headerText,
          data: data,
          backgroundColor: pieColors.map((c: string) => c + 'cc'),
          borderColor: pieColors,
          borderWidth: 1
        };
      }

      return {
        label: headerText,
        data: data,
        backgroundColor: color + '33',
        borderColor: color,
        borderWidth: 2,
        tension: 0.1
      };
    });

    const finalDatasets = viewType === 'pie' ? [datasets[0]] : datasets;

    if (typeof win.Chart !== 'undefined') {
      state.chartInstance = new win.Chart(canvas, {
        type: viewType === 'pie' ? 'doughnut' : viewType,
        data: {
          labels: labels,
          datasets: finalDatasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: styles.getPropertyValue('--tx2').trim() || '#9191a4',
                font: { family: 'var(--font-ui)' }
              }
            }
          },
          scales: viewType === 'pie' ? undefined : {
            x: {
              grid: { color: styles.getPropertyValue('--bd').trim() || 'rgba(255,255,255,0.07)' },
              ticks: { color: styles.getPropertyValue('--tx2').trim() || '#9191a4', font: { family: 'var(--font-ui)' } }
            },
            y: {
              grid: { color: styles.getPropertyValue('--bd').trim() || 'rgba(255,255,255,0.07)' },
              ticks: { color: styles.getPropertyValue('--tx2').trim() || '#9191a4', font: { family: 'var(--font-ui)' } }
            }
          }
        }
      });
    }
  };

  // Sidebar.toggleFolder (for inline handlers)
  if (!win.Sidebar) win.Sidebar = {};
  win.Sidebar.toggleFolder = (el: HTMLElement) => {
    const folder = el.closest('.tree-folder') as HTMLElement | null;
    if (!folder) return;
    folder.classList.toggle('is-open');
    const children = folder.querySelector('.tree-folder__children') as HTMLElement | null;
    if (children) children.classList.toggle('is-hidden', !folder.classList.contains('is-open'));
  };

  // Nav.go (for inline handlers)
  if (!win.Nav) win.Nav = {};
  win.Nav.go = (_fsPath: string | null) => {
    // Handled by React navigate - but provide fallback for rendered HTML links
  };
}

initGlobalHandlers();
