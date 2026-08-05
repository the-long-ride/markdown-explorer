import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getMermaidBookmarkDefaultName } from '../../bookmarks/bookmarkDefaultName.ts';
import { saveBookmarkCapture } from '../../bookmarks/bookmarkCommands.ts';
import type { BookmarkObjectIdentity, BookmarkTargetKind } from '../../bookmarks/types.ts';
import type { Translations } from '../../contexts/translations.ts';
import { dispatchActionNotice } from '../../utils/actionNotice.ts';
import { useCssVars } from '../../utils/useCssVars.ts';
import { BookmarkDialog } from './BookmarkDialog.tsx';
import { AddBookmarkIcon } from './BookmarkIcons.tsx';

export interface BookmarkSelectionState {
  readonly x: number;
  readonly y: number;
  readonly documentText: string;
  readonly targetKind: BookmarkTargetKind;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly renderedText: string;
  readonly objectIdentity?: BookmarkObjectIdentity;
  readonly presentation: 'menu' | 'dialog';
}

interface BookmarkSelectionMenuProps {
  state: BookmarkSelectionState | null;
  workspaceName: string;
  workspacePath?: string;
  filePath: string | null;
  translations: Translations['bookmarks'];
  onClose: () => void;
}

function failureMessage(template: string, reason: string): string {
  return template.includes('{reason}')
    ? template.replace('{reason}', reason)
    : `${template} ${reason}`.trim();
}

export function BookmarkSelectionMenu({ state, workspaceName, workspacePath, filePath, translations, onClose }: BookmarkSelectionMenuProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const isDialogOpen = state?.presentation === 'dialog' || dialogOpen;
  const menuRef = useRef<HTMLDivElement>(null);
  const menuCssVariables = useMemo(() => ({
    '--link-context-menu-left': `${state?.x ?? 0}px`,
    '--link-context-menu-top': `${state?.y ?? 0}px`,
  }), [state?.x, state?.y]);
  useCssVars(menuRef, menuCssVariables);

  useEffect(() => setDialogOpen(false), [state]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!state || isDialogOpen || !menu) return;
    const rect = menu.getBoundingClientRect();
    menu.style.setProperty('--link-context-menu-left', `${Math.max(8, Math.min(state.x, window.innerWidth - rect.width - 8))}px`);
    menu.style.setProperty('--link-context-menu-top', `${Math.max(8, Math.min(state.y, window.innerHeight - rect.height - 8))}px`);
    menu.querySelector<HTMLButtonElement>('button')?.focus();
  }, [isDialogOpen, state]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!state || isDialogOpen || !menu) return;
    const close = (event: Event) => {
      if (event.type === 'pointerdown' && menu.contains(event.target as Node)) return;
      onClose();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', close, true);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('resize', close, true);
      window.removeEventListener('scroll', close, true);
    };
  }, [isDialogOpen, onClose, state]);

  if (!state || !filePath) return null;
  const mermaidName = state.targetKind === 'mermaid'
    ? getMermaidBookmarkDefaultName(state.objectIdentity?.mermaidSource ?? state.renderedText)
    : '';
  const defaultName = (mermaidName || state.renderedText).replace(/\s+/g, ' ').trim().slice(0, 80);

  const save = (name: string) => {
    const result = saveBookmarkCapture({
      name,
      workspaceName,
      workspacePath,
      filePath,
      documentText: state.documentText,
      targetKind: state.targetKind,
      sourceStart: state.sourceStart,
      sourceEnd: state.sourceEnd,
      renderedText: state.renderedText,
      objectIdentity: state.objectIdentity,
    });
    if (!result.ok) {
      const reason = result.reason === 'target-unavailable'
        ? translations.targetUnavailable
        : translations.storageUnavailable;
      dispatchActionNotice(failureMessage(translations.saveFailed, reason), 'error');
      return;
    }
    dispatchActionNotice(translations.savedSuccess, 'success');
    onClose();
  };

  return createPortal(
    <>
      {!isDialogOpen && (
        <div ref={menuRef} className="mdn-link-context-menu bookmark-selection-menu" role="menu" aria-label={translations.menuLabel}>
          <button type="button" role="menuitem" onClick={() => setDialogOpen(true)}>
            <AddBookmarkIcon size={14} />
            <span>{translations.addSelection}</span>
          </button>
        </div>
      )}
      <BookmarkDialog
        open={isDialogOpen}
        title={translations.dialogAddTitle}
        label={translations.nameLabel}
        placeholder={translations.namePlaceholder}
        initialValue={defaultName}
        saveLabel={translations.save}
        cancelLabel={translations.cancel}
        onClose={onClose}
        onSave={save}
      />
    </>,
    document.body,
  );
}
