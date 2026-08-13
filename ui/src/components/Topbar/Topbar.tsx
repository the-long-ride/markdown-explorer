// =============================================================================
// components/Topbar/Topbar.tsx
// =============================================================================

import { useAppState } from '../../contexts/AppStateContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { TooltipButton } from '../shared/TooltipButton';
import { EditIcon } from '../shared/icons';
import { DocumentHeaderActions, NavigationHeaderActions } from '../shared/HeaderActionGroups';
import { ToolbarActionMenu } from '../shared/ToolbarActionMenu';
import { getTranslations } from '../../contexts/translations';
import { usePlatform } from '../../contexts/PlatformContext';

import logoUrl from '../../assets/logos/logo-500.png?inline';
import { getEnabledShortcut } from '../../utils/shortcuts';

interface TopbarProps {
  onSettingsOpen: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onCopyFile: (button?: HTMLElement | null) => void;
  hasUpdate?: boolean;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
}

interface BreadcrumbItem {
  text: string;
  isBold?: boolean;
  isEllipsis?: boolean;
}

const BREADCRUMB_CHAR_BUDGET = 96;

export function truncateFilename(name: string, maxLen: number): string {
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

export function getBreadcrumbItems(relativePath: string, welcomePageLabel: string): BreadcrumbItem[] {
  if (!relativePath) return [];
  if (relativePath === 'Welcome Page') {
    return [{ text: welcomePageLabel, isBold: true }];
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
  if (getItemsLength(fullItems) <= BREADCRUMB_CHAR_BUDGET) {
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
    if (getItemsLength(items) <= BREADCRUMB_CHAR_BUDGET) {
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
    if (getItemsLength(items) <= BREADCRUMB_CHAR_BUDGET) {
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
    if (getItemsLength(items) <= BREADCRUMB_CHAR_BUDGET) {
      return items;
    }

    // Try truncating parent if it's too long
    const truncatedParent = parent.length > 28 ? parent.slice(0, 25) + '...' : parent;
    const itemsTruncatedParent = [
      { text: '...', isEllipsis: true },
      { text: truncatedParent },
      { text: filename, isBold: true }
    ];
    if (getItemsLength(itemsTruncatedParent) <= BREADCRUMB_CHAR_BUDGET) {
      return itemsTruncatedParent;
    }
  }

  // Tier 5: ... / truncated_filename.md (or just truncated_filename.md if N == 1)
  const truncatedFile = truncateFilename(filename, 48);
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
  onSettingsOpen,
  onExpandAll,
  onCollapseAll,
  onCopyFile,
  hasUpdate = false,
  isFullscreen = false,
  onFullscreenToggle,
}: TopbarProps) {
  const {
    state,
    navigate,
    openInEditor,
    refresh,
    toggleTheme,
    toggleSidebar,
    toggleToc,
    toggleFocusMode,
    dispatch,
  } = useAppState();
  const { back, forward, canGoBack, canGoForward } = useNavigation();
  const bridge = usePlatform();
  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isDesktop = isElectron || state.appRuntime === 'tauri';

  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);

  const isDark =
    state.theme === 'dark' ||
    (state.theme === 'auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeToggleLabel = isDark ? t.topbar.switchToLightMode : t.topbar.switchToDarkMode;

  const breadcrumbItems = getBreadcrumbItems(state.relativePath || '', t.topbar.welcomePage);
  const breakablePath = (state.currentFile || state.relativePath || '').replace(/[\/\\]/g, '$&' + '\u200B');
  const shouldExitTauriFullscreenOnRestore =
    state.appRuntime === 'tauri' && isFullscreen && onFullscreenToggle;
  const showsRestoreControl = state.isMaximized || isFullscreen;

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

      {(state.appRuntime === 'desktop' || state.appRuntime === 'chrome' || state.appRuntime === 'tauri') && (
        <>
          <span className="topbar__crumb-separator" aria-hidden="true">
            |
          </span>

          <TooltipButton
            className="btn btn--icon"
            onClick={() => {
              dispatch({
                type: 'READY_ACK',
                fileList: [],
                tree: null,
                theme: state.theme,
                themeStyle: state.themeStyle,
                defaultExpanded: state.defaultExpanded,
                workspaceName: '',
                recentWorkspaces: state.recentWorkspaces
              });
              bridge.postMessage({ command: 'closeWorkspace' });
            }}
            tooltip={t.topbar.closeFolder}
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>}
          />
        </>
      )}

      <span className="topbar__crumb-separator" aria-hidden="true">|</span>

      <NavigationHeaderActions
        onBack={back}
        onForward={forward}
        onRefresh={refresh}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        className="topbar__nav-actions"
      />

      {/* Breadcrumb */}
      <div className="topbar__breadcrumb-container">
        <div className="topbar__breadcrumb" id="breadcrumb">
          {breadcrumbItems.map((item, idx) => (
            <span key={idx}>
              {idx > 0 && <span className="sep">/</span>}
              <span
                  className={`topbar__breadcrumb-part${item.isBold ? ' topbar__breadcrumb-part--bold' : ''}${item.isEllipsis ? ' topbar__breadcrumb-part--ellipsis' : ''}`}
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

        <DocumentHeaderActions
          onCollapseAll={onCollapseAll}
          onExpandAll={onExpandAll}
          onCopyFile={onCopyFile}
          canCopyFile={!!state.currentFile}
        />
        {state.appRuntime === 'vscode' && (
          <TooltipButton
            className="topbar__edit-action topbar__action-btn btn btn--icon"
            onClick={openInEditor}
            disabled={!state.currentFile}
            tooltip={t.topbar.edit}
            shortcut={getEnabledShortcut(state.settings, 'editCurrentDocument')}
            portalTooltip
            icon={<EditIcon size={13} />}
          />
        )}
        <ToolbarActionMenu
          triggerTooltip={t.topbar.moreActions}
          homeLabel={t.topbar.home}
          themeLabel={themeToggleLabel}
          editLabel={t.topbar.editLabel}
          settingsLabel={t.topbar.settings}
          homeTooltip={t.topbar.welcomePage}
          themeTooltip={themeToggleLabel}
          editTooltip={t.topbar.edit}
          settingsTooltip={hasUpdate ? t.topbar.settingsUpdate : t.topbar.settings}
          homeShortcut={getEnabledShortcut(state.settings, 'welcome')}
          themeShortcut={getEnabledShortcut(state.settings, 'toggleTheme')}
          editShortcut={getEnabledShortcut(state.settings, 'editCurrentDocument')}
          settingsShortcut={getEnabledShortcut(state.settings, 'settings')}
          canEdit={(state.appRuntime === 'desktop' || state.appRuntime === 'tauri' || state.appRuntime === 'vscode') && !!state.currentFile}
          showEdit={state.appRuntime === 'desktop' || state.appRuntime === 'tauri'}
          isDark={isDark}
          hasUpdate={hasUpdate}
          onHome={() => navigate(null)}
          onTheme={toggleTheme}
          onEdit={openInEditor}
          onSettings={onSettingsOpen}
          sidebarLabel={t.actions.toggleSidebar}
          sidebarTooltip={t.actions.toggleSidebar}
          sidebarShortcut={getEnabledShortcut(state.settings, 'toggleSidebar')}
          sidebarActive={!state.sidebarCollapsed}
          onSidebarToggle={toggleSidebar}
          tocLabel={t.actions.toggleToc}
          tocTooltip={t.actions.toggleToc}
          tocShortcut={getEnabledShortcut(state.settings, 'toggleToc')}
          tocActive={!state.tocCollapsed && !!state.currentFile && state.toc.length > 0}
          tocToggleDisabled={!state.currentFile || state.toc.length === 0}
          onTocToggle={toggleToc}
          focusModeLabel={t.actions.toggleFocusMode}
          focusModeTooltip={t.actions.toggleFocusMode}
          focusModeShortcut={getEnabledShortcut(state.settings, 'toggleFocusMode')}
          isFocusMode={state.focusMode}
          onFocusModeToggle={toggleFocusMode}
          showFullscreen={isDesktop}
          fullscreenLabel={t.actions.toggleFullscreen}
          fullscreenTooltip={t.actions.toggleFullscreenTooltip}
          fullscreenShortcut="F11"
          isFullscreen={isFullscreen}
          onFullscreenToggle={onFullscreenToggle}
          showResetZoom={isDesktop}
          resetZoomLabel={t.tooltips.resetZoom}
          resetZoomTooltip={t.tooltips.resetZoom}
          resetZoomShortcut={getEnabledShortcut(state.settings, 'resetZoom')}
          onResetZoom={() => bridge.postMessage({ command: 'zoom-reset' })}
        />

        {isDesktop && (
          <>
            <span
              className="topbar__crumb-separator topbar__crumb-separator--window-controls"
              aria-hidden="true"
            >
              |
            </span>
            <div className="window-controls topbar__window-controls">
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={() => bridge.postMessage({ command: 'window-minimize' })}
                tooltip={t.tooltips.minimize}
                icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>}
              />
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={() => {
                  if (shouldExitTauriFullscreenOnRestore) {
                    onFullscreenToggle?.();
                  } else {
                    bridge.postMessage({ command: 'window-maximize' });
                  }
                }}
                tooltip={showsRestoreControl ? t.tooltips.restore : t.tooltips.maximize}
                icon={showsRestoreControl ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M8 8V3h13v13h-5" />
                    <path d="M3 8h13v13H3z" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                )}
              />
              <TooltipButton
                className="btn btn--icon window-control-btn window-control-btn--close"
                onClick={() => bridge.postMessage({ command: 'window-close' })}
                tooltip={t.tooltips.closeApp}
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
