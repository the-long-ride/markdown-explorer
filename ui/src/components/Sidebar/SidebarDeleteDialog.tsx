import { useState } from 'react';
import type { Translations } from '../../contexts/translations';
import type { WorkspaceEntryDeleteMode } from '../../types';
import { fillTemplate } from '../../workspace/workspaceEntryMessages';
import { SelectionCheckbox } from '../shared/SelectionCheckbox';
import { SidebarConfirmDialog } from './SidebarConfirmDialog';

interface Props {
  t: Translations; cancelLabel: string; entryNames: readonly string[];
  deleteMode: WorkspaceEntryDeleteMode; unsavedCount: number;
  onCancel: () => void; onConfirm: (mode: WorkspaceEntryDeleteMode) => void;
}

export function SidebarDeleteDialog({ t, cancelLabel, entryNames, deleteMode, unsavedCount, onCancel, onConfirm }: Props) {
  const [permanent, setPermanent] = useState(deleteMode === 'permanent');
  const s = t.sidebar;
  const count = entryNames.length;
  const mode = permanent ? 'permanent' : 'trash';
  return <SidebarConfirmDialog
    variant="destructive"
    title={fillTemplate(permanent ? s.deletePermanentTitle : s.deleteTrashTitle, { count })}
    message={permanent ? s.deletePermanentBody : s.deleteTrashBody}
    items={entryNames.slice(0, 5)}
    moreLabel={count > 5 ? fillTemplate(s.deleteMore, { count: count - 5 }) : undefined}
    warning={unsavedCount > 0 ? fillTemplate(s.deleteUnsavedWarning, { count: unsavedCount }) : undefined}
    confirmLabel={permanent ? s.deletePermanentConfirm : s.deleteTrashConfirm}
    cancelLabel={cancelLabel}
    onCancel={onCancel}
    onConfirm={() => onConfirm(mode)}
    options={<label className="sidebar-delete-dialog__permanent">
      <SelectionCheckbox checked={permanent} disabled={deleteMode === 'permanent'} label={s.permanentlyDelete} onChange={setPermanent} />
      <span>{s.permanentlyDelete}</span>
    </label>}
  />;
}
