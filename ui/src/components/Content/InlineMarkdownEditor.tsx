import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatCommandForChord, isApplePlatform } from '../../editor/editorUx';
import { readEditableRange, type MarkdownSourceRange } from '../../editor/inlineEdit';
import { applyMarkdownFormat, type MarkdownFormatCommand, type MarkdownSelection } from '../../editor/markdownFormatting';
import { CloseIcon } from '../shared/icons';
import { FloppyDiskIcon } from './MarkdownEditingIcons';
import { SwitchButton } from '../shared/SwitchButton';
import { TooltipButton } from '../shared/TooltipButton';
import { MarkdownFormattingToolbar, type MarkdownFormattingLabels } from './MarkdownFormattingToolbar';

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
  readonly onApply: (replacement: string, range: MarkdownSourceRange) => void;
  readonly onCancel: () => void;
  readonly onSaveShortcut?: () => void;
}

const MIN_ROWS = 3;
const MAX_ROWS = 24;

// Headings edit as a whole line, so the editor replaces the heading element,
// not just its text span.
function anchorFor(target: HTMLElement): HTMLElement {
  if (!target.classList.contains('mdn-heading-text')) return target;
  return target.closest<HTMLElement>('h1, h2, h3, h4, h5, h6') ?? target;
}

function rowsFor(draft: string): number {
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, draft.split('\n').length + 1));
}

export function InlineMarkdownEditor({
  target,
  source,
  labels,
  onApply,
  onCancel,
  onSaveShortcut,
}: InlineMarkdownEditorProps) {
  const range = readEditableRange(target, source.length);
  const original = range ? source.slice(range.start, range.end) : '';
  const [draft, setDraft] = useState(original);
  const [host] = useState(() => document.createElement('div'));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<MarkdownSelection | null>(null);
  const [showToolbar, setShowToolbar] = useState(true);

  useEffect(() => {
    setDraft(original);
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
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
    textarea.scrollIntoView?.({ block: 'nearest' });
  }, [range?.start, range?.end]);

  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    const textarea = textareaRef.current;
    if (!pending || !textarea) return;
    pendingSelectionRef.current = null;
    textarea.setSelectionRange(pending.from, pending.to);
  }, [draft]);

  if (!range) return null;

  const apply = () => {
    if (draft === original) onCancel();
    else onApply(draft, range);
  };

  const runFormat = (command: MarkdownFormatCommand) => {
    const textarea = textareaRef.current;
    const from = textarea?.selectionStart ?? draft.length;
    const to = textarea?.selectionEnd ?? draft.length;
    const result = applyMarkdownFormat(draft, { from, to }, command);
    pendingSelectionRef.current = result.selection;
    setDraft(result.source);
    textarea?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      apply();
      return;
    }
    if ((event.key === 's' || event.key === 'S') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      apply();
      onSaveShortcut?.();
      return;
    }
    const command = formatCommandForChord(event);
    if (!command) return;
    event.preventDefault();
    runFormat(command);
  };

  return createPortal(
    <div
      className="markdown-inline-editor"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
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
          <TooltipButton
            tooltip={labels.cancel}
            shortcut="Esc"
            tooltipPos="below"
            tooltipAlign="right"
            icon={<CloseIcon />}
            className="btn"
            onClick={onCancel}
          />
          <TooltipButton
            tooltip={labels.apply}
            shortcut={isApplePlatform() ? 'Cmd+Enter' : 'Ctrl+Enter'}
            tooltipPos="below"
            tooltipAlign="right"
            icon={<FloppyDiskIcon size={14} />}
            className="btn btn--primary"
            onClick={apply}
          />
        </span>
      </div>
      {showToolbar && (
        <MarkdownFormattingToolbar
          actions={{ format: runFormat, undo: () => {}, redo: () => {}, canUndo: false, canRedo: false }}
          labels={labels.formatting}
          showUndoRedo={false}
          showPreview={false}
          onPreview={() => {}}
        />
      )}
      <textarea
        ref={textareaRef}
        className="markdown-inline-editor__source"
        aria-label={labels.sourceLabel}
        value={draft}
        rows={rowsFor(draft)}
        spellCheck={false}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
    </div>,
    host,
  );
}
