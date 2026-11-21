import { useEffect, useLayoutEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, keymap } from '@codemirror/view';
import {
  defaultKeymap, history, historyKeymap, indentWithTab,
  redo, redoDepth, undo, undoDepth,
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { markdownCustomLanguageExtension, markdownHighlighting } from '../../editor/markdownHighlight';
import { createTableVisualExtension } from '../../editor/tableVisualPlugin';
import { formatFocusedTableCell } from '../../editor/tableCellEditing';
import { applyMarkdownFormat, type MarkdownFormatCommand } from '../../editor/markdownFormatting';

export interface InlineTableEditorHandle {
  runFormat: (command: MarkdownFormatCommand) => void;
  commitPendingEdit: () => void;
  getCurrentDoc: () => string;
  replaceDoc: (nextText: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export interface InlineTableEditorProps {
  readonly initialSource: string;
  readonly language?: string;
  readonly wordWrap: boolean;
  readonly fontSize?: number;
  readonly ariaLabel: string;
  readonly onChange: (nextSource: string) => void;
  readonly onApply: () => void;
  readonly onCancel: () => void;
  readonly onSaveShortcut?: () => void;
  readonly onHistoryChange?: (history: { canUndo: boolean; canRedo: boolean }) => void;
  readonly editorRef?: React.MutableRefObject<InlineTableEditorHandle | null>;
}

export function InlineTableEditor({
  initialSource,
  language = 'en',
  wordWrap,
  fontSize,
  ariaLabel,
  onChange,
  onApply,
  onCancel,
  onSaveShortcut,
  onHistoryChange,
  editorRef,
}: InlineTableEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const wrapCompartmentRef = useRef(new Compartment());
  const languageRef = useRef(language);
  const onApplyRef = useRef(onApply);
  const onCancelRef = useRef(onCancel);
  const onSaveShortcutRef = useRef(onSaveShortcut);
  const onChangeRef = useRef(onChange);
  const onHistoryChangeRef = useRef(onHistoryChange);

  languageRef.current = language;
  onApplyRef.current = onApply;
  onCancelRef.current = onCancel;
  onSaveShortcutRef.current = onSaveShortcut;
  onChangeRef.current = onChange;
  onHistoryChangeRef.current = onHistoryChange;

  const refreshHistoryState = (view: EditorView) => {
    if (!onHistoryChangeRef.current) return;
    const canUndo = undoDepth(view.state) > 0 && undo({ state: view.state, dispatch: () => {} });
    const canRedo = redoDepth(view.state) > 0 && redo({ state: view.state, dispatch: () => {} });
    onHistoryChangeRef.current({ canUndo: Boolean(canUndo), canRedo: Boolean(canRedo) });
  };

  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = {
      runFormat: (command: MarkdownFormatCommand) => {
        if (formatFocusedTableCell(hostRef.current, command)) return;
        const view = viewRef.current;
        if (!view) return;
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
      },
      commitPendingEdit: () => {
        if (document.activeElement?.classList.contains('cm-table-cell')) {
          (document.activeElement as HTMLElement).blur();
        }
      },
      getCurrentDoc: () => {
        return viewRef.current?.state.doc.toString() ?? '';
      },
      replaceDoc: (nextText: string) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: nextText },
          scrollIntoView: true,
        });
      },
      undo: () => {
        const view = viewRef.current;
        if (!view) return;
        if (document.activeElement?.classList.contains('cm-table-cell')) {
          (document.activeElement as HTMLElement).blur();
        }
        undo(view);
        refreshHistoryState(view);
      },
      redo: () => {
        const view = viewRef.current;
        if (!view) return;
        if (document.activeElement?.classList.contains('cm-table-cell')) {
          (document.activeElement as HTMLElement).blur();
        }
        redo(view);
        refreshHistoryState(view);
      },
      canUndo: () => {
        const view = viewRef.current;
        if (!view) return false;
        return undoDepth(view.state) > 0 && undo({ state: view.state, dispatch: () => {} });
      },
      canRedo: () => {
        const view = viewRef.current;
        if (!view) return false;
        return redoDepth(view.state) > 0 && redo({ state: view.state, dispatch: () => {} });
      },
    };
    return () => {
      if (editorRef) editorRef.current = null;
    };
  }, [editorRef]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || viewRef.current) return undefined;

    const customKeymap = [
      { key: 'Mod-Enter', run: () => { onApplyRef.current(); return true; } },
      { key: 'Mod-s', run: () => { onApplyRef.current(); onSaveShortcutRef.current?.(); return true; } },
      { key: 'Escape', run: () => { onCancelRef.current(); return true; } },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ];

    const state = EditorState.create({
      doc: initialSource,
      extensions: [
        history(),
        markdown({ extensions: [markdownCustomLanguageExtension] }),
        markdownHighlighting,
        createTableVisualExtension(() => languageRef.current),
        EditorState.allowMultipleSelections.of(true),
        drawSelection(),
        wrapCompartmentRef.current.of(wordWrap ? EditorView.lineWrapping : []),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
        keymap.of(customKeymap),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
          refreshHistoryState(update.view);
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    refreshHistoryState(view);

    let contentObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      contentObserver = new ResizeObserver(() => {
        if (viewRef.current) {
          viewRef.current.requestMeasure();
        }
      });
      contentObserver.observe(view.contentDOM);
    }

    const firstCell = host.querySelector<HTMLElement>('.cm-table-cell');
    if (firstCell) {
      firstCell.focus({ preventScroll: true });
    } else {
      view.focus();
    }

    return () => {
      contentObserver?.disconnect();
      view.destroy();
      viewRef.current = null;
    };
  }, [initialSource, ariaLabel]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      view.requestMeasure();
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        (view as unknown as { measure?: (flush?: boolean) => void }).measure?.(false);
      }
    } catch {
      // Ignored in non-DOM/test environments
    }
  }, [fontSize]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wrapCompartmentRef.current.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
  }, [wordWrap]);

  return <div ref={hostRef} className="markdown-inline-editor__table-host" />;
}
