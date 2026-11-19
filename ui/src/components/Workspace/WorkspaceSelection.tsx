import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { useDirtyDocumentsGuard } from '../../hooks/useDirtyDocumentsGuard';
import { FolderIcon } from '../shared/icons';
import logoUrl from '../../assets/logos/logo-500.png?inline';
import type { RecentWorkspace } from '../../types';
import type { WorkspaceOperationContext } from '../../desktop/workspaceOperations';
import { BrowserFlagGuideModal } from './BrowserFlagGuideModal';
import { RecentWorkspaceItem } from './RecentWorkspaceItem';
import { WorkspaceWindowControls } from './WorkspaceWindowControls';
import { InteractiveBackground } from '../shared/InteractiveBackground';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import { getTranslations } from '../../contexts/translations';
import { useCssVars } from '../../utils/useCssVars';

interface WorkspaceSelectionProps {
  onBeforeOpenWorkspace?: () => WorkspaceOperationContext | undefined;
  onOpenHomepage?: () => void;
  embeddedInTabs?: boolean;
  workspaceAliases?: Record<string, string>;
  onWorkspaceAliasChange?: (workspacePath: string, alias: string, fallbackName?: string) => void;
}

export function WorkspaceSelection({
  onBeforeOpenWorkspace,
  onOpenHomepage,
  embeddedInTabs = false,
  workspaceAliases = {},
  onWorkspaceAliasChange,
}: WorkspaceSelectionProps = {}) {
  const { state, toggleTheme } = useAppState();
  const bridge = usePlatform();
  const guardWorkspaceLeave = useDirtyDocumentsGuard();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);
  const welcomeT = getWelcomeTranslations(currentLang);
  const [searchQuery, setSearchQuery] = useState('');
  const [flagGuideOpen, setFlagGuideOpen] = useState(false);
  const [workspaceScale, setWorkspaceScale] = useState(1);
  const workspacePanelRef = useRef<HTMLDivElement>(null);
  useCssVars(workspacePanelRef, { '--workspace-scale': workspaceScale });
  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isDesktop = isElectron || state.appRuntime === 'tauri' || state.appRuntime === 'desktop';
  const isWeb = typeof (window as any).__webBus !== 'undefined';
  const isWebFileMode = isWeb && new URLSearchParams(window.location.search).get('mode')?.toLowerCase() !== 'test';
  const isWebVariant = isWeb || (!isDesktop && state.appRuntime === 'web');

  // Opening another workspace replaces the loaded one; a dirty document left
  // behind by an earlier host-initiated switch is resolved before it is dropped.
  const handleOpenFolder = () => guardWorkspaceLeave(() => {
    const operation = onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'openFolder', openFirstFile: embeddedInTabs, ...operation });
  });

  const handleOpenFile = () => guardWorkspaceLeave(() => {
    const operation = onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'openFile', ...operation });
  });

  const handleCreateVirtualWorkspace = () => guardWorkspaceLeave(() => {
    const operation = onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'createVirtualWorkspace', type: 'createVirtualWorkspace', ...operation });
  });

  const handleOpenRecent = (path: string) => guardWorkspaceLeave(() => {
    const operation = onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'openRecentWorkspace', path, openFirstFile: embeddedInTabs, ...operation });
  });

  const handleDeleteRecent = (path: string) => {
    bridge.postMessage({ command: 'deleteRecentWorkspace', path });
  };

  const handleOpenHomepage = () => {
    onOpenHomepage?.();
    window.dispatchEvent(new CustomEvent('open-homepage'));
  };

  useEffect(() => {
    const preventRefresh = (event: KeyboardEvent) => {
      if (event.key !== 'F5') return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('keydown', preventRefresh, true);
    return () => document.removeEventListener('keydown', preventRefresh, true);
  }, []);

  useEffect(() => {
    let rafId = 0;
    const updateScale = () => {
      const panel = workspacePanelRef.current;
      if (!panel) return;
      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const availableWidth = Math.max(280, viewportWidth - 40);
      const availableHeight = Math.max(340, viewportHeight - 88);
      const rawWidth = Math.max(panel.scrollWidth, panel.offsetWidth, 1);
      const rawHeight = Math.max(panel.scrollHeight, panel.offsetHeight, 1);
      const nextScale = Math.min(1, availableWidth / rawWidth, availableHeight / rawHeight);
      setWorkspaceScale(Math.max(0.68, Math.floor(nextScale * 100) / 100));
    };

    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScale);
    };

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
    };
  }, [state.recentWorkspaces]);

  const recents = state.recentWorkspaces || [];
  const getWorkspaceDisplayName = (item: RecentWorkspace) =>
    workspaceAliases[item.path]?.trim() || item.name;

  const filteredRecents = recents.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      getWorkspaceDisplayName(item).toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q)
    );
  });

  const showMacGuide = isElectron && state.hostPlatform === 'macos';
  const hasSecondaryColumn = recents.length > 0 || showMacGuide;

  return (
    <div
      className={`workspace-selection ${workspaceScale < 1 ? 'workspace-selection--scaled-down' : 'workspace-selection--centered'}`}
    >
      <InteractiveBackground />
      <WorkspaceWindowControls
        embeddedInTabs={embeddedInTabs}
        theme={state.theme}
        isMaximized={state.isMaximized}
        onToggleTheme={toggleTheme}
        onOpenHomepage={handleOpenHomepage}
      />

      <div
        ref={workspacePanelRef}
        className={`workspace-selection__panel${hasSecondaryColumn ? ' workspace-selection__panel--split' : ''}`}
      >
        <div className="workspace-selection__primary">
          <div className="workspace-selection__brand" data-tour-id="welcome-hero">
            <img className="workspace-selection__brand-logo" src={logoUrl} width="64" height="64" alt="Markdown Explorer" />
            <h1>Markdown Explorer</h1>
            <p>{t.workspaceSelection.subtitle}</p>
          </div>

          <div className="workspace-selection__actions" data-tour-id="welcome-launchpad">
            <button
              onClick={handleOpenFolder}
              className="workspace-selection__open-button"
            >
              <FolderIcon size={16} />
              <span className="btn-label">{t.workspaceSelection.openFolder}</span>
            </button>

            {isWebVariant && (
              <div className="workspace-selection__flag-hint" data-testid="open-folder-flag-hint">
                <span>
                  Enable the File System Access flag to open folders.{' '}
                </span>
                <button
                  type="button"
                  className="workspace-selection__flag-link"
                  data-testid="open-folder-flag-guide-link"
                  onClick={() => setFlagGuideOpen(true)}
                >
                  View guideline
                </button>
              </div>
            )}

            {(isDesktop || isWebFileMode) && (
              <button
                onClick={handleOpenFile}
                className="workspace-selection__open-file"
              >
                <svg className="workspace-selection__tip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                <span className="btn-label">{t.workspaceSelection.openFile}</span>
              </button>
            )}

            {isWeb && (
              <button
                onClick={handleCreateVirtualWorkspace}
                className="workspace-selection__open-button"
                data-testid="create-virtual-workspace-btn"
              >
                <svg className="workspace-selection__tip-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
                <span className="btn-label">New Virtual Workspace</span>
              </button>
            )}

            <div className="workspace-selection__tip">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>{isWebFileMode ? t.workspaceSelection.dragFileTip : t.workspaceSelection.dragFolderOrFileTip}</span>
            </div>
          </div>
        </div>

        {hasSecondaryColumn && (
          <div className="workspace-selection__secondary">
            {recents.length > 0 && (
              <div className="workspace-selection__recents">
                <div className="workspace-selection__recents-header">
                  <h3>{t.recentWorkspaces.title}</h3>
                  <p className="workspace-selection__recents-subtitle">{t.recentWorkspaces.subtitle}</p>
                </div>
                {embeddedInTabs && isDesktop && (
                  <p className="workspace-selection__recents-note">
                    {t.workspaceSelection.renameTip}
                  </p>
                )}
                <div className="search-bar recent-workspaces-modal__search workspace-selection__search">
                  <svg className="recent-workspaces-modal__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    placeholder={t.recentWorkspaces.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="recent-workspaces-modal__clear"
                      aria-label={t.tooltips.close}
                      onClick={() => setSearchQuery('')}
                    >
                      &times;
                    </button>
                  )}
                </div>
                <div className={`workspace-selection__recent-list${filteredRecents.length > 5 ? ' workspace-selection__recent-list--scrollable' : ''}`}>
                  {filteredRecents.length > 0 ? (
                    filteredRecents.map((item, idx) => (
                      <RecentWorkspaceItem
                        key={`${item.path}-${idx}`}
                        item={item}
                        displayName={getWorkspaceDisplayName(item)}
                        onOpen={() => handleOpenRecent(item.path)}
                        onDelete={() => handleDeleteRecent(item.path)}
                        onRename={onWorkspaceAliasChange ? (nextName) => onWorkspaceAliasChange(item.path, nextName, item.name) : undefined}
                      />
                    ))
                  ) : (
                    <div className="recent-workspaces-modal__empty">
                      {t.recentWorkspaces.noWorkspaces}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showMacGuide && (
              <div className="workspace-selection__guide workspace-selection__guide--mac">
                <div className="workspace-selection__guide-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                  <span>{t.workspaceSelection.macosInstallTitle}</span>
                </div>
                <span className="workspace-selection__guide-copy">
                  {t.workspaceSelection.macosInstallBody}
                </span>
                <a
                  href="https://github.com/the-long-ride/markdown-explorer/blob/main/docs/macos-install.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="workspace-selection__guide-link"
                >
                  {welcomeT.hero.macosInstallBtn}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      <BrowserFlagGuideModal isOpen={flagGuideOpen} onClose={() => setFlagGuideOpen(false)} t={t} />
    </div>
  );
}
