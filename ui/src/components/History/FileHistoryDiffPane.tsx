import { useRef } from 'react';
import type { FileHistoryTranslations } from '../../contexts/fileHistoryTranslations';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import type { FileHistoryDiff } from '../../history/useFileHistory';
import { PlainSourceIcon, RenderedViewIcon } from '../Content/MarkdownEditingIcons';
import { SplitViewIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import { FileHistoryResizeHandle } from './FileHistoryResizeHandle';
import { HistoryInlineDiffIcon } from './HistoryActionIcons';
import { RenderedDiffView } from './RenderedDiffView';
import { SourceDiffView } from './SourceDiffView';
import { SplitSourceDiffView } from './SplitSourceDiffView';
import { SPLIT_RATIO } from './useFileHistoryLayout';

export type FileHistoryView = 'raw-inline' | 'raw-split' | 'rendered';

/** Horizontal padding of the diff body; the split guide mirrors it to line up with the panes. */
const DIFF_BODY_PADDING_X = 12;

interface FileHistoryViewControlsProps {
  readonly view: FileHistoryView;
  readonly t: FileHistoryTranslations;
  readonly fileAdded: boolean;
  onViewChange(view: FileHistoryView): void;
}

export function FileHistoryViewControls({ view, t, fileAdded, onViewChange }: FileHistoryViewControlsProps) {
  const isRaw = view !== 'rendered';
  return (
    <div className="file-history__view-controls">
      {fileAdded && <span className="file-history__badge" title={t.fileAdded}>{t.fileAdded}</span>}
      <div role="group" aria-label={t.viewMode} className="file-history__segmented">
        <TooltipButton type="button" className={`btn${isRaw ? ' is-active' : ''}`} tooltip={t.raw} aria-pressed={isRaw} portalTooltip icon={<PlainSourceIcon size={15} />} onClick={() => onViewChange(view === 'raw-split' ? 'raw-split' : 'raw-inline')} />
        <TooltipButton type="button" className={`btn${!isRaw ? ' is-active' : ''}`} tooltip={t.rendered} aria-pressed={!isRaw} portalTooltip icon={<RenderedViewIcon size={15} />} onClick={() => onViewChange('rendered')} />
      </div>
      {isRaw && (
        <div role="group" aria-label={t.viewMode} className="file-history__segmented">
          <TooltipButton type="button" className={`btn${view === 'raw-inline' ? ' is-active' : ''}`} tooltip={t.inline} aria-pressed={view === 'raw-inline'} portalTooltip icon={<HistoryInlineDiffIcon size={15} />} onClick={() => onViewChange('raw-inline')} />
          <TooltipButton type="button" className={`btn${view === 'raw-split' ? ' is-active' : ''}`} tooltip={t.split} aria-pressed={view === 'raw-split'} portalTooltip icon={<SplitViewIcon size={15} />} onClick={() => onViewChange('raw-split')} />
        </div>
      )}
    </div>
  );
}

interface FileHistoryDiffPaneProps {
  readonly diff: FileHistoryDiff;
  readonly view: FileHistoryView;
  readonly language?: string;
  readonly t: FileHistoryTranslations;
  readonly currentLabel: string;
  readonly splitRatio: number;
  onSplitRatioChange(ratio: number): void;
}

export function FileHistoryDiffPane({ diff, view, language, t, currentLabel, splitRatio, onSplitRatioChange }: FileHistoryDiffPaneProps) {
  const historyT = getHistoryTranslations(language);
  const guideRef = useRef<HTMLDivElement>(null);
  const sources = diff.sources;
  const leftLabel = `${historyT.left} — ${sources?.leftLabel || historyT.left}`;
  const rightLabel = `${historyT.right} — ${sources?.rightLabel || currentLabel}`;
  const unchanged = sources !== null && sources.leftSource === sources.rightSource;
  const showDiff = diff.status === 'ready' && sources !== null && !unchanged;

  const resizeTo = (clientX: number) => {
    const guide = guideRef.current;
    if (!guide) return;
    const width = guide.clientWidth - DIFF_BODY_PADDING_X * 2;
    if (width > 0) onSplitRatioChange((clientX - guide.getBoundingClientRect().left - DIFF_BODY_PADDING_X) / width);
  };

  return (
    <section className="file-history__diff" aria-busy={diff.status === 'loading'}>
      <header className="file-history__toolbar">
        {sources && (
          <>
            <span className="file-history__side file-history__side--old" title={leftLabel}>
              <span className="file-history__side-mark" aria-hidden="true">-</span>
              <span className="file-history__side-text">{leftLabel}</span>
            </span>
            <span className="file-history__side file-history__side--new" title={rightLabel}>
              <span className="file-history__side-mark" aria-hidden="true">+</span>
              <span className="file-history__side-text">{rightLabel}</span>
            </span>
          </>
        )}
      </header>
      <div className="file-history__diff-body">
        {diff.status === 'loading' && <div className="file-history__status" role="status">{t.loadingDiff}</div>}
        {diff.status === 'error' && <div className="file-history__status file-history__status--error" role="status">{diff.error}</div>}
        {diff.status === 'ready' && sources && unchanged && <div className="file-history__status" role="status">{t.noChanges}</div>}
        {showDiff && (
          view === 'rendered'
            ? <RenderedDiffView leftSource={sources.leftSource} rightSource={sources.rightSource} language={language} hideLabels />
            : view === 'raw-split'
              ? <SplitSourceDiffView leftSource={sources.leftSource} rightSource={sources.rightSource} language={language} hideLabels />
              : <SourceDiffView leftSource={sources.leftSource} rightSource={sources.rightSource} language={language} hideLabels />
        )}
      </div>
      {showDiff && view !== 'raw-inline' && (
        <div ref={guideRef} className="file-history__split-guide">
          <FileHistoryResizeHandle
            className="file-history__resizer--split"
            label={t.resizeSplit}
            valueNow={splitRatio * 100}
            valueMin={SPLIT_RATIO.min * 100}
            valueMax={SPLIT_RATIO.max * 100}
            onResize={resizeTo}
            onStep={(steps) => onSplitRatioChange(splitRatio + steps * SPLIT_RATIO.step)}
            onReset={() => onSplitRatioChange(SPLIT_RATIO.initial)}
          />
        </div>
      )}
    </section>
  );
}
