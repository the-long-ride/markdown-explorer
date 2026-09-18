import { useMemo } from 'react';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import { diffLines } from '../../history/lineDiff';

interface SourceDiffViewProps {
  leftSource: string;
  rightSource: string;
  leftLabel?: string;
  rightLabel?: string;
  language?: string;
}

export function SourceDiffView({ leftSource, rightSource, leftLabel, rightLabel, language }: SourceDiffViewProps) {
  const t = getHistoryTranslations(language);
  const lines = useMemo(() => diffLines(leftSource, rightSource).flatMap((hunk) => hunk.lines), [leftSource, rightSource]);
  const statusFor = (type: 'context' | 'remove' | 'add') => type === 'remove' ? t.removed : type === 'add' ? t.added : t.unchanged;
  return (
    <section className="source-diff-view" aria-label={t.sourceDiff}>
      <header className="document-diff-view__labels"><span>{t.left} — {leftLabel ?? t.left}</span><span>{t.right} — {rightLabel ?? t.right}</span></header>
      <div className="source-diff-view__scroll">
        <table className="source-diff-view__table">
          <thead><tr><th>{t.status}</th><th>{t.left}</th><th>{t.right}</th><th>{t.source}</th></tr></thead>
          <tbody>{lines.map((line, index) => (
            <tr key={`${line.type}-${index}`} data-diff-type={line.type}>
              <td className="source-diff-view__status">{statusFor(line.type)}</td>
              <td className="source-diff-view__line-number">{'left' in line ? line.left : ''}</td>
              <td className="source-diff-view__line-number">{'right' in line ? line.right : ''}</td>
              <td className="source-diff-view__source"><code>{line.text || ' '}</code></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
