import { useLayoutEffect, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { editorModKeyLabel } from '../../editor/editorUx';
import type { DocumentViewMode } from '../../split-view/paneState';
import type { DocumentBodyPlainSession, DocumentBodyProps } from './DocumentBody';
import { InlineMarkdownEditor } from './InlineMarkdownEditor';
import { useInlineMarkdownEditing } from './useInlineMarkdownEditing';

export interface DocumentEditingSurfaceOptions {
  readonly filePath: string | null;
  readonly mode: DocumentViewMode | undefined;
  /** Working Markdown source; only meaningful when `hasSession` is true. */
  readonly source: string;
  /** False while there is no editable document session (editing is then inert). */
  readonly hasSession: boolean;
  /** True while another view (history revision or diff) replaces the document body. */
  readonly suspended?: boolean;
  readonly bodyRef: RefObject<HTMLElement | null>;
  readonly renderVersion: number;
  readonly language: string | undefined;
  readonly saving: boolean;
  readonly dirty?: boolean;
  readonly onSourceChange: (source: string) => void;
  readonly onSave: () => void | Promise<unknown>;
  readonly onPreview: () => void;
}

export interface DocumentEditingSurface {
  readonly isPlainMode: boolean;
  /** The floating inline editor for the active block, or null when none is open. */
  readonly inlineEditor: ReactNode;
  /** Editing related props that both the main view and split panes pass to `DocumentBody`. */
  readonly bodyProps: Pick<DocumentBodyProps, 'plainSession' | 'onSourceChange' | 'onSave' | 'onPreview'>;
}

// One place for the editing wiring shared by the main document view and every
// split pane: inline block editing, the deferred save that follows an
// apply-and-save shortcut, the plain-source session and the editor labels.
export function useDocumentEditingSurface({
  filePath, mode, source, hasSession, suspended = false, bodyRef, renderVersion, language, saving, dirty,
  onSourceChange, onSave, onPreview,
}: DocumentEditingSurfaceOptions): DocumentEditingSurface {
  const editorT = getEditorUiTranslations(language);
  const active = hasSession && !suspended;
  const isPlainMode = active && mode === 'plain';
  const inlineEnabled = active && mode === 'inline-edit';
  const inlineEditing = useInlineMarkdownEditing({
    enabled: inlineEnabled, bodyRef, source, renderVersion, filePath, editLabel: editorT.editBlock, onSourceChange,
  });

  // A source-change dispatch and this token bump batch into one React commit, so
  // the save effect runs after that commit and reads the latest `onSave` (bound to
  // the freshly edited source) rather than a closure created before the edit.
  const onSaveRef = useRef(onSave);
  useLayoutEffect(() => { onSaveRef.current = onSave; });
  const [saveToken, setSaveToken] = useState(0);
  useEffect(() => {
    if (saveToken === 0) return;
    void onSaveRef.current();
  }, [saveToken]);

  const inlineEditor = inlineEnabled && inlineEditing.activeTarget ? (
    <InlineMarkdownEditor
      target={inlineEditing.activeTarget}
      source={source}
      labels={{
        sourceLabel: editorT.inlineSourceLabel,
        apply: editorT.apply,
        cancel: editorT.cancel,
        hint: editorT.inlineHint.replace('{mod}', editorModKeyLabel()),
        toggleToolbar: editorT.toggleFormattingToolbar,
        formatting: editorT.formatting,
      }}
      onApply={inlineEditing.apply}
      onCancel={inlineEditing.cancel}
      onSaveShortcut={() => setSaveToken((token) => token + 1)}
    />
  ) : null;

  const plainSession: DocumentBodyPlainSession | null = isPlainMode
    ? { source, saving, plainSourceLabel: editorT.plainSourceLabel, ...(dirty === undefined ? {} : { dirty }) }
    : null;

  return {
    isPlainMode,
    inlineEditor,
    bodyProps: { plainSession, onSourceChange, onSave: () => { void onSave(); }, onPreview },
  };
}
