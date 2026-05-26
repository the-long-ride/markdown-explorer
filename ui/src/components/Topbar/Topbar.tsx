// =============================================================================
// components/Topbar/Topbar.tsx
// =============================================================================

import { useAppState } from '../../contexts/AppStateContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { TooltipButton } from '../shared/TooltipButton';
import {
  HomeIcon, ChevronLeftIcon, ChevronRightIcon,
  ExpandIcon, CollapseIcon, EditIcon, SearchIcon,
  SettingsIcon, SidebarIcon, RefreshIcon, SunIcon, MoonIcon,
} from '../shared/icons';
import logoUrl from '../../assets/logos/logo-128.png';

interface TopbarProps {
  onSearchOpen: () => void;
  onSettingsOpen: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

interface BreadcrumbItem {
  text: string;
  isBold?: boolean;
  isEllipsis?: boolean;
}

function truncateFilename(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  const extIdx = name.lastIndexOf('.');
  const ext = extIdx !== -1 ? name.slice(extIdx) : '';
  const base = extIdx !== -1 ? name.slice(0, extIdx) : name;
  const available = maxLen - 3 - ext.length;
  if (available > 2) {
    const startLen = Math.ceil(available / 2);
    const endLen = Math.floor(available / 2);
    return base.slice(0, startLen) + '...' + base.slice(-endLen) + ext;
  }
  return base.slice(0, Math.max(1, maxLen - 3)) + '...';
}

function getBreadcrumbItems(relativePath: string): BreadcrumbItem[] {
  if (!relativePath) return [];
  if (relativePath === 'Welcome Page') {
    return [{ text: 'Welcome Page', isBold: true }];
  }
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  const N = parts.length;
  if (N === 0) return [];
  const filename = parts[N - 1];

  const getItemsLength = (items: BreadcrumbItem[]) => {
    return items.reduce((sum, item) => sum + item.text.length, 0) + (items.length - 1) * 3;
  };

  // Tier 1: Full path (if it fits)
  const fullItems: BreadcrumbItem[] = parts.map((p, idx) => ({
    text: p,
    isBold: idx === N - 1
  }));
  if (getItemsLength(fullItems) <= 45) {
    return fullItems;
  }

  // Tier 2: root / sub-root / ... / parent / file.md (for N >= 4)
  if (N >= 4) {
    const items = [
      { text: parts[0] },
      { text: parts[1] },
      { text: '...', isEllipsis: true },
      { text: parts[N - 2] },
      { text: filename, isBold: true }
    ];
    if (getItemsLength(items) <= 45) {
      return items;
    }
  }

  // Tier 3: root / ... / parent / file.md (for N >= 3)
  if (N >= 3) {
    const items = [
      { text: parts[0] },
      { text: '...', isEllipsis: true },
      { text: parts[N - 2] },
      { text: filename, isBold: true }
    ];
    if (getItemsLength(items) <= 45) {
      return items;
    }
  }

  // Tier 4: ... / parent / file.md (for N >= 2)
  if (N >= 2) {
    const parent = parts[N - 2];
    const items = [
      { text: '...', isEllipsis: true },
      { text: parent },
      { text: filename, isBold: true }
    ];
    if (getItemsLength(items) <= 45) {
      return items;
    }

    // Try truncating parent if it's too long
    const truncatedParent = parent.length > 15 ? parent.slice(0, 12) + '...' : parent;
    const itemsTruncatedParent = [
      { text: '...', isEllipsis: true },
      { text: truncatedParent },
      { text: filename, isBold: true }
    ];
    if (getItemsLength(itemsTruncatedParent) <= 45) {
      return itemsTruncatedParent;
    }
  }

  // Tier 5: ... / truncated_filename.md (or just truncated_filename.md if N == 1)
  const truncatedFile = truncateFilename(filename, 20);
  if (N >= 2) {
    return [
      { text: '...', isEllipsis: true },
      { text: truncatedFile, isBold: true }
    ];
  } else {
    return [
      { text: truncatedFile, isBold: true }
    ];
  }
}

export function Topbar({
  onSearchOpen,
  onSettingsOpen,
  onExpandAll,
  onCollapseAll,
}: TopbarProps) {
  const {
    state,
    navigate,
    openInEditor,
    refresh,
    toggleTheme,
    toggleSidebar,
    dispatch,
  } = useAppState();
  const { back, forward, canGoBack, canGoForward } = useNavigation();

  const isDark =
    state.theme === 'dark' ||
    (state.theme === 'auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const breadcrumbItems = getBreadcrumbItems(state.relativePath || '');
  const breakablePath = (state.currentFile || state.relativePath || '').replace(/[\/\\]/g, '$&' + '\u200B');

  return (
    <header className="topbar">
      {/* Logo */}
      <div className="topbar__logo">
        <span className="topbar__logo-icon">
          <img
            src={logoUrl}
            width={20}
            height={20}
            alt="Markdown Explorer"
            className="topbar__logo-img"
          />
        </span>
        <div className="topbar__logo-text-group">
          <div className="topbar__logo-title">Markdown Explorer</div>
          <div className="topbar__logo-subtitle">
            by{' '}
            <a
              href="https://github.com/the-long-ride/markdown-explorer"
              target="_blank"
              rel="noopener noreferrer"
            >
              the-long-ride
            </a>{' '}
            with ❤️
          </div>
        </div>
      </div>

      <span style={{ color: 'var(--bd-s)', userSelect: 'none', margin: '0 4px', fontSize: 12 }}>
        |
      </span>

      {/* Home */}
      <TooltipButton
        className="btn btn--icon"
        onClick={() => navigate(null)}
        tooltip="Welcome Page"
        icon={<HomeIcon />}
      />

      {typeof (window as any).electronAPI !== 'undefined' && (
        <TooltipButton
          className="btn btn--icon"
          onClick={() => {
            dispatch({
              type: 'READY_ACK',
              fileList: [],
              tree: null,
              theme: state.theme,
              defaultExpanded: state.defaultExpanded,
              workspaceName: '',
              recentWorkspaces: state.recentWorkspaces
            });
            (window as any).electronAPI.postMessage({ command: 'closeWorkspace' });
          }}
          tooltip="Close Folder (Return to Workspace Selector)"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>}
        />
      )}

      <div className="topbar__divider" />

      {/* Back / Forward */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <TooltipButton
          className="btn btn--icon"
          onClick={back}
          disabled={!canGoBack}
          tooltip="Go Back"
          icon={<ChevronLeftIcon />}
        />
        <TooltipButton
          className="btn btn--icon"
          onClick={forward}
          disabled={!canGoForward}
          tooltip="Go Forward"
          icon={<ChevronRightIcon />}
        />
      </div>

      <div className="topbar__divider" />

      {/* Refresh */}
      <TooltipButton
        className="btn btn--icon"
        onClick={refresh}
        tooltip="Refresh"
        icon={<RefreshIcon />}
      />

      {/* Breadcrumb */}
      <div className="topbar__breadcrumb-container">
        <div className="topbar__breadcrumb" id="breadcrumb">
          {breadcrumbItems.map((item, idx) => (
            <span key={idx}>
              {idx > 0 && <span className="sep">/</span>}
              <span
                className={`topbar__breadcrumb-part${item.isBold ? ' topbar__breadcrumb-part--bold' : ''}`}
                style={item.isEllipsis ? { maxWidth: 'none' } : undefined}
              >
                {item.text}
              </span>
            </span>
          ))}
        </div>
        {state.relativePath && state.relativePath !== 'Welcome Page' && (
          <span className="tooltip-text">{breakablePath}</span>
        )}
      </div>

      {/* Actions */}
      <div className="topbar__actions">
        <div className="search-bar">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search docs… (Ctrl+K)"
            autoComplete="off"
            onFocus={onSearchOpen}
            aria-label="Search all markdown files"
            readOnly
          />
        </div>

        <TooltipButton className="btn" onClick={onExpandAll} tooltip="Expand All" icon={<ExpandIcon />} />
        <TooltipButton className="btn" onClick={onCollapseAll} tooltip="Collapse" icon={<CollapseIcon />} />
        <TooltipButton
          className="btn"
          onClick={openInEditor}
          tooltip="Open current file in editor"
          disabled={!state.currentFile}
          icon={<EditIcon />}
          label="Edit"
          onlyIcon={false}
        />
        <TooltipButton
          className="btn btn--icon"
          onClick={toggleTheme}
          tooltip="Toggle Theme"
          icon={isDark ? <SunIcon /> : <MoonIcon />}
        />
        <TooltipButton
          className="btn btn--icon"
          onClick={onSettingsOpen}
          tooltip="Settings"
          icon={<SettingsIcon />}
        />
        <TooltipButton
          className="btn btn--icon"
          onClick={toggleSidebar}
          tooltip="Toggle Sidebar"
          icon={<SidebarIcon />}
        />

        {typeof (window as any).electronAPI !== 'undefined' && (
          <>
            <div className="topbar__divider" style={{ margin: '0 8px' }} />
            <div className="window-controls" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
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
          </>
        )}
      </div>
    </header>
  );
}
