import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdownClientSide } from '../../contexts/contentTabState';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { changedCharacterRanges } from '../../history/diffRanges';
import { diffLines } from '../../history/lineDiff';

interface RenderedDiffViewProps {
  leftSource: string;
  rightSource: string;
  leftLabel?: string;
  rightLabel?: string;
  language?: string;
}

function markChangedBlocks(root: HTMLElement | null, ranges: readonly { start: number; end: number }[]) {
  if (!root) return;
  for (const element of root.querySelectorAll<HTMLElement>('[data-mdn-source-start][data-mdn-source-end]')) {
    element.classList.remove('is-diff-changed');
    const start = Number(element.dataset.mdnSourceStart);
    const end = Number(element.dataset.mdnSourceEnd);
    if (Number.isFinite(start) && Number.isFinite(end) && ranges.some((range) => start < range.end && end > range.start)) element.classList.add('is-diff-changed');
  }
}

export function RenderedDiffView({ leftSource, rightSource, leftLabel, rightLabel, language }: RenderedDiffViewProps) {
  const t = getHistoryTranslations(language);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const hunks = useMemo(() => diffLines(leftSource, rightSource), [leftSource, rightSource]);
  const leftRanges = useMemo(() => changedCharacterRanges(leftSource, hunks, 'left'), [leftSource, hunks]);
  const rightRanges = useMemo(() => changedCharacterRanges(rightSource, hunks, 'right'), [rightSource, hunks]);
  const leftRendered = useMemo(() => renderMarkdownClientSide(leftSource, 'left.md'), [leftSource]);
  const rightRendered = useMemo(() => renderMarkdownClientSide(rightSource, 'right.md'), [rightSource]);
  useEffect(() => markChangedBlocks(leftRef.current, leftRanges), [leftRanges, leftRendered.html]);
  useEffect(() => markChangedBlocks(rightRef.current, rightRanges), [rightRanges, rightRendered.html]);
  return (
    <section className="rendered-diff-view" aria-label={t.renderedDiff}>
      <div className="rendered-diff-view__pane rendered-diff-view__pane--removed"><header>{t.left} — {leftLabel ?? t.left}</header><div ref={leftRef} className="mdn-body rendered-diff-view__body" dangerouslySetInnerHTML={{ __html: leftRendered.html }} /></div>
      <div className="rendered-diff-view__pane rendered-diff-view__pane--added"><header>{t.right} — {rightLabel ?? t.right}</header><div ref={rightRef} className="mdn-body rendered-diff-view__body" dangerouslySetInnerHTML={{ __html: rightRendered.html }} /></div>
    </section>
  );
}
