import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import {
  INITIAL_TEXTAREA_HISTORY,
  pushTextareaSnapshot,
  undoTextareaStep,
  redoTextareaStep,
  type TextareaHistoryState,
} from '../../editor/inlineEdit';
import type { MarkdownSelection } from '../../editor/markdownFormatting';
import type { InlineTableEditorHandle } from './InlineTableEditor';

interface UseInlineEditorHistoryOptions {
  readonly isTableBlock: boolean;
  readonly draft: string;
  readonly setDraft: Dispatch<SetStateAction<string>>;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly tableEditorRef: RefObject<InlineTableEditorHandle | null>;
  readonly pendingSelectionRef: { current: MarkdownSelection | null };
}

export function useInlineEditorHistory({
  isTableBlock,
  draft,
  setDraft,
  textareaRef,
  tableEditorRef,
  pendingSelectionRef,
}: UseInlineEditorHistoryOptions) {
  const [tableHistory, setTableHistory] = useState({ canUndo: false, canRedo: false });
  const [textareaHistory, setTextareaHistory] = useState<TextareaHistoryState>(INITIAL_TEXTAREA_HISTORY);
  const lastTypingSnapshotRef = useRef<number>(0);

  const recordTextareaSnapshot = (selection?: MarkdownSelection) => {
    const sel = selection ?? (textareaRef.current
      ? { from: textareaRef.current.selectionStart, to: textareaRef.current.selectionEnd }
      : undefined);
    setTextareaHistory((h) => pushTextareaSnapshot(h, { text: draft, selection: sel }));
  };

  const handleUndo = () => {
    if (isTableBlock) {
      tableEditorRef.current?.undo();
      return;
    }
    const textarea = textareaRef.current;
    const currentSel = textarea ? { from: textarea.selectionStart, to: textarea.selectionEnd } : undefined;
    setTextareaHistory((h) => {
      const step = undoTextareaStep(h, { text: draft, selection: currentSel });
      if (!step) return h;
      if (step.snapshot.selection) pendingSelectionRef.current = step.snapshot.selection;
      setDraft(step.snapshot.text);
      return step.state;
    });
    textarea?.focus({ preventScroll: true });
  };

  const handleRedo = () => {
    if (isTableBlock) {
      tableEditorRef.current?.redo();
      return;
    }
    const textarea = textareaRef.current;
    const currentSel = textarea ? { from: textarea.selectionStart, to: textarea.selectionEnd } : undefined;
    setTextareaHistory((h) => {
      const step = redoTextareaStep(h, { text: draft, selection: currentSel });
      if (!step) return h;
      if (step.snapshot.selection) pendingSelectionRef.current = step.snapshot.selection;
      setDraft(step.snapshot.text);
      return step.state;
    });
    textarea?.focus({ preventScroll: true });
  };

  const resetHistory = () => {
    setTextareaHistory(INITIAL_TEXTAREA_HISTORY);
    setTableHistory({ canUndo: false, canRedo: false });
  };

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.currentTarget.value;
    const now = Date.now();
    if (now - lastTypingSnapshotRef.current > 400 || textareaHistory.past.length === 0) {
      recordTextareaSnapshot();
      lastTypingSnapshotRef.current = now;
    }
    setDraft(next);
  };

  const canUndo = isTableBlock ? tableHistory.canUndo : textareaHistory.past.length > 0;
  const canRedo = isTableBlock ? tableHistory.canRedo : textareaHistory.future.length > 0;

  return {
    setTableHistory,
    recordTextareaSnapshot,
    handleUndo,
    handleRedo,
    resetHistory,
    handleTextareaChange,
    canUndo,
    canRedo,
  };
}
