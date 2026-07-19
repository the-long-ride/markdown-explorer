import { useEffect, useState } from 'react';
import { EditIcon, FolderIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import type { RecentWorkspace } from '../../types';
import { formatLastOpened } from './workspaceSelectionUtils';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';

interface RecentWorkspaceItemProps {
  item: RecentWorkspace;
  displayName: string;
  modal?: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onRename?: (nextName: string) => void;
}

export function RecentWorkspaceItem({
  item,
  displayName,
  modal = false,
  onOpen,
  onDelete,
  onRename,
}: RecentWorkspaceItemProps) {
  const { state } = useAppState();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(displayName);

  useEffect(() => {
    if (!isEditing) setDraftName(displayName);
  }, [displayName, isEditing]);

  const commitRename = () => {
    if (onRename) onRename(draftName);
    setIsEditing(false);
  };

  return (
    <div
      onClick={onOpen}
      className={`recent-workspace-item${modal ? ' recent-workspace-item--modal' : ''}`}
    >
      <FolderIcon size={modal ? 14 : 16} className="recent-workspace-item__icon" />
      <div className="recent-workspace-item__content">
        {isEditing ? (
          <input
            value={draftName}
            autoFocus
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitRename();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setDraftName(displayName);
                setIsEditing(false);
              }
            }}
            className="recent-workspace-item__edit"
          />
        ) : (
          <div className="recent-workspace-item__name">{displayName}</div>
        )}
        <div className="recent-workspace-item__meta">
          <span className="recent-workspace-item__path">{item.path}</span>
          {item.lastOpened && (
            <span className="recent-workspace-item__last-opened">
              {t.recentWorkspaces.lastOpened}: {formatLastOpened(item.lastOpened)}
            </span>
          )}
        </div>
      </div>
      <div 
        className={`recent-workspace-actions${modal ? ' recent-workspace-actions--modal' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {onRename && !isEditing && (
          <TooltipButton
            onClick={(event) => {
              event.stopPropagation();
              setDraftName(displayName);
              setIsEditing(true);
            }}
            className={`recent-workspace-delete-btn${modal ? ' recent-workspace-delete-btn--modal' : ''}`}
            tooltip="Rename workspace"
            tooltipPos="above"
            tooltipAlign="right"
          >
            <EditIcon size={11} />
          </TooltipButton>
        )}
        <TooltipButton
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`recent-workspace-delete-btn${modal ? ' recent-workspace-delete-btn--modal' : ''}`}
          tooltip={t.tooltips.removeFromRecents}
          tooltipPos="above"
          tooltipAlign="right"
        >
          &times;
        </TooltipButton>
      </div>
    </div>
  );
}
