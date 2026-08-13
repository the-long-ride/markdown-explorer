import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUpIcon, CloseIcon, SearchIcon } from '../shared/icons';
import { unicodeIndexOf } from '../../utils/unicodeSearch';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';
import { TooltipButton } from '../shared/TooltipButton';

const FIND_MARK_CLASS = 'mdn-find-mark';
const FIND_ACTIVE_CLASS = 'is-active';

interface FindInFilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  renderVersion: number;
  shortcutLabel: string;
}

function getFindRoot(): HTMLElement | null {
  return document.getElementById('mdBody');
}

function clearFindMarks(root = getFindRoot()) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>(`mark.${FIND_MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    parent.normalize();
  });
}

function shouldSkipTextNode(node: Text): boolean {
  if (!node.nodeValue?.trim()) return true;
  const parent = node.parentElement;
  if (!parent) return true;
  return !!parent.closest([
    `mark.${FIND_MARK_CLASS}`,
    'button',
    'input',
    'textarea',
    'select',
    'script',
    'style',
    'iframe',
    'svg',
    'canvas',
    '.mdn-line-numbers',
    '.mdn-table-toolbar',
    '.mdn-filter-dropdown',
  ].join(','));
}

function highlightFindMatches(query: string, matchCase = false): HTMLElement[] {
  const root = getFindRoot();
  clearFindMarks(root);
  if (!root) return [];

  const needle = query.trim();
  if (!needle) return [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      shouldSkipTextNode(node as Text)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => {
    const text = node.nodeValue || '';

    let exactIndex = matchCase ? text.indexOf(needle) : -1;
    let result = matchCase ? null : unicodeIndexOf(text, needle, 0);
    if (matchCase ? exactIndex < 0 : !result) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;

    while (matchCase ? exactIndex >= 0 : result) {
      const index = matchCase ? exactIndex : result!.index;
      const matchLength = matchCase ? needle.length : result!.matchLength;

      if (index > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
      }

      const mark = document.createElement('mark');
      mark.className = FIND_MARK_CLASS;
      mark.textContent = text.slice(index, index + matchLength);
      fragment.appendChild(mark);

      cursor = index + matchLength;
      exactIndex = matchCase ? text.indexOf(needle, cursor) : -1;
      result = matchCase ? null : unicodeIndexOf(text, needle, cursor);
    }

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }

    node.replaceWith(fragment);
  });

  return Array.from(root.querySelectorAll<HTMLElement>(`mark.${FIND_MARK_CLASS}`));
}

function scrollToMatch(index: number, matches: readonly HTMLElement[]) {
  matches.forEach((match) => match.classList.remove(FIND_ACTIVE_CLASS));
  const active = matches[index];
  if (!active) return;

  active.classList.add(FIND_ACTIVE_CLASS);
  let section = active.closest<HTMLElement>('.mdn-section');
  while (section) {
    section.setAttribute('data-expanded', 'true');
    section = section.parentElement?.closest<HTMLElement>('.mdn-section') ?? null;
  }
  active.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

export function FindInFilePanel({
  isOpen,
  onClose,
  renderVersion,
  shortcutLabel,
}: FindInFilePanelProps) {
  const { state } = useAppState();
  const t = getTranslations(state.settings.language || 'en');
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [count, setCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const matchesRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setMatchCase(false);
      setCount(0);
      setActiveIndex(-1);
      matchesRef.current = [];
      clearFindMarks();
      return;
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const matches = highlightFindMatches(query, matchCase);
      matchesRef.current = matches;
      setCount(matches.length);

      if (matches.length === 0) {
        setActiveIndex(-1);
        return;
      }

      setActiveIndex(0);
      scrollToMatch(0, matches);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, query, matchCase, renderVersion]);

  useEffect(() => () => clearFindMarks(), []);

  const move = useCallback((delta: number) => {
    const matches = matchesRef.current;
    if (matches.length === 0) return;

    setActiveIndex((current) => {
      const base = current < 0 ? 0 : current;
      const next = (base + delta + matches.length) % matches.length;
      scrollToMatch(next, matches);
      return next;
    });
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="find-in-file-panel"
      role="dialog"
      aria-label={t.search.findDialogLabel}
    >
      <SearchIcon size={15} />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            move(event.shiftKey ? -1 : 1);
          }
        }}
        placeholder={t.search.findPlaceholder.replace('{shortcut}', shortcutLabel)}
        aria-label={t.search.findInputLabel}
      />
      <TooltipButton
        type="button"
        className={`find-in-file-panel__case${matchCase ? ' is-active' : ''}`}
        onClick={() => setMatchCase((value) => !value)}
        tooltip={`${t.search.matchCase} - ${matchCase ? (t.search.statusOn) : (t.search.statusOff)}`}
        tooltipPos="below"
        aria-pressed={matchCase}
      >
        Aa
      </TooltipButton>
      <span className="find-in-file-panel__count">
        {query ? `${activeIndex >= 0 ? activeIndex + 1 : 0}/${count}` : '0/0'}
      </span>
      <button type="button" onClick={() => move(-1)} disabled={count === 0} aria-label={t.search.previousMatch}>
        <ChevronUpIcon size={14} />
      </button>
      <button type="button" onClick={() => move(1)} disabled={count === 0} aria-label={t.search.nextMatch}>
        <ChevronUpIcon size={14} className="find-in-file-panel__next-icon" />
      </button>
      <button type="button" onClick={onClose} aria-label={t.search.closeFind}>
        <CloseIcon size={14} />
      </button>
    </div>,
    document.body,
  );
}
