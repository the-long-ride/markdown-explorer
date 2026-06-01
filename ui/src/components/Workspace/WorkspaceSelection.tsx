import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { FolderIcon } from '../shared/icons';
import logoUrl from '../../assets/logos/logo-128.png';
import type { RecentWorkspace } from '../../types';
import { RecentWorkspaceItem } from './RecentWorkspaceItem';
import { RecentWorkspacesModal } from './RecentWorkspacesModal';
import { WorkspaceWindowControls } from './WorkspaceWindowControls';

interface WorkspaceSelectionProps {
  onBeforeOpenWorkspace?: () => void;
  embeddedInTabs?: boolean;
  workspaceAliases?: Record<string, string>;
}

export function WorkspaceSelection({
  onBeforeOpenWorkspace,
  embeddedInTabs = false,
  workspaceAliases = {},
}: WorkspaceSelectionProps = {}) {
  const { state, toggleTheme } = useAppState();
  const bridge = usePlatform();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceScale, setWorkspaceScale] = useState(1);
  const workspacePanelRef = useRef<HTMLDivElement>(null);

  const handleOpenFolder = () => {
    onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'openFolder', openFirstFile: embeddedInTabs });
  };

  const handleOpenFile = () => {
    onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'openFile' });
  };

  const handleOpenRecent = (path: string) => {
    onBeforeOpenWorkspace?.();
    bridge.postMessage({ command: 'openRecentWorkspace', path, openFirstFile: embeddedInTabs });
  };

  const handleDeleteRecent = (path: string) => {
    bridge.postMessage({ command: 'deleteRecentWorkspace', path });
  };

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
      className="workspace-selection"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: workspaceScale < 1 ? 'flex-start' : 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        fontFamily: 'var(--font-ui)',
        padding: '40px 20px',
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        position: 'relative',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      <WorkspaceWindowControls
        embeddedInTabs={embeddedInTabs}
        theme={state.theme}
        isMaximized={state.isMaximized}
        onToggleTheme={toggleTheme}
      />

      <div
        ref={workspacePanelRef}
        className="workspace-selection__panel"
        style={{
          width: '100%',
          maxWidth: 'min(420px, 100%)',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '32px',
          transform: `scale(${workspaceScale})`,
          transformOrigin: 'center top',
          transition: 'transform 0.12s ease',
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <img src={logoUrl} width="64" height="64" alt="Markdown Explorer" style={{ opacity: 0.95, filter: 'drop-shadow(0 4px 12px var(--accent-dim))', marginBottom: '8px' }} />
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: 0, margin: 0, color: 'var(--tx)' }}>Markdown Explorer</h1>
          <p style={{ fontSize: '14px', color: 'var(--tx2)', margin: 0, lineHeight: 1.5 }}>Documentation viewer & navigator</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleOpenFolder}
            className="btn btn--accent"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px 20px', fontSize: '14px', fontWeight: 600, width: '100%', height: 'auto', borderRadius: 'var(--r-lg)', cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 12px var(--accent-dim)', transition: 'all 0.15s ease' }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px var(--accent-dim)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 12px var(--accent-dim)';
            }}
          >
            <FolderIcon size={16} />
            Open Folder
          </button>

          <button
            onClick={handleOpenFile}
            className="btn btn--outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', fontSize: '12.5px', fontWeight: 500, width: '100%', height: 'auto', borderRadius: 'var(--r-lg)', cursor: 'pointer', border: '1.5px solid var(--bd-s)', background: 'transparent', color: 'var(--tx2)', transition: 'all 0.15s ease', marginTop: '4px' }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--tx)';
              e.currentTarget.style.background = 'var(--accent-dim)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--bd-s)';
              e.currentTarget.style.color = 'var(--tx2)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
            Open File
          </button>
        </div>

        {recents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, color: 'var(--tx2)' }}>Workspaces</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayRecents.map((item, idx) => (
                <RecentWorkspaceItem
                  key={`${item.path}-${idx}`}
                  item={item}
                  displayName={getWorkspaceDisplayName(item)}
                  onOpen={() => handleOpenRecent(item.path)}
                  onDelete={() => handleDeleteRecent(item.path)}
                />
              ))}
            </div>
            {recents.length > 3 && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setModalOpen(true);
                }}
                style={{ alignSelf: 'center', background: 'none', border: 'none', fontSize: '12px', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', padding: '6px 12px', transition: 'opacity 0.1s' }}
                onMouseOver={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                Show More...
              </button>
            )}
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
          getDisplayName={getWorkspaceDisplayName}
        />
      )}
    </div>
  );
}
