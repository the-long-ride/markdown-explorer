import { useState } from 'react';
import { TooltipButton } from '../shared/TooltipButton';
import {
  CloseIcon,
  HomeIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SidebarIcon,
  SunIcon,
} from '../shared/icons';
import logoUrl from '../../assets/logos/logo-128.png';
import { getTabLabel } from '../../desktop/desktopTabs';
import type { DesktopTab } from '../../desktop/types';

interface DesktopTabBarProps {
  tabs: DesktopTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
  onAliasChange: (tabId: string, alias: string) => void;
  onSearchOpen: () => void;
  searchShortcutLabel: string;
  onThemeToggle: () => void;
  onSettingsOpen: () => void;
  onSidebarToggle: () => void;
  isDark: boolean;
  isMaximized: boolean;
  hasUpdate?: boolean;
}

export function DesktopTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  onCloseTab,
  onAliasChange,
  onSearchOpen,
  searchShortcutLabel,
  onThemeToggle,
  onSettingsOpen,
  onSidebarToggle,
  isDark,
  isMaximized,
  hasUpdate = false,
}: DesktopTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftAlias, setDraftAlias] = useState('');

  const startEditing = (tab: DesktopTab) => {
    if (tab.kind !== 'workspace') return;
    setEditingTabId(tab.id);
    setDraftAlias(tab.alias ?? tab.workspaceName ?? '');
  };

  const commitAlias = () => {
    if (editingTabId) onAliasChange(editingTabId, draftAlias.trim());
    setEditingTabId(null);
    setDraftAlias('');
  };

  return (
    <header className="desktop-tabbar">
      <div className="desktop-tabbar__brand topbar__logo" aria-label="Markdown Explorer">
        <span className="topbar__logo-icon">
          <img src={logoUrl} width={20} height={20} alt="Markdown Explorer" className="topbar__logo-img" />
        </span>
        <div className="topbar__logo-text-group">
          <div className="topbar__logo-title">Markdown Explorer</div>
          <div className="topbar__logo-subtitle">
            by <a href="https://github.com/the-long-ride/markdown-explorer" target="_blank" rel="noopener noreferrer">the-long-ride</a> with ❤️
          </div>
        </div>
      </div>
      <button
        type="button"
        className={`desktop-tabbar__home${activeTabId === 'home' ? ' is-active' : ''}`}
        aria-label="Home"
        onClick={() => onSelectTab('home')}
      >
        <HomeIcon size={14} />
      </button>
      <div className="desktop-tabbar__tabs" role="tablist" aria-label="Workspace tabs">
        {tabs.filter((tab) => tab.kind !== 'home').map((tab) => {
          const active = tab.id === activeTabId;
          const editing = editingTabId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`desktop-tab${active ? ' is-active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              onMouseDown={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
              onAuxClick={(event) => {
                if (event.button !== 1) return;
                event.preventDefault();
                event.stopPropagation();
                onCloseTab(tab.id);
              }}
              onDoubleClick={() => startEditing(tab)}
              title={tab.workspacePath ?? getTabLabel(tab)}
            >
              {editing ? (
                <input
                  className="desktop-tab__alias-input"
                  value={draftAlias}
                  autoFocus
                  onChange={(event) => setDraftAlias(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={commitAlias}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitAlias();
                    if (event.key === 'Escape') {
                      setEditingTabId(null);
                      setDraftAlias('');
                    }
                  }}
                />
              ) : (
                <span className="desktop-tab__label">{getTabLabel(tab)}</span>
              )}
              <span
                className="desktop-tab__close"
                role="button"
                tabIndex={-1}
                aria-label="Close tab"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <CloseIcon size={11} />
              </span>
            </button>
          );
        })}
      </div>
      <TooltipButton className="btn btn--icon desktop-tabbar__new" onClick={onNewTab} tooltip="New workspace tab" icon={<PlusIcon />} />
      <div className="desktop-tabbar__spacer" />
      <button type="button" className="desktop-tabbar__search" onClick={onSearchOpen} aria-label="Search all tabs">
        <SearchIcon size={13} />
        <span>Search all tabs... ({searchShortcutLabel})</span>
      </button>
      <TooltipButton className="btn btn--icon" onClick={onThemeToggle} tooltip="Toggle light/dark mode" icon={isDark ? <SunIcon /> : <MoonIcon />} />
      <TooltipButton
        className={`btn btn--icon${hasUpdate ? ' has-update' : ''}`}
        onClick={onSettingsOpen}
        tooltip={hasUpdate ? 'Settings - update available' : 'Settings'}
        icon={<SettingsIcon />}
      />
      <TooltipButton className="btn btn--icon" onClick={onSidebarToggle} tooltip="Toggle Sidebar" icon={<SidebarIcon />} />
      <div className="desktop-tabbar__window-controls">
        <TooltipButton
          className="btn btn--icon window-control-btn"
          onClick={() => (window as any).electronAPI.postMessage({ command: 'window-minimize' })}
          tooltip="Minimize"
          icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
        />
        <TooltipButton
          className="btn btn--icon window-control-btn"
          onClick={() => (window as any).electronAPI.postMessage({ command: 'window-maximize' })}
          tooltip={isMaximized ? 'Restore' : 'Maximize'}
          icon={isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M8 3h13v13H8z" />
              <path d="M16 16v5H3V8h5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
          )}
        />
        <TooltipButton
          className="btn btn--icon window-control-btn window-control-btn--close"
          onClick={() => (window as any).electronAPI.postMessage({ command: 'window-close' })}
          tooltip="Close App"
          tooltipAlign="right"
          icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
        />
      </div>
    </header>
  );
}
