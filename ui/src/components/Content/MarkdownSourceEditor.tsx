import { useEffect, useMemo, useRef, useState } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { countWords, fillTemplate } from '../../editor/editorUx';
import { applyMarkdownFormat, type MarkdownFormatCommand } from '../../editor/markdownFormatting';
import { markdownHighlighting } from '../../editor/markdownHighlight';
import { MarkdownFormattingToolbar, type MarkdownEditorActions } from './MarkdownFormattingToolbar';

interface MarkdownSourceEditorProps {
  value: string;
  disabled: boolean;
  ariaLabel: string;
  language: string;
  /** Whether the working source differs from disk. Omit to hide the save-state chip. */
  dirty?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onPreview: () => void;
}

interface CursorPosition {
  readonly line: number;
  readonly column: number;
}

function cursorOf(view: EditorView): CursorPosition {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  return { line: line.number, column: head - line.from + 1 };
}

export function MarkdownSourceEditor({
  value,
  disabled,
  ariaLabel,
  language,
  dirty,
  onChange,
  onSave,
  onPreview,
}: MarkdownSourceEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editableCompartmentRef = useRef(new Compartment());
  const syncingRef = useRef(false);
  const disabledRef = useRef(disabled);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 });
  const labels = getEditorUiTranslations(language);

  disabledRef.current = disabled;
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  const refreshHistoryState = (view: EditorView) => {
    const next = { canUndo: undoDepth(view.state) > 0, canRedo: redoDepth(view.state) > 0 };
    setHistoryState((current) => current.canUndo === next.canUndo && current.canRedo === next.canRedo ? current : next);
  };

  const refreshCursor = (view: EditorView) => {
    const next = cursorOf(view);
    setCursor((current) => current.line === next.line && current.column === next.column ? current : next);
  };

  const formatCurrent = (command: MarkdownFormatCommand): boolean => {
    const view = viewRef.current;
    if (!view || disabledRef.current) return false;
    const selection = view.state.selection.main;
    const result = applyMarkdownFormat(
      view.state.doc.toString(),
      { from: selection.from, to: selection.to },
      command,
    );
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: result.source },
      selection: { anchor: result.selection.from, head: result.selection.to },
      scrollIntoView: true,
    });
    view.focus();
    return true;
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || viewRef.current) return undefined;
    const editableCompartment = editableCompartmentRef.current;
    const customKeymap = [
      { key: 'Mod-s', run: () => { if (!disabledRef.current) onSaveRef.current(); return true; } },
      { key: 'Mod-b', run: () => formatCurrent('bold') },
      { key: 'Mod-i', run: () => formatCurrent('italic') },
      { key: 'Mod-k', run: () => formatCurrent('link') },
      { key: 'Mod-e', run: () => formatCurrent('inline-code') },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ];
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        markdown(),
        markdownHighlighting,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
        editableCompartment.of(EditorView.editable.of(!disabled)),
        keymap.of(customKeymap),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncingRef.current) onChangeRef.current(update.state.doc.toString());
          if (update.docChanged || update.selectionSet) refreshCursor(update.view);
          if (update.docChanged || update.transactions.some((transaction) => transaction.effects.length > 0)) {
            refreshHistoryState(update.view);
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    refreshHistoryState(view);
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  // CodeMirror owns its instance lifecycle; value/disabled changes are synchronized below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    syncingRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: { anchor: Math.min(view.state.selection.main.head, value.length) },
    });
    syncingRef.current = false;
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: editableCompartmentRef.current.reconfigure(EditorView.editable.of(!disabled)) });
  }, [disabled]);

  const actions = useMemo<MarkdownEditorActions>(() => ({
    format: (command) => { formatCurrent(command); },
    undo: () => {
      const view = viewRef.current;
      if (view && !disabledRef.current) {
        undo(view);
        view.focus();
      }
    },
    redo: () => {
      const view = viewRef.current;
      if (view && !disabledRef.current) {
        redo(view);
        view.focus();
      }
    },
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
  // `formatCurrent` intentionally reads the latest editor refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [historyState.canRedo, historyState.canUndo]);

  const stats = useMemo(() => ({ words: countWords(value), characters: value.length }), [value]);
  const saveState = disabled ? 'saving' : dirty === undefined ? null : dirty ? 'dirty' : 'saved';
  const saveStateLabel = saveState === 'saving' ? labels.saving
    : saveState === 'dirty' ? labels.unsavedChanges
    : saveState === 'saved' ? labels.saved
    : null;

  return (
    <div className={`markdown-source-editor${disabled ? ' is-disabled' : ''}`} data-testid="markdown-source-editor">
      <MarkdownFormattingToolbar
        actions={actions}
        labels={labels.formatting}
        disabled={disabled}
        onPreview={onPreview}
      />
      <div ref={hostRef} className="markdown-source-editor__host" />
      <div className="markdown-source-editor__status" data-testid="markdown-source-editor-status">
        <span>{fillTemplate(labels.statusLine, { line: cursor.line, column: cursor.column })}</span>
        <span>{fillTemplate(labels.statusWords, { count: stats.words })}</span>
        <span>{fillTemplate(labels.statusCharacters, { count: stats.characters })}</span>
        <span className="markdown-source-editor__status-spacer" aria-hidden="true" />
        {saveStateLabel && (
          <span className={`markdown-source-editor__state is-${saveState}`}>{saveStateLabel}</span>
        )}
      </div>
    </div>
  );
}
