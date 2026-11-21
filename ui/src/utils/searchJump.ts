import { getActiveDocumentBody } from '../document/activeDocumentRoot';
import {
  buildTextStream,
  findMatchesInStream,
  findMatchesWithCandidates,
  scrollToActiveElement,
  SEARCH_JUMP_MARK_CLASS,
  SEARCH_JUMP_TARGET_CLASS,
  SKIP_CHROME_SELECTOR,
  wrapMatches,
} from './searchJumpDom';
import {
  deriveMarkdownStrippedQuery,
  findEnclosingSourceElement,
  findTableRowForSourceLine,
  getElementSourceRange,
  resolveNormalizedSourceTarget,
  tokenizeContextWords,
  type SearchJumpOptions,
} from './searchJumpResolver';

export { SEARCH_JUMP_MARK_CLASS, SEARCH_JUMP_TARGET_CLASS };
export type { SearchJumpOptions };

function getSearchJumpRoot(): HTMLElement | null {
  return getActiveDocumentBody();
}

export function clearSearchJumpMarks(root = getSearchJumpRoot()) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>(`.${SEARCH_JUMP_TARGET_CLASS}`).forEach((element) => {
    element.classList.remove(SEARCH_JUMP_TARGET_CLASS);
  });
  root.querySelectorAll<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}, mark.mdn-search-jump-mark-secondary`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    parent.normalize();
  });
}

export function _shouldSkipSearchJumpTextNode(node: Text, markClass: string): boolean {
  if (!node.nodeValue?.trim()) return true;
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest(`mark.${markClass},${SKIP_CHROME_SELECTOR}`));
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

    const targetBeforeWords = tokenizeContextWords(rawBefore).slice(-5);
    const targetAfterWords = tokenizeContextWords(rawAfter).slice(0, 5);

    let bestScore = -Infinity;
    let selected = 0;

    for (let i = 0; i < matches.length; i += 1) {
      const matchOffset = matches[i].cumulativeTextOffset;
      const domBefore = fullRenderedText.slice(Math.max(0, matchOffset - 120), matchOffset);
      const domAfter = fullRenderedText.slice(
        matchOffset + matches[i].matchLength,
        matchOffset + matches[i].matchLength + 120,
      );

      const domBeforeWords = tokenizeContextWords(domBefore).slice(-5);
      const domAfterWords = tokenizeContextWords(domAfter).slice(0, 5);

      let overlapScore = 0;
      for (const word of targetBeforeWords) {
        if (domBeforeWords.includes(word)) overlapScore += 1;
      }
      for (const word of targetAfterWords) {
        if (domAfterWords.includes(word)) overlapScore += 1;
      }

      const rawVsDomDistance = Math.abs(matchOffset - targetOffset);
      const finalScore = overlapScore * 1_000_000 - rawVsDomDistance;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        selected = i;
      }
    }
    return selected;
  }
  if (matchIndex !== undefined && Number.isFinite(matchIndex) && matchIndex >= 0) {
    const targetOffset = matchIndex;
    let closestDistance = Infinity;
    let selected = 0;

    for (let i = 0; i < matches.length; i += 1) {
      const distance = Math.abs(matches[i].cumulativeTextOffset - targetOffset);
      if (distance < closestDistance) {
        closestDistance = distance;
        selected = i;
      }
    }
    return selected;
  }
  return targetOrdinal < matches.length ? targetOrdinal : 0;
}

export function scrollToRenderedSearchMatch(
  query: string,
  matchOrdinal?: number,
  matchIndex?: number,
  rawMarkdownSource?: string | null,
  matchCase = false,
  options?: SearchJumpOptions,
): boolean {
  return scrollToRenderedSearchMatchInRoot(
    getSearchJumpRoot(),
    query,
    matchOrdinal,
    matchIndex,
    rawMarkdownSource,
    matchCase,
    options,
  );
}

export function scrollToRenderedSearchMatchInRoot(
  root: HTMLElement | null,
  query: string,
  matchOrdinal?: number,
  matchIndex?: number,
  rawMarkdownSource?: string | null,
  matchCase = false,
  options?: SearchJumpOptions,
): boolean {
  clearSearchJumpMarks(root);
  if (!root) return false;

  const needle = query.trim();
  if (!needle) return false;

  const stripped = deriveMarkdownStrippedQuery(needle);
  const candidates = stripped && stripped !== needle ? [needle, stripped] : [needle];
  const sourceTarget = resolveNormalizedSourceTarget(
    rawMarkdownSource,
    needle,
    matchCase,
    matchOrdinal,
    matchIndex,
    options,
  );

  if (sourceTarget) {
    const sourceBlock = findEnclosingSourceElement(root, sourceTarget.normalizedOffset);
    const blockRange = sourceBlock ? getElementSourceRange(sourceBlock) : null;
    if (sourceBlock && blockRange) {
      const tableRow = findTableRowForSourceLine(
        sourceBlock,
        sourceTarget.normalizedSource,
        blockRange,
        sourceTarget.lineIndex,
      );
      const isPreviewCodeBlock = sourceBlock.matches('.mdn-codeblock[data-mode="preview"]');

      const rowHit = tableRow ? findMatchesWithCandidates(tableRow, candidates, matchCase, false) : null;
      const scopedHit = rowHit
        ?? findMatchesWithCandidates(sourceBlock, candidates, matchCase, false)
        ?? (isPreviewCodeBlock ? findMatchesWithCandidates(sourceBlock, candidates, matchCase, true) : null);

      if (scopedHit) {
        const scopeSource = rowHit
          ? sourceTarget.lineText
          : sourceTarget.normalizedSource.slice(blockRange.start, blockRange.end);
        const scopeOffset = rowHit
          ? sourceTarget.columnOffset
          : Math.max(0, sourceTarget.normalizedOffset - blockRange.start);
        const localIdx = _selectMatchIndex(
          scopedHit.matches,
          scopedHit.candidate,
          0,
          scopeOffset,
          scopeSource,
          scopedHit.stream.raw,
        );
        const picked = scopedHit.matches[Math.max(0, localIdx)];
        const rootStream = buildTextStream(root, false);
        const rootMatches = findMatchesInStream(rootStream, scopedHit.candidate, matchCase);
        const globalIdx = rootMatches.findIndex(
          (entry) => entry.firstNode === picked.firstNode && entry.slices[0]?.start === picked.slices[0]?.start,
        );
        const activeMark = globalIdx >= 0
          ? wrapMatches(rootMatches, globalIdx)
          : wrapMatches([picked, ...rootMatches], 0);
        if (activeMark) {
          scrollToActiveElement(activeMark, true);
          return true;
        }
      }

      const fallbackElement = tableRow ?? sourceBlock;
      fallbackElement.classList.add(SEARCH_JUMP_TARGET_CLASS);
      scrollToActiveElement(fallbackElement, false);
      return true;
    }
  }

  const rootHit = findMatchesWithCandidates(root, candidates, matchCase, false)
    ?? findMatchesWithCandidates(root, candidates, matchCase, true);
  if (!rootHit) return false;

  const selectedMatchIndex = _selectMatchIndex(
    rootHit.matches,
    rootHit.candidate,
    matchOrdinal,
    sourceTarget ? sourceTarget.normalizedOffset : matchIndex,
    sourceTarget ? sourceTarget.normalizedSource : rawMarkdownSource,
    rootHit.stream.raw,
  );
  const activeMark = wrapMatches(rootHit.matches, selectedMatchIndex);
  if (!activeMark) return false;

  scrollToActiveElement(activeMark, true);
  return true;
}
