import { TooltipButton } from '../shared/TooltipButton';
import type { RecentWorkspace } from '../../types';
import { RecentWorkspaceItem } from './RecentWorkspaceItem';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';

interface RecentWorkspacesModalProps {
  recents: readonly RecentWorkspace[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onOpenRecent: (path: string) => void;
  onDeleteRecent: (path: string) => void;
  onRenameRecent?: (path: string, nextName: string, fallbackName: string) => void;
  getDisplayName: (item: RecentWorkspace) => string;
}

export function RecentWorkspacesModal({
  recents,
  searchQuery,
  onSearchChange,
  onClose,
  onOpenRecent,
  onDeleteRecent,
  onRenameRecent,
  getDisplayName,
}: RecentWorkspacesModalProps) {
  const { state } = useAppState();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);

  return (
    <div
      className="mdn-modal recent-workspaces-modal"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-card recent-workspaces-modal__card">
        <TooltipButton className="settings-card__close" onClick={onClose} tooltip={t.tooltips.close} tooltipPos="below">
          &times;
        </TooltipButton>
        <div className="settings-card__header recent-workspaces-modal__header">
          <h2>{t.recentWorkspaces.title}</h2>
          <p>{t.recentWorkspaces.subtitle}</p>
        </div>

        <div className="search-bar recent-workspaces-modal__search">
          <svg className="recent-workspaces-modal__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            placeholder={t.recentWorkspaces.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="recent-workspaces-modal__clear" onClick={() => onSearchChange('')}>
              &times;
            </button>
          )}
        </div>

        <div className="recent-workspaces-modal__list">
          {recents.length > 0 ? (
            recents.map((item, idx) => (
              <RecentWorkspaceItem
                key={`${item.path}-${idx}`}
                item={item}
                displayName={getDisplayName(item)}
                modal
                onOpen={() => {
                  onOpenRecent(item.path);
                  onClose();
                }}
                onDelete={() => onDeleteRecent(item.path)}
                onRename={onRenameRecent ? (nextName) => onRenameRecent(item.path, nextName, item.name) : undefined}
              />
            ))
          ) : (
            <div className="recent-workspaces-modal__empty">
              {t.recentWorkspaces.noWorkspaces}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
