import { unicodeIndexOf } from './unicodeSearch';

const SEARCH_JUMP_MARK_CLASS = 'mdn-search-jump-mark';

function getSearchJumpRoot(): HTMLElement | null {
  return document.getElementById('mdBody');
}

export function clearSearchJumpMarks(root = getSearchJumpRoot()) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}, mark.mdn-search-jump-mark-secondary`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    parent.normalize();
  });
}

function shouldSkipSearchJumpTextNode(node: Text): boolean {
  return _shouldSkipSearchJumpTextNode(node, SEARCH_JUMP_MARK_CLASS);
}

export function _shouldSkipSearchJumpTextNode(node: Text, markClass: string): boolean {
  if (!node.nodeValue?.trim()) return true;
  const parent = node.parentElement;
  if (!parent) return true;
  return !!parent.closest([
    `mark.${markClass}`,
    'mark.mdn-find-mark',
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

export function _selectMatchIndex(
  matches: Array<{ cumulativeTextOffset: number; matchLength: number }>,
  needle: string,
  matchOrdinal: number | undefined,
  matchIndex: number | undefined,
  rawMarkdownSource: string | null | undefined,
  fullRenderedText: string,
): number {
  if (matches.length === 0) return -1;

  const targetOrdinal = Number.isFinite(matchOrdinal)
    ? Math.max(0, Math.floor(matchOrdinal ?? 0))
    : 0;

  if (rawMarkdownSource && Number.isFinite(matchIndex) && matchIndex !== undefined && matchIndex >= 0) {
    const targetOffset = matchIndex;
    const matchLength = needle.length;

    const rawBefore = rawMarkdownSource.slice(Math.max(0, targetOffset - 80), targetOffset);
    const rawAfter = rawMarkdownSource.slice(targetOffset + matchLength, targetOffset + matchLength + 80);

    const cleanWords = (text: string) =>
      text
        .replace(/[#*_[\]()`~:|<>\-+=]/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2);

    const targetBeforeWords = cleanWords(rawBefore).slice(-5);
    const targetAfterWords = cleanWords(rawAfter).slice(0, 5);

    const cleanDOMWords = (text: string) =>
      text
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2);

    let bestScore = -Infinity;
    let selected = 0;

    for (let i = 0; i < matches.length; i++) {
      const matchOffset = matches[i].cumulativeTextOffset;
      const domBefore = fullRenderedText.slice(Math.max(0, matchOffset - 120), matchOffset);
      const domAfter = fullRenderedText.slice(matchOffset + matches[i].matchLength, matchOffset + matches[i].matchLength + 120);

      const domBeforeWords = cleanDOMWords(domBefore).slice(-5);
      const domAfterWords = cleanDOMWords(domAfter).slice(0, 5);

      let overlapScore = 0;
      for (const word of targetBeforeWords) {
        if (domBeforeWords.includes(word)) overlapScore++;
      }
      for (const word of targetAfterWords) {
        if (domAfterWords.includes(word)) overlapScore++;
      }

      const rawVsDomDistance = Math.abs(matchOffset - targetOffset);
      const finalScore = overlapScore * 1000000 - rawVsDomDistance;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        selected = i;
      }
    }
    return selected;
  } else if (matchIndex !== undefined && Number.isFinite(matchIndex) && matchIndex >= 0) {
    const targetOffset = matchIndex;
    let closestDistance = Infinity;
    let selected = 0;
    
    for (let i = 0; i < matches.length; i++) {
      const distance = Math.abs(matches[i].cumulativeTextOffset - targetOffset);
      if (distance < closestDistance) {
        closestDistance = distance;
        selected = i;
      }
    }
    return selected;
  } else if (targetOrdinal < matches.length) {
    return targetOrdinal;
  } else {
    return 0;
  }
}

function expandSectionAncestors(element: HTMLElement) {
  let section = element.closest<HTMLElement>('.mdn-section');
  while (section) {
    section.setAttribute('data-expanded', 'true');
    section = section.parentElement?.closest<HTMLElement>('.mdn-section') ?? null;
  }
}

export function scrollToRenderedSearchMatch(
  query: string, 
  matchOrdinal?: number,
  matchIndex?: number,
  rawMarkdownSource?: string | null
): boolean {
  const root = getSearchJumpRoot();
  clearSearchJumpMarks(root);
  if (!root) return false;

  const needle = query.trim();
  if (!needle) return false;

  // We collect all possible matches in the DOM first
  const matches: Array<{
    node: Text;
    index: number;
    matchLength: number;
    cumulativeTextOffset: number;
  }> = [];

  const textNodesInfo: Array<{ node: Text; text: string }> = [];
  let cumulativeTextOffset = 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return shouldSkipSearchJumpTextNode(node as Text)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });

  let node = walker.nextNode() as Text | null;
  while (node) {
    const text = node.nodeValue ?? '';
    textNodesInfo.push({ node, text });
    let fromIndex = 0;
    
    while (fromIndex < text.length) {
      const result = unicodeIndexOf(text, needle, fromIndex);
      if (!result) break;
      
      matches.push({
        node,
        index: result.index,
        matchLength: result.matchLength,
        cumulativeTextOffset: cumulativeTextOffset + result.index
      });
      
      fromIndex = result.index + result.matchLength;
    }
    
    cumulativeTextOffset += text.length;
    node = walker.nextNode() as Text | null;
  }

  if (matches.length === 0) return false;

  const fullRenderedText = textNodesInfo.map((info) => info.text).join('');

  const selectedMatchIndex = _selectMatchIndex(
    matches,
    needle,
    matchOrdinal,
    matchIndex,
    rawMarkdownSource ?? undefined,
    fullRenderedText,
  );

  let activeMark: HTMLElement | null = null;

  // Group matches by text node. Since matches are collected in order,
  // the matches inside each node will be in ascending order of index.
  const nodeMatchesMap = new Map<Text, Array<{
    index: number;
    matchLength: number;
    globalIndex: number;
  }>>();

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (!nodeMatchesMap.has(match.node)) {
      nodeMatchesMap.set(match.node, []);
    }
    nodeMatchesMap.get(match.node)!.push({
      index: match.index,
      matchLength: match.matchLength,
      globalIndex: i,
    });
  }

  for (const [textNode, nodeMatches] of nodeMatchesMap.entries()) {
    const parent = textNode.parentNode;
    if (!parent) continue;

    const text = textNode.nodeValue ?? '';
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const match of nodeMatches) {
      if (match.index > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }

      const mark = document.createElement('mark');
      mark.textContent = text.slice(match.index, match.index + match.matchLength);
      
      if (match.globalIndex === selectedMatchIndex) {
        mark.className = SEARCH_JUMP_MARK_CLASS;
        activeMark = mark;
      } else {
        mark.className = 'mdn-search-jump-mark-secondary';
      }

      fragment.appendChild(mark);
      cursor = match.index + match.matchLength;
    }

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }

    parent.replaceChild(fragment, textNode);
  }

  if (activeMark) {
    expandSectionAncestors(activeMark);

    // Helper: check if the mark is reasonably centred in the scroll viewport
    const isMarkVisible = (mark: HTMLElement): boolean => {
      const scrollContainer = mark.closest('.content__scroll');
      if (!scrollContainer) return false;
      const markRect = mark.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      // Consider "visible" if fully within the container with some margin
      return (
        markRect.top >= containerRect.top - 20 &&
        markRect.bottom <= containerRect.bottom + 20
      );
    };

    // Initial smooth scroll
    activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Follow-up correction scrolls only if the mark drifted off-screen
    // (e.g. due to late async rendering of images, math, or charts)
    window.setTimeout(() => {
      if (activeMark && !isMarkVisible(activeMark)) {
        activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
    window.setTimeout(() => {
      if (activeMark && !isMarkVisible(activeMark)) {
        activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 600);

    window.setTimeout(() => activeMark?.classList.add('is-active'), 120);
    return true;
  }

  return false;
}
