import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView, crosshairCursor, drawSelection, keymap, lineNumbers, rectangularSelection,
} from '@codemirror/view';
import {
  addCursorAbove, addCursorBelow, cursorGroupLeft, cursorGroupRight,
  defaultKeymap, history, historyKeymap, indentWithTab,
  redo, redoDepth, selectGroupLeft, selectGroupRight, undo, undoDepth,
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { AppStateContext } from '../../contexts/AppStateContext';
import {
  clampEditorFontSize, countWords, fillTemplate, fontSizeActionForChord, formatCommandForChord,
  getInitialEditorFontSize, getInitialEditorWordWrap, persistEditorFontSize, persistEditorWordWrap,
  EDITOR_FONT_SIZE_EVENT, EDITOR_FONT_SIZE_STORAGE_KEY,
} from '../../editor/editorUx';
import { applyMarkdownFormat, applyMarkdownLink, parseMarkdownLinkSelection, type MarkdownFormatCommand } from '../../editor/markdownFormatting';
import { getEditorSession, setEditorSession } from '../../editor/editorSessionStore';
import { markdownCustomLanguageExtension, markdownHighlighting } from '../../editor/markdownHighlight';
import { buildCustomTable } from '../../editor/tableEditor';
import { createTableVisualExtension } from '../../editor/tableVisualPlugin';
import { MarkdownFormattingToolbar, type MarkdownEditorActions } from './MarkdownFormattingToolbar';
import { TableInsertDialog } from './TableInsertDialog';
import { LinkInsertDialog } from './LinkInsertDialog';

interface MarkdownSourceEditorProps {
  sessionKey?: string;
  value: string;
  disabled: boolean;
  ariaLabel: string;
  language: string;
  /** Whether the working source differs from disk. Omit to hide the save-state chip. */
  dirty?: boolean;
  keybindings?: Readonly<Record<string, string>>;
  disabledKeybindings?: Readonly<Record<string, boolean>>;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
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
  sessionKey,
  value,
  disabled,
  ariaLabel,
  language,
  dirty,
  keybindings,
  disabledKeybindings,
  fontSize: controlledFontSize,
  onFontSizeChange,
  onChange,
  onSave,
  onPreview,
}: MarkdownSourceEditorProps) {
  const appState = useContext(AppStateContext);
  const effectiveKeybindings = keybindings ?? appState?.state.settings.keybindings;
  const effectiveDisabledKeybindings = disabledKeybindings ?? appState?.state.settings.disabledKeybindings;

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editableCompartmentRef = useRef(new Compartment());
  const wrapCompartmentRef = useRef(new Compartment());
  const [wordWrap, setWordWrap] = useState(getInitialEditorWordWrap);
  const [internalFontSize, setInternalFontSize] = useState(getInitialEditorFontSize);
  const fontSize = controlledFontSize ?? internalFontSize;
  const syncingRef = useRef(false);
  const disabledRef = useRef(disabled);
  const keybindingsRef = useRef(effectiveKeybindings);
  const disabledKeybindingsRef = useRef(effectiveDisabledKeybindings);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 });
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [linkDialogState, setLinkDialogState] = useState({ open: false, initialText: '', initialUrl: '' });
  const labels = getEditorUiTranslations(language);

  disabledRef.current = disabled;
  keybindingsRef.current = effectiveKeybindings;
  disabledKeybindingsRef.current = effectiveDisabledKeybindings;
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  useEffect(() => {
    const onCustom = (e: Event) => {
      const d = (e as CustomEvent<number>).detail;
      if (typeof d === 'number') setInternalFontSize(clampEditorFontSize(d));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === EDITOR_FONT_SIZE_STORAGE_KEY && e.newValue) {
        setInternalFontSize(clampEditorFontSize(Number(e.newValue)));
      }
    };
    window.addEventListener(EDITOR_FONT_SIZE_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EDITOR_FONT_SIZE_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const handleInsertTable = (rows: number, cols: number) => {
    const view = viewRef.current;
    if (!view || disabledRef.current) return;
    const selection = view.state.selection.main;
    const tableText = buildCustomTable(rows, cols);
    const doc = view.state.doc;
    const line = doc.lineAt(selection.from);
    const prefix = line.from === selection.from ? '' : '\n\n';
    const suffix = selection.to === line.to ? '\n' : '\n\n';
    const insertText = `${prefix}${tableText}${suffix}`;
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: insertText },
      selection: { anchor: selection.from + prefix.length + tableText.length },
      scrollIntoView: true,
    });
    view.focus();
  };

  const toggleWordWrap = () => {
    setWordWrap((prev) => {
      const next = !prev;
      persistEditorWordWrap(next);
      return next;
    });
  };

  const handleChangeFontSize = (value: number, isDelta = false) => {
    setInternalFontSize((prev) => {
      const base = controlledFontSize ?? prev;
      const next = clampEditorFontSize(isDelta ? base + value : value);
      if (onFontSizeChange) onFontSizeChange(next);
      persistEditorFontSize(next);
      return next;
    });
  };

  const refreshHistoryState = (view: EditorView) => {
    const next = {
      canUndo: undoDepth(view.state) > 0 && undo({ state: view.state, dispatch: () => {} }),
      canRedo: redoDepth(view.state) > 0 && redo({ state: view.state, dispatch: () => {} }),
    };
    setHistoryState((current) => current.canUndo === next.canUndo && current.canRedo === next.canRedo ? current : next);
  };

  const refreshCursor = (view: EditorView) => {
    const next = cursorOf(view);
    setCursor((current) => current.line === next.line && current.column === next.column ? current : next);
  };

  const openLinkDialog = () => {
    const view = viewRef.current;
    if (!view || disabledRef.current) return;
    const sel = view.state.selection.main;
    const parsed = parseMarkdownLinkSelection(view.state.sliceDoc(sel.from, sel.to));
    setLinkDialogState({ open: true, initialText: parsed.label, initialUrl: parsed.url });
  };

  const handleInsertLink = (url: string, text: string) => {
    const view = viewRef.current;
    if (!view || disabledRef.current) return;
    const sel = view.state.selection.main;
    const result = applyMarkdownLink(view.state.doc.toString(), { from: sel.from, to: sel.to }, url, text);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: result.source },
      selection: { anchor: result.selection.from, head: result.selection.to },
      scrollIntoView: true,
    });
    view.focus();
  };

  const formatCurrent = (command: MarkdownFormatCommand): boolean => {
    if (command === 'link') {
      openLinkDialog();
      return true;
    }
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

  const createEditorState = (
    initialDoc: string,
    compartment: Compartment,
    wrapCompartment: Compartment,
    isWrapping: boolean,
  ): EditorState => {
    const customKeymap = [
      { key: 'Mod-s', run: () => { if (!disabledRef.current) onSaveRef.current(); return true; } },
      { key: 'Mod-ArrowLeft', run: cursorGroupLeft, shift: selectGroupLeft },
      { key: 'Mod-ArrowRight', run: cursorGroupRight, shift: selectGroupRight },
      { key: 'Mod-Alt-ArrowUp', run: addCursorAbove }, { key: 'Mod-Alt-ArrowDown', run: addCursorBelow },
      { key: 'Shift-Alt-ArrowUp', run: addCursorAbove }, { key: 'Shift-Alt-ArrowDown', run: addCursorBelow },
      indentWithTab, ...defaultKeymap, ...historyKeymap,
    ];
    return EditorState.create({
      doc: initialDoc,
      extensions: [
        lineNumbers(),
        history(),
        markdown({ extensions: [markdownCustomLanguageExtension] }),
        markdownHighlighting,
        createTableVisualExtension(() => language),
        EditorState.allowMultipleSelections.of(true),
        drawSelection(),
        rectangularSelection({ eventFilter: (e) => e.altKey && e.button === 0 }),
        crosshairCursor(),
        wrapCompartment.of(isWrapping ? EditorView.lineWrapping : []),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
        compartment.of(EditorView.editable.of(!disabledRef.current)),
        EditorView.domEventHandlers({
          keydown: (event) => {
            if (disabledRef.current) return false;
            const fontAction = fontSizeActionForChord(event, keybindingsRef.current, disabledKeybindingsRef.current);
            if (fontAction) {
              event.preventDefault();
              handleChangeFontSize(fontAction === 'increase' ? 1 : -1, true);
              return true;
            }
            const cmd = formatCommandForChord(event, keybindingsRef.current, disabledKeybindingsRef.current);
            if (!cmd) return false;
            event.preventDefault();
            if (cmd === 'link') {
              openLinkDialog();
              return true;
            }
            return formatCurrent(cmd);
          },
        }),
        keymap.of(customKeymap),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncingRef.current) onChangeRef.current(update.state.doc.toString());
          if (update.docChanged || update.selectionSet) refreshCursor(update.view);
          refreshHistoryState(update.view);
        }),
      ],
    });
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || viewRef.current) return undefined;

    const cached = sessionKey ? getEditorSession(sessionKey) : undefined;
    let state: EditorState;
    let editableCompartment: Compartment;

    if (cached && cached.state.doc.toString() === value) {
      state = cached.state;
      editableCompartment = cached.editableCompartment;
      editableCompartmentRef.current = editableCompartment;
      if (cached.wrapCompartment) wrapCompartmentRef.current = cached.wrapCompartment;
    } else {
      editableCompartment = editableCompartmentRef.current;
      state = createEditorState(value, editableCompartment, wrapCompartmentRef.current, wordWrap);
    }

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    if (cached?.scroll) {
      view.scrollDOM.scrollTop = cached.scroll.top;
      view.scrollDOM.scrollLeft = cached.scroll.left;
    }
    refreshHistoryState(view);
    refreshCursor(view);

    let contentObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      contentObserver = new ResizeObserver(() => {
        if (viewRef.current) {
          viewRef.current.requestMeasure();
        }
      });
      contentObserver.observe(view.contentDOM);
    }

    return () => {
      contentObserver?.disconnect();
      if (sessionKey) {
        setEditorSession(sessionKey, {
          state: view.state,
          editableCompartment,
          wrapCompartment: wrapCompartmentRef.current,
          scroll: {
            top: view.scrollDOM.scrollTop,
            left: view.scrollDOM.scrollLeft,
          },
        });
      }
      view.destroy();
      viewRef.current = null;
    };
  // CodeMirror owns its instance lifecycle; value/disabled changes are synchronized below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!view || view.state.doc.toString() === value) return;
    const newState = createEditorState(value, editableCompartmentRef.current, wrapCompartmentRef.current, wordWrap);
    view.setState(newState);
    refreshHistoryState(view);
    refreshCursor(view);
  }, [value, wordWrap]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wrapCompartmentRef.current.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
  }, [wordWrap]);

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
        refreshHistoryState(view);
        view.focus();
      }
    },
    redo: () => {
      const view = viewRef.current;
      if (view && !disabledRef.current) {
        redo(view);
        refreshHistoryState(view);
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
    <div
      className={`markdown-source-editor${disabled ? ' is-disabled' : ''}`}
      data-editor-font-size={fontSize}
      data-testid="markdown-source-editor"
    >
      <MarkdownFormattingToolbar
        actions={actions} labels={labels.formatting} disabled={disabled}
        keybindings={effectiveKeybindings} disabledKeybindings={effectiveDisabledKeybindings}
        onPreview={onPreview} wrapText={wordWrap} onToggleWrapText={toggleWordWrap}
        fontSize={fontSize} onChangeFontSize={handleChangeFontSize}
        onOpenTableDialog={() => setTableDialogOpen(true)} onOpenLinkDialog={openLinkDialog}
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
      <TableInsertDialog open={tableDialogOpen} language={language} onInsert={handleInsertTable} onClose={() => setTableDialogOpen(false)} />
      <LinkInsertDialog open={linkDialogState.open} language={language} initialText={linkDialogState.initialText} initialUrl={linkDialogState.initialUrl} onInsert={handleInsertLink} onClose={() => setLinkDialogState((prev) => ({ ...prev, open: false }))} />
    </div>
  );
}
