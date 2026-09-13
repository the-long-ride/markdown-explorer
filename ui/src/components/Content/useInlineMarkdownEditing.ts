import { useCallback, useEffect, useState, type RefObject } from 'react';
import { readEditableRange, replaceSourceRange, type MarkdownSourceRange } from '../../editor/inlineEdit';

const INLINE_EDITABLE_SELECTOR = [
  '.mdn-heading-text[data-mdn-source-start][data-mdn-source-end]',
  'p[data-mdn-source-start][data-mdn-source-end]',
  '.mdn-blockquote[data-mdn-source-start][data-mdn-source-end]',
  '.mdn-callout[data-mdn-source-start][data-mdn-source-end]',
  'ul.mdn-list[data-mdn-source-start][data-mdn-source-end]',
  'ol.mdn-list[data-mdn-source-start][data-mdn-source-end]',
  '.mdn-codeblock[data-mdn-source-start][data-mdn-source-end]',
  '.mdn-table-source[data-mdn-source-start][data-mdn-source-end]',
].join(',');

interface UseInlineMarkdownEditingOptions {
  readonly enabled: boolean;
  readonly bodyRef: RefObject<HTMLElement | null>;
  readonly source: string;
  readonly renderVersion: number;
  readonly editLabel: string;
  readonly onSourceChange: (source: string) => void;
}

interface InlineMarkdownEditingController {
  readonly activeTarget: HTMLElement | null;
  readonly apply: (replacement: string, range: MarkdownSourceRange) => void;
  readonly cancel: () => void;
}

function isTopLevelEditableTarget(target: HTMLElement, root: HTMLElement): boolean {
  const editableAncestor = target.parentElement?.closest<HTMLElement>(INLINE_EDITABLE_SELECTOR) ?? null;
  return !editableAncestor || !root.contains(editableAncestor);
}

export function useInlineMarkdownEditing({
  enabled,
  bodyRef,
  source,
  renderVersion,
  editLabel,
  onSourceChange,
}: UseInlineMarkdownEditingOptions): InlineMarkdownEditingController {
  const [activeTarget, setActiveTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setActiveTarget(null);
    const root = bodyRef.current;
    if (!enabled || !root) return;

    const installed: Array<{ target: HTMLElement; trigger: HTMLButtonElement }> = [];
    const candidates = [...root.querySelectorAll<HTMLElement>(INLINE_EDITABLE_SELECTOR)];

    for (const target of candidates) {
      if (!isTopLevelEditableTarget(target, root)) continue;
      if (!readEditableRange(target, source.length)) continue;

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'mdn-inline-edit-trigger';
      trigger.setAttribute('aria-label', editLabel);
      trigger.title = editLabel;
      trigger.textContent = '✎';
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveTarget(target);
      });

      target.classList.add('is-inline-editable');
      target.appendChild(trigger);
      installed.push({ target, trigger });
    }

    return () => {
      for (const { target, trigger } of installed) {
        trigger.remove();
        target.classList.remove('is-inline-editable');
      }
    };
  }, [editLabel, enabled, renderVersion, source.length]);

  const apply = useCallback((replacement: string, range: MarkdownSourceRange) => {
    onSourceChange(replaceSourceRange(source, range, replacement));
    setActiveTarget(null);
  }, [onSourceChange, source]);

  const cancel = useCallback(() => setActiveTarget(null), []);

  return { activeTarget, apply, cancel };
}
