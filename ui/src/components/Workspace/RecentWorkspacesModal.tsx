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
      className="mdn-modal"
      style={{ display: 'flex' }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-card" style={{ width: '480px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh' }}>
        <TooltipButton className="settings-card__close" onClick={onClose} tooltip={t.tooltips.close} tooltipPos="below">
          &times;
        </TooltipButton>
        <div className="settings-card__header" style={{ margin: 0, paddingBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tx)', margin: 0 }}>{t.recentWorkspaces.title}</h2>
          <p style={{ fontSize: '11.5px', color: 'var(--tx2)', margin: '4px 0 0' }}>{t.recentWorkspaces.subtitle}</p>
        </div>

        <div className="search-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-e)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-md)', height: '36px', padding: '0 12px', width: '100%', boxSizing: 'border-box' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--txm)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            placeholder={t.recentWorkspaces.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx)', fontSize: '13px', fontFamily: 'var(--font-ui)', width: '100%', height: '100%' }}
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} style={{ background: 'none', border: 'none', color: 'var(--tx2)', fontSize: '16px', cursor: 'pointer', padding: '0 4px' }}>
              &times;
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', maxHeight: '352px' }}>
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
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--tx2)', fontSize: '12.5px' }}>
              {t.recentWorkspaces.noWorkspaces}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
