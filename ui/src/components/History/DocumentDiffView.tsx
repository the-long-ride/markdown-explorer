import { useState } from 'react';
import { getHistoryTranslations } from '../../contexts/historyTranslations';
import '../../styles/global/global-history-diff.css';
import { RenderedDiffView } from './RenderedDiffView';
import { SourceDiffView } from './SourceDiffView';

export type DocumentDiffMode = 'source' | 'rendered';
interface DocumentDiffViewProps {
  leftSource: string; rightSource: string; leftLabel?: string; rightLabel?: string; language?: string;
  defaultMode?: DocumentDiffMode; onReturnToCurrent?: () => void;
}

export function DocumentDiffView({ leftSource, rightSource, leftLabel, rightLabel, language, defaultMode = 'source', onReturnToCurrent }: DocumentDiffViewProps) {
  const t = getHistoryTranslations(language);
  const [mode, setMode] = useState<DocumentDiffMode>(defaultMode);
  return (
    <section className="document-diff-view" data-testid="document-diff-view">
      <header className="document-diff-view__toolbar">
        <div role="group" aria-label={t.diffMode}>
          <button type="button" className={`btn${mode === 'source' ? ' is-active' : ''}`} aria-pressed={mode === 'source'} onClick={() => setMode('source')}>{t.sourceDiff}</button>
          <button type="button" className={`btn${mode === 'rendered' ? ' is-active' : ''}`} aria-pressed={mode === 'rendered'} onClick={() => setMode('rendered')}>{t.renderedDiff}</button>
        </div>
        {onReturnToCurrent && <button type="button" className="btn" onClick={onReturnToCurrent}>{t.returnCurrent}</button>}
      </header>
      {mode === 'source'
        ? <SourceDiffView leftSource={leftSource} rightSource={rightSource} leftLabel={leftLabel} rightLabel={rightLabel} language={language} />
        : <RenderedDiffView leftSource={leftSource} rightSource={rightSource} leftLabel={leftLabel} rightLabel={rightLabel} language={language} />}
    </section>
  );
}
