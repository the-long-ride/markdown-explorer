import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdownClientSide } from '../../contexts/contentTabState';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { canonicalizeDocumentSource } from '../../editor/documentSession';
import { changedCharacterRanges } from '../../history/diffRanges';
import { diffLinesDetailed } from '../../history/lineDiff';
import { useSyncedScroll } from './useSyncedScroll';

interface RenderedDiffViewProps {
  leftSource: string;
  rightSource: string;
  leftLabel?: string;
  rightLabel?: string;
  language?: string;
  hideLabels?: boolean;
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

export function RenderedDiffView({ leftSource: rawLeftSource, rightSource: rawRightSource, leftLabel, rightLabel, language, hideLabels = false }: RenderedDiffViewProps) {
  const t = getHistoryTranslations(language);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  // parse() normalises line endings to LF before it emits data-mdn-source-* offsets, so
  // the diff ranges must be computed against the same canonical text or CRLF drifts them.
  const leftSource = useMemo(() => canonicalizeDocumentSource(rawLeftSource).source, [rawLeftSource]);
  const rightSource = useMemo(() => canonicalizeDocumentSource(rawRightSource).source, [rawRightSource]);
  const { hunks, tooDifferent } = useMemo(() => diffLinesDetailed(leftSource, rightSource), [leftSource, rightSource]);
  const leftRanges = useMemo(() => changedCharacterRanges(leftSource, hunks, 'left'), [leftSource, hunks]);
  const rightRanges = useMemo(() => changedCharacterRanges(rightSource, hunks, 'right'), [rightSource, hunks]);
  const leftRendered = useMemo(() => renderMarkdownClientSide(leftSource, 'left.md'), [leftSource]);
  const rightRendered = useMemo(() => renderMarkdownClientSide(rightSource, 'right.md'), [rightSource]);
  useSyncedScroll(leftPaneRef, rightPaneRef);
  useEffect(() => markChangedBlocks(leftRef.current, leftRanges), [leftRanges, leftRendered.html]);
  useEffect(() => markChangedBlocks(rightRef.current, rightRanges), [rightRanges, rightRendered.html]);
  return (
    <section className="rendered-diff-view" aria-label={t.renderedDiff}>
      {tooDifferent && <p className="source-diff-view__notice rendered-diff-view__notice" role="status">{t.diffTooDifferent}</p>}
      <div ref={leftPaneRef} className="rendered-diff-view__pane rendered-diff-view__pane--removed">{!hideLabels && <header>{t.left} — {leftLabel ?? t.left}</header>}<div ref={leftRef} className="mdn-body rendered-diff-view__body" dangerouslySetInnerHTML={{ __html: leftRendered.html }} /></div>
      <div ref={rightPaneRef} className="rendered-diff-view__pane rendered-diff-view__pane--added">{!hideLabels && <header>{t.right} — {rightLabel ?? t.right}</header>}<div ref={rightRef} className="mdn-body rendered-diff-view__body" dangerouslySetInnerHTML={{ __html: rightRendered.html }} /></div>
    </section>
  );
}
