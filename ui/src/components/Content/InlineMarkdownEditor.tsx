import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { readEditableRange, type MarkdownSourceRange } from '../../editor/inlineEdit';

interface InlineMarkdownEditorLabels {
  readonly sourceLabel: string;
  readonly apply: string;
  readonly cancel: string;
}

interface InlineMarkdownEditorProps {
  readonly target: HTMLElement;
  readonly source: string;
  readonly labels: InlineMarkdownEditorLabels;
  readonly onApply: (replacement: string, range: MarkdownSourceRange) => void;
  readonly onCancel: () => void;
}

export function InlineMarkdownEditor({
  target,
  source,
  labels,
  onApply,
  onCancel,
}: InlineMarkdownEditorProps) {
  const range = readEditableRange(target, source.length);
  const [draft, setDraft] = useState(() => range ? source.slice(range.start, range.end) : '');

  useEffect(() => {
    setDraft(range ? source.slice(range.start, range.end) : '');
  }, [source, range?.start, range?.end]);

  useEffect(() => {
    if (!range) return;
    target.classList.add('is-inline-editing');
    return () => target.classList.remove('is-inline-editing');
  }, [target, range?.start, range?.end]);

  if (!range) return null;

  return createPortal(
    <span className="markdown-inline-editor" onClick={(event) => event.stopPropagation()}>
      <textarea
        className="markdown-inline-editor__source"
        aria-label={labels.sourceLabel}
        value={draft}
        spellCheck={false}
        onChange={(event) => setDraft(event.currentTarget.value)}
      />
      <span className="markdown-inline-editor__actions">
        <button type="button" className="btn" onClick={onCancel}>{labels.cancel}</button>
        <button type="button" className="btn btn--primary" onClick={() => onApply(draft, range)}>{labels.apply}</button>
      </span>
    </span>,
    target,
  );
}
