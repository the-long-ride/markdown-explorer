import { FolderIcon } from '../shared/icons';
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
}

export function RecentWorkspaceItem({
  item,
  displayName,
  modal = false,
  onOpen,
  onDelete,
}: RecentWorkspaceItemProps) {
  const { state } = useAppState();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);

  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: modal ? '12px 14px' : '14px 16px',
        background: 'var(--bg-s)',
        border: '1px solid var(--bd-s)',
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
      className="recent-workspace-item"
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'var(--bg-h)';
        e.currentTarget.style.borderColor = 'var(--accent)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'var(--bg-s)';
        e.currentTarget.style.borderColor = 'var(--bd-s)';
      }}
    >
      <FolderIcon size={modal ? 14 : 16} style={{ color: 'var(--accent)', opacity: 0.8, marginTop: '2px', alignSelf: 'flex-start' }} />
      <div style={{ flex: 1, minWidth: 0, paddingRight: '24px' }}>
        <div style={{
          fontSize: modal ? '13px' : '13.5px',
          fontWeight: 600,
          color: 'var(--tx)',
          marginBottom: modal ? '2px' : '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{displayName}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: modal ? '2px' : '4px', minWidth: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left', flex: 1 }}>{item.path}</span>
          {item.lastOpened && (
            <span style={{ fontSize: modal ? '9.5px' : '10px', color: 'var(--txm)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {t.recentWorkspaces.lastOpened}: {formatLastOpened(item.lastOpened)}
            </span>
          )}
        </div>
      </div>
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
  );
}
