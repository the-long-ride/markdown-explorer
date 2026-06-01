import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUpIcon, CloseIcon, SearchIcon } from '../shared/icons';

const FIND_PANEL_Z_INDEX = 2147483647;
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

function highlightFindMatches(query: string): HTMLElement[] {
  const root = getFindRoot();
  clearFindMarks(root);
  if (!root) return [];

  const needle = query.trim();
  if (!needle) return [];

  const lowerNeedle = needle.toLowerCase();
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
    const lowerText = text.toLowerCase();
    let index = lowerText.indexOf(lowerNeedle);
    if (index === -1) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;

    while (index !== -1) {
      if (index > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
      }

      const mark = document.createElement('mark');
      mark.className = FIND_MARK_CLASS;
      mark.textContent = text.slice(index, index + needle.length);
      fragment.appendChild(mark);

      cursor = index + needle.length;
      index = lowerText.indexOf(lowerNeedle, cursor);
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
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const matchesRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
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
      const matches = highlightFindMatches(query);
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
  }, [isOpen, query, renderVersion]);

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
      style={{ zIndex: FIND_PANEL_Z_INDEX }}
      role="dialog"
      aria-label="Find in current file"
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
        placeholder={`Find in current file... (${shortcutLabel})`}
        aria-label="Find text in current file"
      />
      <span className="find-in-file-panel__count">
        {query ? `${activeIndex >= 0 ? activeIndex + 1 : 0}/${count}` : '0/0'}
      </span>
      <button type="button" onClick={() => move(-1)} disabled={count === 0} aria-label="Previous match">
        <ChevronUpIcon size={14} />
      </button>
      <button type="button" onClick={() => move(1)} disabled={count === 0} aria-label="Next match">
        <ChevronUpIcon size={14} className="find-in-file-panel__next-icon" />
      </button>
      <button type="button" onClick={onClose} aria-label="Close find in file">
        <CloseIcon size={14} />
      </button>
    </div>,
    document.body,
  );
}
