import type { RecentWorkspace } from '../../types';
import { usePlatform } from '../../contexts/PlatformContext';
import { getTranslations } from '../../contexts/translations';
import { getTourTranslations } from '../Tour/tourTranslations';
import { requestStartUserTour } from '../Tour/tourEvents';
import {
  FileIcon,
  FolderIcon,
  SettingsIcon,
  SparklesIcon,
  SwitchWorkspaceIcon,
  VirtualWorkspaceIcon,
} from './WelcomePageIcons';

interface WelcomeLaunchpadProps {
  language: string;
  isDesktop: boolean;
  workspaceName?: string;
  fileCount?: number;
  recentWorkspaces?: RecentWorkspace[];
}

function useOptionalPlatform() {
  try {
    return usePlatform();
  } catch {
    return (window as any).PlatformBridge ?? null;
  }
}

export function WelcomeLaunchpad({
  language,
  isDesktop,
  workspaceName,
  fileCount,
  recentWorkspaces,
}: WelcomeLaunchpadProps) {
  const bridge = useOptionalPlatform();
  const t = getTranslations(language);
  const tt = getTourTranslations(language);
  const isWebFileMode =
    typeof (window as any).__webBus !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mode')?.toLowerCase() !== 'test';

  const switchWorkspaceLabel =
    t.actions?.workspaceSelection ||
    (t.workspaceSelection as any)?.title ||
    'Switch Workspace';

  const canSwitchWorkspace =
    !isWebFileMode &&
    Boolean(workspaceName || (recentWorkspaces && recentWorkspaces.length > 0));

  const visibleRecents = (recentWorkspaces || [])
    .filter((item) => {
      const itemName = item.name || item.path.split(/[/\\]/).pop() || item.path;
      return !workspaceName || (itemName !== workspaceName && item.path !== workspaceName);
    })
    .slice(0, 5);

  const handleOpenFolder = () => {
    if (bridge?.postMessage) {
      bridge.postMessage({ command: 'openFolder', openFirstFile: false });
    } else {
      window.dispatchEvent(new CustomEvent('open-workspace-selection'));
    }
  };

  const handleOpenFile = () => {
    if (bridge?.postMessage) {
      bridge.postMessage({ command: 'openFile' });
    }
  };

  const handleCreateVirtualWorkspace = () => {
    if (bridge?.postMessage) {
      bridge.postMessage({ command: 'createVirtualWorkspace', type: 'createVirtualWorkspace' });
    } else if (typeof (window as any).__webBus !== 'undefined') {
      (window as any).__webBus.dispatchEvent(
        new CustomEvent('webview-message', {
          detail: { command: 'createVirtualWorkspace', type: 'createVirtualWorkspace' },
        })
      );
    }
  };

  const handleSwitchWorkspace = () => {
    window.dispatchEvent(new CustomEvent('open-workspace-selection'));
  };

  const handleSettings = () => {
    window.dispatchEvent(new CustomEvent('open-settings'));
  };

  const handleOpenRecent = (path: string) => {
    if (bridge?.postMessage) {
      bridge.postMessage({ command: 'openRecentWorkspace', path, openFirstFile: false });
    }
  };

  return (
    <aside
      className="welcome-launchpad"
      data-testid="welcome-launchpad"
      data-tour-id="welcome-launchpad"
    >
      <div className="welcome-launchpad__bar" data-tour-id="welcome-launchpad-actions">
        {/* Tier 1: Context & Utility Header */}
        <div className="welcome-launchpad__header">
          <div className="welcome-launchpad__workspace-status">
            <span
              className={`welcome-launchpad__status-dot ${workspaceName ? 'is-active' : ''}`}
              aria-hidden="true"
            />
            {workspaceName ? (
              <>
                <span
                  className="welcome-launchpad__workspace-name"
                  data-hover-tooltip={workspaceName}
                >
                  {workspaceName}
                </span>
                {typeof fileCount === 'number' && fileCount > 0 && (
                  <span className="welcome-launchpad__workspace-meta">
                    {fileCount} {t.sidebar?.files || 'files'}
                  </span>
                )}
              </>
            ) : (
              <span className="welcome-launchpad__workspace-empty">
                {t.workspaceSelection?.subtitle || 'Select a workspace folder or file'}
              </span>
            )}
          </div>

          <div className="welcome-launchpad__quick-grid">
            <button
              type="button"
              className="welcome-launchpad__tour-btn"
              onClick={requestStartUserTour}
              data-hover-tooltip={tt.startTour}
            >
              <SparklesIcon className="welcome-launchpad__tour-icon" />
              <span>{tt.startTour}</span>
            </button>
            <button
              type="button"
              className="welcome-launchpad__quick-btn"
              onClick={handleSettings}
              data-hover-tooltip={t.topbar?.settings || 'Settings'}
            >
              <SettingsIcon className="welcome-launchpad__quick-icon" />
              <span>{t.topbar?.settings || 'Settings'}</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Primary Actions */}
        <div className="welcome-launchpad__primary-actions">
          {isWebFileMode && (
            <button
              type="button"
              className="welcome-launchpad__action-btn welcome-launchpad__action-btn--primary"
              onClick={handleCreateVirtualWorkspace}
              data-testid="welcome-create-virtual-workspace-btn"
            >
              <VirtualWorkspaceIcon className="welcome-launchpad__btn-icon" />
              <span>New Virtual Workspace</span>
            </button>
          )}

          <button
            type="button"
            className={`welcome-launchpad__action-btn ${isWebFileMode ? 'welcome-launchpad__action-btn--secondary' : 'welcome-launchpad__action-btn--primary'}`}
            onClick={handleOpenFolder}
          >
            <FolderIcon className="welcome-launchpad__btn-icon" />
            <span>{t.workspaceSelection?.openFolder || 'Open Folder'}</span>
          </button>

          {(isDesktop || isWebFileMode) && (
            <button
              type="button"
              className="welcome-launchpad__action-btn welcome-launchpad__action-btn--secondary"
              onClick={handleOpenFile}
            >
              <FileIcon className="welcome-launchpad__btn-icon" />
              <span>{t.workspaceSelection?.openFile || 'Open File'}</span>
            </button>
          )}

          {canSwitchWorkspace && (
            <button
              type="button"
              className="welcome-launchpad__action-btn welcome-launchpad__action-btn--secondary"
              onClick={handleSwitchWorkspace}
              data-hover-tooltip={switchWorkspaceLabel}
            >
              <SwitchWorkspaceIcon className="welcome-launchpad__btn-icon" />
              <span>{switchWorkspaceLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Tier: Recent Workspaces Strip */}
      {visibleRecents.length > 0 && (
        <div className="welcome-launchpad__section welcome-launchpad__section--recents">
          <div className="welcome-launchpad__section-title">
            {t.workspaceSelection?.workspaces || 'Recent Workspaces'}
          </div>
          <div className="welcome-launchpad__recents-list">
            {visibleRecents.map((item) => {
              const itemName = item.name || item.path.split(/[/\\]/).pop() || item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  className="welcome-launchpad__recent-item"
                  onClick={() => handleOpenRecent(item.path)}
                  data-hover-tooltip={item.path}
                >
                  <FolderIcon className="welcome-launchpad__recent-icon" />
                  <span className="welcome-launchpad__recent-name">
                    {itemName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
