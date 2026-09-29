import type { EditorUiTranslations } from '../../contexts/editorUiTranslations';
import { isDocumentDirty, type EditableDocumentSession, type MarkdownEditMode } from '../../editor/documentSession';
import { FloppyDiskIcon, PlainSourceIcon, RenderedViewIcon } from '../Content/MarkdownEditingIcons';
import { EditIcon } from './icons';
import { TooltipButton } from './TooltipButton';

interface MarkdownEditingHeaderActionsProps {
  filePath: string;
  session: EditableDocumentSession;
  labels: EditorUiTranslations;
  saveShortcut?: string;
  onModeChange: (filePath: string, mode: MarkdownEditMode) => void;
  onSave: (filePath: string) => void | Promise<unknown>;
}

export function MarkdownEditingHeaderActions({
  filePath, session, labels, saveShortcut, onModeChange, onSave,
}: MarkdownEditingHeaderActionsProps) {
  const canSave = session.saveState !== 'saving' && isDocumentDirty(session);

  return (
    <div className="topbar__markdown-editing" role="group" aria-label={labels.modeGroup}>
      <TooltipButton type="button" className="topbar__markdown-mode-btn" tooltip={labels.rendered} aria-pressed={session.mode === 'rendered'} icon={<RenderedViewIcon size={14} />} onClick={() => onModeChange(filePath, 'rendered')} />
      <TooltipButton type="button" className="topbar__markdown-mode-btn" tooltip={labels.inlineEdit} aria-pressed={session.mode === 'inline-edit'} icon={<EditIcon size={13} />} onClick={() => onModeChange(filePath, 'inline-edit')} />
      <TooltipButton type="button" className="topbar__markdown-mode-btn" tooltip={labels.plain} aria-pressed={session.mode === 'plain'} icon={<PlainSourceIcon size={14} />} onClick={() => onModeChange(filePath, 'plain')} />
      <TooltipButton type="button" className={`topbar__markdown-save-btn${canSave ? ' is-dirty' : ''}${session.saveState === 'saving' ? ' is-saving' : ''}`} tooltip={labels.save} shortcut={saveShortcut} disabled={!canSave} aria-busy={session.saveState === 'saving'} icon={<FloppyDiskIcon size={14} />} onClick={() => void onSave(filePath)} />
    </div>
  );
}
