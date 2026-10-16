import { useState } from 'react';
import type { Translations } from '../../contexts/translations';
import type { WorkspaceEntryDeleteMode } from '../../types';
import { fillTemplate } from '../../workspace/workspaceEntryMessages';
import { CloseIcon, CollapseIcon, ExpandIcon, TrashIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { SidebarDeleteDialog } from './SidebarDeleteDialog';
import { SidebarConfirmDialog } from './SidebarConfirmDialog';
import { UnpinIcon } from './sidebarPinIcons';

interface SidebarSelectionActionsProps {
  t: Translations;
  cancelLabel: string;
  entryNames: readonly string[];
  pinnedSelectedCount: number;
  deleteMode: WorkspaceEntryDeleteMode | null;
  unsavedCount: number;
  busy?: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onUnpin: () => void;
  onRequestDelete?: () => void;
  onDelete: (mode: WorkspaceEntryDeleteMode) => Promise<void>;
  onExit: () => void;
}

export function SidebarSelectionActions({
  t, cancelLabel, entryNames, pinnedSelectedCount, deleteMode, unsavedCount, busy = false,
  onExpandAll, onCollapseAll, onUnpin, onDelete, onRequestDelete, onExit,
}: SidebarSelectionActionsProps) {
  const [dialog, setDialog] = useState<'unpin' | 'delete' | null>(null);
  const s = t.sidebar;
  const count = entryNames.length;
  const unpinLabel = fillTemplate(s.unpinSelected, { count: pinnedSelectedCount });
  const deleteLabel = fillTemplate(s.deleteSelected, { count });

  return (
    <>
      <div className="sidebar__files-actions sidebar__files-actions--selection" role="toolbar" aria-label={s.selectMode} aria-busy={busy || undefined}>
        <div className="sidebar__files-action-group">
          <TooltipButton type="button" className="btn btn--icon sidebar__files-action" onClick={onExpandAll} tooltip={s.expandAllFolders} label={s.expandAllFolders} tooltipPos="below" tooltipAlign="left" icon={<ExpandIcon size={13} />} />
          <TooltipButton type="button" className="btn btn--icon sidebar__files-action" onClick={onCollapseAll} tooltip={s.collapseAllFolders} label={s.collapseAllFolders} tooltipPos="below" icon={<CollapseIcon size={13} />} />
          <TooltipButton type="button" className="btn btn--icon sidebar__files-action sidebar__files-action--unpin-selected" onClick={() => setDialog('unpin')} tooltip={unpinLabel} label={unpinLabel} tooltipPos="below" icon={<UnpinIcon size={14} />} disabled={busy || pinnedSelectedCount === 0} />
          {deleteMode && (
            <TooltipButton type="button" className="btn btn--icon sidebar__files-action sidebar__files-action--delete-selected" onClick={() => { if (onRequestDelete) onRequestDelete(); else setDialog('delete'); }} tooltip={deleteLabel} label={deleteLabel} tooltipPos="below" icon={<TrashIcon size={14} />} disabled={busy || count === 0} />
          )}
        </div>
        <span className="sidebar__selection-count" aria-live="polite">{count}</span>
        <TooltipButton type="button" className="btn btn--icon sidebar__files-action sidebar__files-action--exit-selection" onClick={onExit} tooltip={s.exitSelectMode} label={s.exitSelectMode} tooltipPos="below" tooltipAlign="right" icon={<CloseIcon size={13} />} />
      </div>
      {dialog === 'unpin' && pinnedSelectedCount > 0 && (
        <SidebarConfirmDialog
          title={unpinLabel}
          message={fillTemplate(s.unpinSelectedConfirmBody, { count: pinnedSelectedCount })}
          cancelLabel={cancelLabel}
          onCancel={() => setDialog(null)}
          onConfirm={() => { setDialog(null); onUnpin(); }}
        />
      )}
      {dialog === 'delete' && deleteMode && count > 0 && (
        <SidebarDeleteDialog
          t={t} entryNames={entryNames} deleteMode={deleteMode} unsavedCount={unsavedCount} cancelLabel={cancelLabel}
          onCancel={() => setDialog(null)}
          onConfirm={(mode) => { setDialog(null); void onDelete(mode); }}
        />
      )}
    </>
  );
}
