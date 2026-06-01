const SEARCH_JUMP_MARK_CLASS = 'mdn-search-jump-mark';

function getSearchJumpRoot(): HTMLElement | null {
  return document.getElementById('mdBody');
}

export function clearSearchJumpMarks(root = getSearchJumpRoot()) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    parent.normalize();
  });
}

function shouldSkipSearchJumpTextNode(node: Text): boolean {
  if (!node.nodeValue?.trim()) return true;
  const parent = node.parentElement;
  if (!parent) return true;
  return !!parent.closest([
    `mark.${SEARCH_JUMP_MARK_CLASS}`,
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

function expandSectionAncestors(element: HTMLElement) {
  let section = element.closest<HTMLElement>('.mdn-section');
  while (section) {
    section.setAttribute('data-expanded', 'true');
    section = section.parentElement?.closest<HTMLElement>('.mdn-section') ?? null;
  }
}

export function scrollToRenderedSearchMatch(query: string, matchOrdinal?: number): boolean {
  const root = getSearchJumpRoot();
  clearSearchJumpMarks(root);
  if (!root) return false;

  const needle = query.trim();
  if (!needle) return false;

  const lowerNeedle = needle.toLowerCase();
  const targetOrdinal = Number.isFinite(matchOrdinal)
    ? Math.max(0, Math.floor(matchOrdinal ?? 0))
    : 0;
  let seenOrdinal = 0;
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
    const index = text.toLowerCase().indexOf(lowerNeedle);
    if (index !== -1) {
      if (seenOrdinal === targetOrdinal) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + needle.length);
        const mark = document.createElement('mark');
        mark.className = SEARCH_JUMP_MARK_CLASS;
        range.surroundContents(mark);
        expandSectionAncestors(mark);
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => mark.classList.add('is-active'), 120);
        return true;
      }
      seenOrdinal++;
    }
    node = walker.nextNode() as Text | null;
  }

  return false;
}
