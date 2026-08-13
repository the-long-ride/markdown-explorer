import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { FolderIcon } from '../shared/icons';
import logoUrl from '../../assets/logos/logo-500.png?inline';
import type { RecentWorkspace } from '../../types';
import type { WorkspaceOperationContext } from '../../desktop/workspaceOperations';
import { RecentWorkspaceItem } from './RecentWorkspaceItem';
import { RecentWorkspacesModal } from './RecentWorkspacesModal';
import { WorkspaceWindowControls } from './WorkspaceWindowControls';
import { InteractiveBackground } from '../shared/InteractiveBackground';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import { getTranslations } from '../../contexts/translations';
import { useCssVars } from '../../utils/useCssVars';

interface WorkspaceSelectionProps {
  onBeforeOpenWorkspace?: () => WorkspaceOperationContext | undefined;
  embeddedInTabs?: boolean;
  workspaceAliases?: Record<string, string>;
  onWorkspaceAliasChange?: (workspacePath: string, alias: string, fallbackName?: string) => void;
}

export function WorkspaceSelection({
  onBeforeOpenWorkspace,
  embeddedInTabs = false,
  workspaceAliases = {},
  onWorkspaceAliasChange,
}: WorkspaceSelectionProps = {}) {
  const { state, toggleTheme } = useAppState();
  const bridge = usePlatform();
  const t = getTranslations(state.settings.language || 'en');
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceScale, setWorkspaceScale] = useState(1);
  const workspacePanelRef = useRef<HTMLDivElement>(null);
  useCssVars(workspacePanelRef, { '--workspace-scale': workspaceScale });
  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isDesktop = isElectron;
  const isWebDemo = typeof (window as any).__webDemoBus !== 'undefined';
  const isWebFileMode = isWebDemo && new URLSearchParams(window.location.search).get('mode') === 'file';

  const handleOpenFolder = () => {
    const operation = onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'openFolder', openFirstFile: embeddedInTabs, ...operation });
  };

  const handleOpenFile = () => {
    const operation = onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'openFile', ...operation });
  };

  const handleOpenRecent = (path: string) => {
    const operation = onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'openRecentWorkspace', path, openFirstFile: embeddedInTabs, ...operation });
  };

  const handleDeleteRecent = (path: string) => {
    bridge.postMessage({ command: 'deleteRecentWorkspace', path });
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
  }, [modalOpen, state.recentWorkspaces]);

  const recents = state.recentWorkspaces || [];
  const displayRecents = recents.slice(0, 3);
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
      />

      <div
        ref={workspacePanelRef}
        className="workspace-selection__panel"
      >
        <div className="workspace-selection__brand">
          <img className="workspace-selection__brand-logo" src={logoUrl} width="64" height="64" alt="Markdown Explorer" />
          <h1>Markdown Explorer</h1>
          <p>{t.workspaceSelection.subtitle}</p>
        </div>

        <div className="workspace-selection__actions">
          {!isWebFileMode && (
            <button
              onClick={handleOpenFolder}
              className="workspace-selection__open-button"
            >
              <FolderIcon size={16} />
              {t.workspaceSelection.openFolder}
            </button>
          )}

          {(isDesktop || isWebFileMode) && (
            <button
              onClick={handleOpenFile}
              className={`${isWebFileMode ? 'workspace-selection__open-button' : 'workspace-selection__open-file'}`}
            >
              <svg className="workspace-selection__tip-icon" width={isWebFileMode ? "16" : "14"} height={isWebFileMode ? "16" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              {t.workspaceSelection.openFile}
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

        {recents.length > 0 && (
          <div className="workspace-selection__recents">
            <h3>{t.workspaceSelection.workspaces}</h3>
            {embeddedInTabs && isDesktop && (
              <p className="workspace-selection__recents-note">
                {t.workspaceSelection.renameTip}
              </p>
            )}
            <div className="workspace-selection__recent-list">
              {displayRecents.map((item, idx) => (
                <RecentWorkspaceItem
                  key={`${item.path}-${idx}`}
                  item={item}
                  displayName={getWorkspaceDisplayName(item)}
                  onOpen={() => handleOpenRecent(item.path)}
                  onDelete={() => handleDeleteRecent(item.path)}
                  onRename={onWorkspaceAliasChange ? (nextName) => onWorkspaceAliasChange(item.path, nextName, item.name) : undefined}
                />
              ))}
            </div>
            {recents.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setModalOpen(true);
                }}
                className="workspace-selection__show-more"
              >
                {t.workspaceSelection.showMore}
              </button>
            )}
          </div>
        )}

        {!isDesktop && !isWebDemo && (
          <div className="workspace-selection__guide">
            <div className="workspace-selection__guide-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              <span>{t.workspaceSelection.browserConfigTitle}</span>
            </div>
            <span className="workspace-selection__guide-copy">
              {t.workspaceSelection.browserConfigIntro}
            </span>
            <div className="workspace-selection__guide-list">
              <div>1. {t.workspaceSelection.browserConfigOpen} <code>chrome://flags</code> {t.workspaceSelection.browserConfigOr} <code>brave://flags</code></div>
              <div>2. {t.workspaceSelection.browserConfigSearch} <strong>File System Access API</strong></div>
              <div>3. {t.workspaceSelection.browserConfigEnable}</div>
            </div>
          </div>
        )}

        {isElectron && state.hostPlatform === 'macos' && (
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
              {getWelcomeTranslations(state.settings.language || 'en').hero.macosInstallBtn}
            </a>
          </div>
        )}
      </div>

      {modalOpen && (
        <RecentWorkspacesModal
          recents={filteredRecents}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClose={() => setModalOpen(false)}
          onOpenRecent={handleOpenRecent}
          onDeleteRecent={handleDeleteRecent}
          onRenameRecent={onWorkspaceAliasChange}
          getDisplayName={getWorkspaceDisplayName}
        />
      )}
    </div>
  );
}
