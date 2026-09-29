import { useMemo, useRef } from 'react';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { diffLinesDetailed } from '../../history/lineDiff';
import { splitDiffRowsFromHunks, type SplitDiffRow } from '../../history/splitDiffRows';
import { useDiffRowWindow } from './diffVirtualRows';

interface SplitSourceDiffViewProps {
  leftSource: string;
  rightSource: string;
  leftLabel?: string;
  rightLabel?: string;
  language?: string;
  hideLabels?: boolean;
}

/** Hunk separators are flattened into the row model so every entry has the same fixed height. */
type SplitDiffEntry = { readonly kind: 'separator' } | { readonly kind: 'row'; readonly row: SplitDiffRow };

function withSeparators(rows: readonly SplitDiffRow[]): SplitDiffEntry[] {
  const entries: SplitDiffEntry[] = [];
  rows.forEach((row, index) => {
    if (index > 0 && rows[index - 1].hunk !== row.hunk) entries.push({ kind: 'separator' });
    entries.push({ kind: 'row', row });
  });
  return entries;
}

export function SplitSourceDiffView({ leftSource, rightSource, leftLabel, rightLabel, language, hideLabels = false }: SplitSourceDiffViewProps) {
  const t = getHistoryTranslations(language);
  const tableRef = useRef<HTMLTableElement>(null);
  const { entries, tooDifferent } = useMemo(() => {
    const detailed = diffLinesDetailed(leftSource, rightSource);
    return { entries: withSeparators(splitDiffRowsFromHunks(detailed.hunks)), tooDifferent: detailed.tooDifferent };
  }, [leftSource, rightSource]);
  const { start, end } = useDiffRowWindow(tableRef, entries.length, 'split-source-diff');
  return (
    <section className="split-source-diff-view" aria-label={t.sourceDiff}>
      {!hideLabels && <header className="document-diff-view__labels"><span>{t.left} — {leftLabel ?? t.left}</span><span>{t.right} — {rightLabel ?? t.right}</span></header>}
      {tooDifferent && <p className="source-diff-view__notice" role="status">{t.diffTooDifferent}</p>}
      <div className="split-source-diff-view__scroll">
        <table ref={tableRef} className="split-source-diff-view__table">
          <tbody>
            {start > 0 && <tr className="split-source-diff-view__spacer split-source-diff-view__spacer--before" aria-hidden="true"><td colSpan={4} /></tr>}
            {entries.slice(start, end).map((entry, offset) => entry.kind === 'separator'
              ? <tr key={start + offset} className="split-source-diff-view__separator" aria-hidden="true"><td colSpan={4} /></tr>
              : (
                <tr key={start + offset} className="split-source-diff-view__row">
                  <td className="split-source-diff-view__line-number">{entry.row.left?.line ?? ''}</td>
                  <td className="split-source-diff-view__source" data-diff-type={entry.row.left?.type ?? 'empty'} title={entry.row.left?.text || undefined}><code>{entry.row.left ? entry.row.left.text || ' ' : ''}</code></td>
                  <td className="split-source-diff-view__line-number">{entry.row.right?.line ?? ''}</td>
                  <td className="split-source-diff-view__source" data-diff-type={entry.row.right?.type ?? 'empty'} title={entry.row.right?.text || undefined}><code>{entry.row.right ? entry.row.right.text || ' ' : ''}</code></td>
                </tr>
              ))}
            {end < entries.length && <tr className="split-source-diff-view__spacer split-source-diff-view__spacer--after" aria-hidden="true"><td colSpan={4} /></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
