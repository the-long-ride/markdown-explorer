import { useMemo, useState } from 'react';
import { INSIGHTS_TRANSLATIONS, type InsightsTranslations } from '../../contexts/insightsTranslations';
import type { AnalyzedDocument } from '../../insights/analyzeDocument';
import type { InsightsLintSeverity, InsightsLintSuppressionConfig } from '../../insights/config';

export interface LintViewProps {
  readonly documents: readonly AnalyzedDocument[];
  readonly labels?: InsightsTranslations;
  readonly suppressions?: readonly InsightsLintSuppressionConfig[];
  readonly onSuppressionsChange?: (next: readonly InsightsLintSuppressionConfig[]) => void;
}

function suppressionKey(item: InsightsLintSuppressionConfig): string {
  if (item.scope === 'finding') return `finding:${item.findingId}`;
  if (item.scope === 'rule') return `rule:${item.ruleId}`;
  return `path-rule:${item.path}\u0000${item.ruleId}`;
}

export function LintView({ documents, labels = INSIGHTS_TRANSLATIONS.en, suppressions, onSuppressionsChange }: LintViewProps) {
  const findings = useMemo(() => documents.flatMap(document => document.lint), [documents]);
  const rules = useMemo(() => [...new Set(findings.map(finding => finding.ruleId))].sort(), [findings]);
  const [severity, setSeverity] = useState<'all' | InsightsLintSeverity>('all');
  const [rule, setRule] = useState('all');
  const [localSuppressions, setLocalSuppressions] = useState<InsightsLintSuppressionConfig[]>([]);
  const [showSuppressed, setShowSuppressed] = useState(false);
  const controlled = suppressions !== undefined;
  const effectiveSuppressions = controlled ? suppressions : localSuppressions;

  const isSuppressed = (finding: (typeof findings)[number]) => effectiveSuppressions.some(item => {
    if (item.scope === 'finding') return item.findingId === finding.id;
    if (item.scope === 'rule') return item.ruleId === finding.ruleId;
    return item.path === finding.path && item.ruleId === finding.ruleId;
  });
  const visible = findings.filter(finding =>
    (severity === 'all' || finding.severity === severity)
    && (rule === 'all' || finding.ruleId === rule)
    && (showSuppressed || !isSuppressed(finding)),
  );
  const hasSuppressed = findings.some(isSuppressed);

  const updateSuppressions = (next: readonly InsightsLintSuppressionConfig[]) => {
    const deduped = [...new Map(next.map(item => [suppressionKey(item), item] as const)).values()];
    if (!controlled) setLocalSuppressions(deduped);
    onSuppressionsChange?.(deduped);
  };

  const restoreFinding = (finding: (typeof findings)[number]) => updateSuppressions(effectiveSuppressions.filter(item => {
    if (item.scope === 'finding') return item.findingId !== finding.id;
    if (item.scope === 'rule') return item.ruleId !== finding.ruleId;
    return item.path !== finding.path || item.ruleId !== finding.ruleId;
  }));

  return (
    <div className="insights-lint">
      <div className="insights-filters">
        <label>{labels.severity}<select aria-label={labels.severity} value={severity} onChange={event => setSeverity(event.target.value as typeof severity)}><option value="all">{labels.all}</option><option value="error">{labels.error}</option><option value="warning">{labels.warning}</option><option value="info">{labels.info}</option></select></label>
        <label>{labels.rule}<select aria-label={labels.rule} value={rule} onChange={event => setRule(event.target.value)}><option value="all">{labels.all}</option>{rules.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        {hasSuppressed && <button type="button" className="btn btn--sm" onClick={() => setShowSuppressed(value => !value)}>{showSuppressed ? labels.hideSuppressed : labels.showSuppressed}</button>}
      </div>
      {!visible.length && <div className="workspace-insights__empty">{labels.noLintFindings}</div>}
      <ul className="insights-list">
        {visible.map(finding => {
          const suppressed = isSuppressed(finding);
          return (
            <li key={finding.id} className={`insights-list__row${suppressed ? ' is-suppressed' : ''}`}>
              <div><strong>{finding.message}</strong><span>{finding.path}{finding.line ? `:${finding.line}` : ''} · {finding.ruleId} · {finding.severity}</span>{suppressed && <em>{labels.suppressed}</em>}</div>
              <div className="insights-row-actions">
                {suppressed ? (
                  <button type="button" className="btn btn--sm" onClick={() => restoreFinding(finding)}>{labels.restoreFinding}</button>
                ) : (
                  <>
                    <button type="button" className="btn btn--sm" aria-label={labels.suppress} onClick={() => updateSuppressions([...effectiveSuppressions, { scope: 'finding', findingId: finding.id }])}>{labels.suppress}</button>
                    <button type="button" className="btn btn--sm" aria-label={labels.suppressRule} onClick={() => updateSuppressions([...effectiveSuppressions, { scope: 'rule', ruleId: finding.ruleId }])}>{labels.suppressRule}</button>
                    <button type="button" className="btn btn--sm" aria-label={labels.suppressPath} onClick={() => updateSuppressions([...effectiveSuppressions, { scope: 'path-rule', path: finding.path, ruleId: finding.ruleId }])}>{labels.suppressPath}</button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
