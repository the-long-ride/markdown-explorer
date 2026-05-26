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

  const breadcrumbParts = (state.relativePath || '').split(/[\\/]/);

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
      <div className="topbar__breadcrumb" id="breadcrumb">
        {breadcrumbParts.length > 3 ? (
          <>
            <span>
              <span className="topbar__breadcrumb-part">{breadcrumbParts[0]}</span>
              <span className="sep">/</span>
            </span>
            <span>
              <span className="topbar__breadcrumb-part" style={{ maxWidth: 'none' }}>...</span>
              <span className="sep">/</span>
            </span>
            <span>
              <span className="topbar__breadcrumb-part">{breadcrumbParts[breadcrumbParts.length - 2]}</span>
              <span className="sep">/</span>
            </span>
            <span style={{ color: 'var(--tx)', fontWeight: 500 }} className="topbar__breadcrumb-part">
              {breadcrumbParts[breadcrumbParts.length - 1]}
            </span>
          </>
        ) : (
          breadcrumbParts.map((part, i) =>
            i < breadcrumbParts.length - 1 ? (
              <span key={i}>
                <span className="topbar__breadcrumb-part">{part}</span>
                <span className="sep">/</span>
              </span>
            ) : (
              <span key={i} style={{ color: 'var(--tx)', fontWeight: 500 }} className="topbar__breadcrumb-part">
                {part}
              </span>
            ),
          )
        )}
        <span className="tooltip-text">{state.currentFile || state.relativePath || ''}</span>
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
