import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  clampEditorFontSize,
  EDITOR_FONT_SIZE_EVENT,
  EDITOR_FONT_SIZE_STORAGE_KEY,
  fontSizeActionForChord,
  formatCommandForChord,
  getInitialEditorFontSize,
  getInitialEditorWordWrap,
  isApplePlatform,
  isRedoChord,
  isUndoChord,
  persistEditorFontSize,
  persistEditorWordWrap,
} from '../../editor/editorUx';
import {
  anchorFor,
  isTableTarget,
  readEditableRange,
  rowsFor,
  type MarkdownSourceRange,
} from '../../editor/inlineEdit';
import { applyMarkdownFormat, applyMarkdownLink, parseMarkdownLinkSelection, type MarkdownFormatCommand, type MarkdownSelection } from '../../editor/markdownFormatting';
import { buildCustomTable } from '../../editor/tableEditor';
import { TableInsertDialog } from './TableInsertDialog';
import { LinkInsertDialog } from './LinkInsertDialog';
import { CloseIcon } from '../shared/icons';
import { FloppyDiskIcon } from './MarkdownEditingIcons';
import { SwitchButton } from '../shared/SwitchButton';
import { TooltipButton } from '../shared/TooltipButton';
import { MarkdownFormattingToolbar, type MarkdownFormattingLabels } from './MarkdownFormattingToolbar';
import { InlineTableEditor, type InlineTableEditorHandle } from './InlineTableEditor';
import { useInlineEditorHistory } from './useInlineEditorHistory';

interface InlineMarkdownEditorLabels {
  readonly sourceLabel: string;
  readonly apply: string;
  readonly cancel: string;
  readonly hint?: string;
  readonly toggleToolbar: string;
  readonly formatting: MarkdownFormattingLabels;
}

interface InlineMarkdownEditorProps {
  readonly target: HTMLElement;
  readonly source: string;
  readonly labels: InlineMarkdownEditorLabels;
  readonly language?: string;
  readonly keybindings?: Readonly<Record<string, string>>;
  readonly disabledKeybindings?: Readonly<Record<string, boolean>>;
  readonly fontSize?: number;
  readonly onFontSizeChange?: (size: number) => void;
  readonly onApply: (replacement: string, range: MarkdownSourceRange) => void;
  readonly onCancel: () => void;
  readonly onSaveShortcut?: () => void;
}

export function InlineMarkdownEditor({
  target,
  source,
  labels,
  language,
  keybindings,
  disabledKeybindings,
  fontSize: controlledFontSize,
  onFontSizeChange,
  onApply,
  onCancel,
  onSaveShortcut,
}: InlineMarkdownEditorProps) {
  const range = readEditableRange(target, source.length);
  const original = range ? source.slice(range.start, range.end) : '';
  const isTableBlock = isTableTarget(target, original);
  const [draft, setDraft] = useState(original);
  const [host] = useState(() => document.createElement('div'));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tableEditorRef = useRef<InlineTableEditorHandle | null>(null);
  const pendingSelectionRef = useRef<MarkdownSelection | null>(null);
  const {
    setTableHistory,
    recordTextareaSnapshot,
    handleUndo,
    handleRedo,
    resetHistory,
    handleTextareaChange,
    canUndo,
    canRedo,
  } = useInlineEditorHistory({
    isTableBlock,
    draft,
    setDraft,
    textareaRef,
    tableEditorRef,
    pendingSelectionRef,
  });
  const [showToolbar, setShowToolbar] = useState(true);
  const [wordWrap, setWordWrap] = useState(getInitialEditorWordWrap);
  const [internalFontSize, setInternalFontSize] = useState(getInitialEditorFontSize);
  const fontSize = controlledFontSize ?? internalFontSize;
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [linkDialogState, setLinkDialogState] = useState<{
    open: boolean;
    initialText: string;
    initialUrl: string;
    selection: MarkdownSelection;
  }>({
    open: false,
    initialText: '',
    initialUrl: '',
    selection: { from: 0, to: 0 },
  });

  const handleInsertTable = (rows: number, cols: number) => {
    const tableText = buildCustomTable(rows, cols);
    if (isTableBlock && tableEditorRef.current) {
      tableEditorRef.current.replaceDoc(tableText);
      setDraft(tableText);
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) return;
    const from = textarea.selectionStart;
    const to = textarea.selectionEnd;
    const prefix = from > 0 && draft[from - 1] !== '\n' ? '\n\n' : '';
    const suffix = to < draft.length && draft[to] !== '\n' ? '\n\n' : '\n';
    const insertion = `${prefix}${tableText}${suffix}`;
    const next = draft.slice(0, from) + insertion + draft.slice(to);
    recordTextareaSnapshot({ from, to });
    setDraft(next);
    pendingSelectionRef.current = { from: from + insertion.length, to: from + insertion.length };
  };

  useEffect(() => {
    setDraft(original);
    resetHistory();
  }, [original]);

  // Mount the editor card right after the edited block and hide the block, so
  // the rendered copy and the source never show at the same time.
  useLayoutEffect(() => {
    if (!range) return undefined;
    const anchor = anchorFor(target);
    host.className = 'markdown-inline-editor-host';
    if (anchor.parentNode) anchor.after(host);
    else target.appendChild(host);
    target.classList.add('is-inline-editing');
    if (anchor !== target) anchor.classList.add('is-inline-editing-anchor');
    return () => {
      target.classList.remove('is-inline-editing');
      anchor.classList.remove('is-inline-editing-anchor');
      host.remove();
    };
  }, [host, target, range?.start, range?.end]);

  useEffect(() => {
    if (isTableBlock) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
    textarea.scrollIntoView?.({ block: 'nearest' });
  }, [isTableBlock, range?.start, range?.end]);

  useLayoutEffect(() => {
    if (isTableBlock) return;
    const pending = pendingSelectionRef.current;
    const textarea = textareaRef.current;
    if (!pending || !textarea) return;
    pendingSelectionRef.current = null;
    textarea.setSelectionRange(pending.from, pending.to);
  }, [isTableBlock, draft]);

  if (!range) return null;

  const apply = () => {
    if (isTableBlock && tableEditorRef.current) {
      tableEditorRef.current.commitPendingEdit();
      const currentDoc = tableEditorRef.current.getCurrentDoc();
      if (currentDoc === original) onCancel();
      else onApply(currentDoc, range);
      return;
    }
    if (draft === original) onCancel();
    else onApply(draft, range);
  };

  const openLinkDialog = () => {
    if (isTableBlock && tableEditorRef.current) {
      tableEditorRef.current.runFormat('link');
      return;
    }
    const textarea = textareaRef.current;
    const from = textarea?.selectionStart ?? draft.length;
    const to = textarea?.selectionEnd ?? draft.length;
    const parsed = parseMarkdownLinkSelection(draft.slice(from, to));
    setLinkDialogState({
      open: true,
      initialText: parsed.label,
      initialUrl: parsed.url,
      selection: { from, to },
    });
  };

  const handleInsertLink = (url: string, text: string) => {
    const result = applyMarkdownLink(draft, linkDialogState.selection, url, text);
    recordTextareaSnapshot(linkDialogState.selection);
    pendingSelectionRef.current = result.selection;
    setDraft(result.source);
    textareaRef.current?.focus({ preventScroll: true });
  };

  const runFormat = (command: MarkdownFormatCommand) => {
    if (command === 'link' && !isTableBlock) {
      openLinkDialog();
      return;
    }
    if (isTableBlock && tableEditorRef.current) {
      tableEditorRef.current.runFormat(command);
      return;
    }
    const textarea = textareaRef.current;
    const from = textarea?.selectionStart ?? draft.length;
    const to = textarea?.selectionEnd ?? draft.length;
    const result = applyMarkdownFormat(draft, { from, to }, command);
    recordTextareaSnapshot({ from, to });
    pendingSelectionRef.current = result.selection;
    setDraft(result.source);
    textarea?.focus({ preventScroll: true });
  };

  const handleEditorShortcuts = (event: KeyboardEvent<HTMLElement>, isContainer: boolean): boolean => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); onCancel(); return true;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault(); event.stopPropagation(); apply(); return true;
    }
    if ((event.key === 's' || event.key === 'S') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault(); event.stopPropagation(); apply(); onSaveShortcut?.(); return true;
    }
    const fontAction = fontSizeActionForChord(event, keybindings, disabledKeybindings);
    if (fontAction) {
      event.preventDefault(); event.stopPropagation();
      handleChangeFontSize(fontSize + (fontAction === 'increase' ? 1 : -1));
      return true;
    }
    if (isUndoChord(event)) {
      event.preventDefault(); event.stopPropagation(); handleUndo(); return true;
    }
    if (isRedoChord(event)) {
      event.preventDefault(); event.stopPropagation(); handleRedo(); return true;
    }
    if (!isContainer || isTableBlock) {
      const command = formatCommandForChord(event, keybindings, disabledKeybindings);
      if (command) {
        event.preventDefault(); runFormat(command); return true;
      }
    }
    return false;
  };

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

  const handleChangeFontSize = (next: number) => {
    const clamped = clampEditorFontSize(next);
    if (onFontSizeChange) onFontSizeChange(clamped);
    else setInternalFontSize(clamped);
    persistEditorFontSize(clamped);
  };

  return createPortal(
    <div
      className="markdown-inline-editor"
      data-editor-font-size={fontSize}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => handleEditorShortcuts(event, true)}
    >
      <div className="markdown-inline-editor__header">
        <span className="markdown-inline-editor__chip">{labels.sourceLabel}</span>
        <SwitchButton
          checked={showToolbar}
          label={labels.toggleToolbar}
          tooltip={labels.toggleToolbar}
          tooltipPos="below"
          tooltipAlign="right"
          className="markdown-inline-editor__toolbar-switch"
          onClick={() => setShowToolbar((current) => !current)}
        />
        <span className="markdown-inline-editor__actions">
          <TooltipButton tooltip={labels.cancel} shortcut="Esc" tooltipPos="below" tooltipAlign="right" icon={<CloseIcon />} className="btn" onClick={onCancel} />
          <TooltipButton tooltip={labels.apply} shortcut={isApplePlatform() ? 'Cmd+Enter' : 'Ctrl+Enter'} tooltipPos="below" tooltipAlign="right" icon={<FloppyDiskIcon size={14} />} className="btn btn--primary" onClick={apply} />
        </span>
      </div>
      {showToolbar && (
        <MarkdownFormattingToolbar
          actions={{
            format: runFormat,
            undo: handleUndo,
            redo: handleRedo,
            canUndo,
            canRedo,
          }}
          labels={labels.formatting}
          keybindings={keybindings}
          disabledKeybindings={disabledKeybindings}
          showPreview={false}
          onPreview={() => {}}
          wrapText={wordWrap}
          onToggleWrapText={() => {
            setWordWrap((current) => {
              const next = !current;
              persistEditorWordWrap(next);
              return next;
            });
          }}
          fontSize={fontSize}
          onChangeFontSize={handleChangeFontSize}
          onOpenTableDialog={() => setTableDialogOpen(true)}
          onOpenLinkDialog={openLinkDialog}
        />
      )}
      {isTableBlock ? (
        <InlineTableEditor
          initialSource={original}
          language={language}
          wordWrap={wordWrap}
          fontSize={fontSize}
          ariaLabel={labels.sourceLabel}
          onChange={setDraft}
          onApply={apply}
          onCancel={onCancel}
          onSaveShortcut={onSaveShortcut}
          onHistoryChange={setTableHistory}
          editorRef={tableEditorRef}
        />
      ) : (
        <textarea
          ref={textareaRef}
          className="markdown-inline-editor__source"
          aria-label={labels.sourceLabel}
          value={draft}
          rows={rowsFor(draft)}
          wrap={wordWrap ? 'soft' : 'off'}
          spellCheck={false}
          onChange={handleTextareaChange}
          onKeyDown={(event) => handleEditorShortcuts(event, false)}
        />
      )}
      <TableInsertDialog open={tableDialogOpen} language={language ?? 'en'} onInsert={handleInsertTable} onClose={() => setTableDialogOpen(false)} />
      <LinkInsertDialog
        open={linkDialogState.open} language={language ?? 'en'} initialText={linkDialogState.initialText}
        initialUrl={linkDialogState.initialUrl} onInsert={handleInsertLink} onClose={() => setLinkDialogState((s) => ({ ...s, open: false }))}
      />
    </div>,
    host,
  );
}
