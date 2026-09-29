import { useMemo, useRef } from 'react';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { diffLinesDetailed } from '../../history/lineDiff';
import { useDiffRowWindow } from './diffVirtualRows';

interface SourceDiffViewProps {
  leftSource: string;
  rightSource: string;
  leftLabel?: string;
  rightLabel?: string;
  language?: string;
  hideLabels?: boolean;
}

export function SourceDiffView({ leftSource, rightSource, leftLabel, rightLabel, language, hideLabels = false }: SourceDiffViewProps) {
  const t = getHistoryTranslations(language);
  const tableRef = useRef<HTMLTableElement>(null);
  const { lines, tooDifferent } = useMemo(() => {
    const detailed = diffLinesDetailed(leftSource, rightSource);
    return { lines: detailed.hunks.flatMap((hunk) => hunk.lines), tooDifferent: detailed.tooDifferent };
  }, [leftSource, rightSource]);
  const { start, end } = useDiffRowWindow(tableRef, lines.length, 'source-diff');
  const statusFor = (type: 'context' | 'remove' | 'add') => type === 'remove' ? t.removed : type === 'add' ? t.added : t.unchanged;
  const markerFor = (type: 'context' | 'remove' | 'add') => type === 'remove' ? '-' : type === 'add' ? '+' : ' ';
  return (
    <section className="source-diff-view" aria-label={t.sourceDiff}>
      {!hideLabels && <header className="document-diff-view__labels"><span>{t.left} — {leftLabel ?? t.left}</span><span>{t.right} — {rightLabel ?? t.right}</span></header>}
      {tooDifferent && <p className="source-diff-view__notice" role="status">{t.diffTooDifferent}</p>}
      <div className="source-diff-view__scroll">
        <table ref={tableRef} className="source-diff-view__table">
          <thead><tr><th>{t.left}</th><th>{t.right}</th><th><span className="source-diff-view__sr">{t.status}</span></th><th>{t.source}</th></tr></thead>
          <tbody>
            {start > 0 && <tr className="source-diff-view__spacer source-diff-view__spacer--before" aria-hidden="true"><td colSpan={4} /></tr>}
            {lines.slice(start, end).map((line, offset) => (
              <tr key={start + offset} data-diff-type={line.type}>
                <td className="source-diff-view__line-number">{'left' in line ? line.left : ''}</td>
                <td className="source-diff-view__line-number">{'right' in line ? line.right : ''}</td>
                <td className="source-diff-view__status"><span aria-hidden="true">{markerFor(line.type)}</span><span className="source-diff-view__sr">{statusFor(line.type)}</span></td>
                <td className="source-diff-view__source" title={line.text || undefined}><code>{line.text || ' '}</code></td>
              </tr>
            ))}
            {end < lines.length && <tr className="source-diff-view__spacer source-diff-view__spacer--after" aria-hidden="true"><td colSpan={4} /></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
