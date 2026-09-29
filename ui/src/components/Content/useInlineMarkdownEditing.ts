import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
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

// Double-clicks on interactive content keep their own behaviour.
const DOUBLE_CLICK_IGNORE_SELECTOR = 'a, button, input, textarea, select, summary, label, .markdown-inline-editor';

const PENCIL_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';

interface UseInlineMarkdownEditingOptions {
  readonly enabled: boolean;
  readonly bodyRef: RefObject<HTMLElement | null>;
  readonly source: string;
  readonly renderVersion: number;
  /** Identifies the document; switching files always closes an open editor. */
  readonly filePath?: string | null;
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

// Resolves a double-clicked node to its installed block. A heading element
// maps to its source-backed text span.
function editableFromEvent(event: MouseEvent, installed: ReadonlySet<HTMLElement>): HTMLElement | null {
  const node = event.target instanceof Element ? event.target : null;
  if (!node || node.closest(DOUBLE_CLICK_IGNORE_SELECTOR)) return null;
  let current: Element | null = node;
  while (current) {
    if (current instanceof HTMLElement && installed.has(current)) return current;
    const headingText = /^H[1-6]$/.test(current.tagName) ? current.querySelector<HTMLElement>(':scope > .mdn-heading-text') : null;
    if (headingText && installed.has(headingText)) return headingText;
    current = current.parentElement;
  }
  return null;
}

export function useInlineMarkdownEditing({
  enabled,
  bodyRef,
  source,
  renderVersion,
  filePath = null,
  editLabel,
  onSourceChange,
}: UseInlineMarkdownEditingOptions): InlineMarkdownEditingController {
  const [activeTarget, setActiveTarget] = useState<HTMLElement | null>(null);

  const filePathRef = useRef(filePath);

  useEffect(() => {
    const root = bodyRef.current;
    const fileChanged = filePathRef.current !== filePath;
    filePathRef.current = filePath;
    // A render bump caused by an edit elsewhere (for example the other split pane
    // of the same file) must not discard the open editor and its draft. Only close
    // it when the file changed or its block no longer exists with a valid range.
    setActiveTarget((current) => {
      if (!current || fileChanged || !enabled || !root) return null;
      return root.contains(current) && readEditableRange(current, source.length) ? current : null;
    });
    if (!enabled || !root) return;

    const installed: Array<{ target: HTMLElement; trigger: HTMLButtonElement }> = [];
    const installedTargets = new Set<HTMLElement>();
    const candidates = [...root.querySelectorAll<HTMLElement>(INLINE_EDITABLE_SELECTOR)];

    for (const target of candidates) {
      if (!isTopLevelEditableTarget(target, root)) continue;
      if (!readEditableRange(target, source.length)) continue;

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'mdn-inline-edit-trigger tooltip-container';
      trigger.setAttribute('aria-label', editLabel);
      trigger.setAttribute('data-tooltip-pos', 'below');
      trigger.setAttribute('data-tooltip-align', 'right');
      trigger.innerHTML = PENCIL_ICON;
      const tooltip = document.createElement('span');
      tooltip.className = 'tooltip-text';
      tooltip.textContent = editLabel;
      trigger.appendChild(tooltip);
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveTarget(target);
      });

      target.classList.add('is-inline-editable');
      target.appendChild(trigger);
      installed.push({ target, trigger });
      installedTargets.add(target);
    }

    const handleDoubleClick = (event: MouseEvent) => {
      const target = editableFromEvent(event, installedTargets);
      if (!target) return;
      event.preventDefault();
      window.getSelection?.()?.removeAllRanges();
      setActiveTarget(target);
    };
    root.addEventListener('dblclick', handleDoubleClick);

    return () => {
      root.removeEventListener('dblclick', handleDoubleClick);
      for (const { target, trigger } of installed) {
        trigger.remove();
        target.classList.remove('is-inline-editable');
      }
    };
  }, [editLabel, enabled, filePath, renderVersion, source.length]);

  const apply = useCallback((replacement: string, range: MarkdownSourceRange) => {
    onSourceChange(replaceSourceRange(source, range, replacement));
    setActiveTarget(null);
  }, [onSourceChange, source]);

  const cancel = useCallback(() => setActiveTarget(null), []);

  return { activeTarget, apply, cancel };
}
