import { useMemo, useState } from 'react';
import type { InsightsTranslations } from '../../contexts/insightsTranslations';
import { ensureInsightsUiTranslations, insightsLintRuleLabel, type InsightsUiTranslations } from '../../contexts/insightsUiTranslations';
import type { AnalyzedDocument } from '../../insights/analyzeDocument';
import type { InsightsLintSeverity, InsightsLintSuppressionConfig } from '../../insights/config';
import type { InsightsLintFinding } from '../../insights/lint';
import { CustomSelect } from '../shared/CustomSelect';
import { TooltipButton } from '../shared/TooltipButton';
import { CheckIcon, CopyIcon } from '../shared/icons';
import { buildLintAiPrompt, copyTextToClipboard } from '../../insights/aiPrompts';
import {
  EyeIcon,
  EyeOffIcon,
  RestoreFindingIcon,
  SuppressFindingIcon,
  SuppressPathRuleIcon,
  SuppressRuleIcon,
} from './InsightsIcons';

export interface LintViewProps {
  readonly documents: readonly AnalyzedDocument[];
  readonly labels?: InsightsTranslations | InsightsUiTranslations;
  readonly suppressions?: readonly InsightsLintSuppressionConfig[];
  readonly onSuppressionsChange?: (next: readonly InsightsLintSuppressionConfig[]) => void;
  readonly onSelectFinding?: (finding: InsightsLintFinding) => void;
}

function suppressionKey(item: InsightsLintSuppressionConfig): string {
  if (item.scope === 'finding') return `finding:${item.findingId}`;
  if (item.scope === 'rule') return `rule:${item.ruleId}`;
  return `path-rule:${item.path}\u0000${item.ruleId}`;
}

export function LintView({
  documents,
  labels: suppliedLabels,
  suppressions,
  onSuppressionsChange,
  onSelectFinding,
}: LintViewProps) {
  const labels = ensureInsightsUiTranslations(suppliedLabels);
  const findings = useMemo(() => documents.flatMap(document => document.lint), [documents]);
  const rules = useMemo(() => [...new Set(findings.map(finding => finding.ruleId))].sort(), [findings]);
  const [severity, setSeverity] = useState<'all' | InsightsLintSeverity>('all');
  const [rule, setRule] = useState('all');
  const [localSuppressions, setLocalSuppressions] = useState<InsightsLintSuppressionConfig[]>([]);
  const [showSuppressed, setShowSuppressed] = useState(false);
  const controlled = suppressions !== undefined;
  const effectiveSuppressions = controlled ? suppressions : localSuppressions;

  const suppressionLookups = useMemo(() => {
    const findingIds = new Set<string>();
    const ruleIds = new Set<string>();
    const pathRules = new Set<string>();
    for (const item of effectiveSuppressions) {
      if (item.scope === 'finding') findingIds.add(item.findingId);
      else if (item.scope === 'rule') ruleIds.add(item.ruleId);
      else pathRules.add(`${item.path}\0${item.ruleId}`);
    }
    return { findingIds, ruleIds, pathRules };
  }, [effectiveSuppressions]);

  const isSuppressed = (finding: (typeof findings)[number]) =>
    suppressionLookups.findingIds.has(finding.id) ||
    suppressionLookups.ruleIds.has(finding.ruleId) ||
    suppressionLookups.pathRules.has(`${finding.path}\0${finding.ruleId}`);

  const visible = useMemo(
    () =>
      findings.filter(
        finding =>
          (severity === 'all' || finding.severity === severity) &&
          (rule === 'all' || finding.ruleId === rule) &&
          (showSuppressed || !isSuppressed(finding)),
      ),
    [findings, severity, rule, showSuppressed, suppressionLookups],
  );
  const hasSuppressed = useMemo(() => findings.some(isSuppressed), [findings, suppressionLookups]);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const handleCopyAiPrompt = async () => {
    const prompt = buildLintAiPrompt(visible, labels);
    const ok = await copyTextToClipboard(prompt);
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const updateSuppressions = (next: readonly InsightsLintSuppressionConfig[]) => {
    const deduped = [...new Map(next.map(item => [suppressionKey(item), item] as const)).values()];
    if (!controlled) setLocalSuppressions(deduped);
    onSuppressionsChange?.(deduped);
  };

  const restoreFinding = (finding: (typeof findings)[number]) =>
    updateSuppressions(
      effectiveSuppressions.filter(item =>
        item.scope === 'finding'
          ? item.findingId !== finding.id
          : item.scope === 'rule'
            ? item.ruleId !== finding.ruleId
            : item.path !== finding.path || item.ruleId !== finding.ruleId,
      ),
    );

  const severityOptions = useMemo(
    () => [
      { value: 'all' as const, label: labels.all },
      { value: 'error' as const, label: labels.error },
      { value: 'warning' as const, label: labels.warning },
      { value: 'info' as const, label: labels.info },
    ],
    [labels.all, labels.error, labels.info, labels.warning],
  );

  const ruleOptions = useMemo(
    () => [
      { value: 'all', label: labels.all },
      ...rules.map(item => ({ value: item, label: insightsLintRuleLabel(labels, item) })),
    ],
    [labels, rules],
  );

  return (
    <div className="insights-lint">
      <div className="insights-filters">
        <label>
          {labels.severity}
          <CustomSelect
            aria-label={labels.severity}
            value={severity}
            onChange={setSeverity}
            options={severityOptions}
          />
        </label>
        <label>
          {labels.rule}
          <CustomSelect
            aria-label={labels.rule}
            value={rule}
            onChange={setRule}
            options={ruleOptions}
          />
        </label>
        {hasSuppressed && (
          <TooltipButton
            type="button"
            className={`btn btn--icon insights-filter-toggle${showSuppressed ? ' is-active' : ''}`}
            tooltip={showSuppressed ? labels.hideSuppressed : labels.showSuppressed}
            aria-label={showSuppressed ? labels.hideSuppressed : labels.showSuppressed}
            aria-pressed={showSuppressed}
            tooltipPos="below"
            portalTooltip
            onClick={() => setShowSuppressed(value => !value)}
            icon={showSuppressed ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
          />
        )}
        <TooltipButton
          type="button"
          className="btn btn--icon insights-filter-toggle"
          tooltip={copiedPrompt ? 'Copied AI prompt!' : 'Copy prompt for AI agent to fix markdown lint'}
          aria-label={copiedPrompt ? 'Copied AI prompt!' : 'Copy prompt for AI agent to fix markdown lint'}
          tooltipPos="below"
          portalTooltip
          onClick={handleCopyAiPrompt}
          icon={copiedPrompt ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
        />
        <span
          className="insights-lint__count"
          data-testid="lint-findings-count"
          data-hover-tooltip={`${visible.length}`}
          aria-label={`${visible.length}`}
        >
          {visible.length}
        </span>
      </div>

      {!visible.length && <div className="workspace-insights__empty">{labels.noLintFindings}</div>}

      <ul className="insights-list">
        {visible.map(finding => {
          const suppressed = isSuppressed(finding);
          const ruleLabel = insightsLintRuleLabel(labels, finding.ruleId);
          const severityLabel = labels[finding.severity];
          return (
            <li key={finding.id} className={`insights-list__row insights-lint__row${suppressed ? ' is-suppressed' : ''}`}>
              <button
                type="button"
                className="insights-lint__target"
                onClick={() => onSelectFinding?.(finding)}
                data-hover-tooltip={`${finding.path}${finding.line ? `:${finding.line}` : ''}`}
                aria-label={`${ruleLabel} - ${finding.path}${finding.line ? `:${finding.line}` : ''}`}
              >
                <strong>{ruleLabel}</strong>
                <span className="insights-lint__location">
                  {finding.path}{finding.line ? `:${finding.line}` : ''}
                </span>
                <span className="insights-lint__message">
                  {ruleLabel} · {severityLabel}
                </span>
                {suppressed && <em>{labels.suppressed}</em>}
              </button>
              <div className="insights-row-actions">
                {suppressed ? (
                  <TooltipButton
                    type="button"
                    className="insights-icon-btn"
                    tooltip={labels.restoreFinding}
                    aria-label={labels.restoreFinding}
                    tooltipPos="below"
                    tooltipAlign="right"
                    portalTooltip
                    onClick={() => restoreFinding(finding)}
                    icon={<RestoreFindingIcon size={13} />}
                  />
                ) : (
                  <>
                    <TooltipButton
                      type="button"
                      className="insights-icon-btn"
                      tooltip={labels.suppress}
                      aria-label={labels.suppress}
                      tooltipPos="below"
                      tooltipAlign="right"
                      portalTooltip
                      onClick={() =>
                        updateSuppressions([...effectiveSuppressions, { scope: 'finding', findingId: finding.id }])
                      }
                      icon={<SuppressFindingIcon size={13} />}
                    />
                    <TooltipButton
                      type="button"
                      className="insights-icon-btn"
                      tooltip={labels.suppressRule}
                      aria-label={labels.suppressRule}
                      tooltipPos="below"
                      tooltipAlign="right"
                      portalTooltip
                      onClick={() =>
                        updateSuppressions([...effectiveSuppressions, { scope: 'rule', ruleId: finding.ruleId }])
                      }
                      icon={<SuppressRuleIcon size={13} />}
                    />
                    <TooltipButton
                      type="button"
                      className="insights-icon-btn"
                      tooltip={labels.suppressPath}
                      aria-label={labels.suppressPath}
                      tooltipPos="below"
                      tooltipAlign="right"
                      portalTooltip
                      onClick={() =>
                        updateSuppressions([
                          ...effectiveSuppressions,
                          { scope: 'path-rule', path: finding.path, ruleId: finding.ruleId },
                        ])
                      }
                      icon={<SuppressPathRuleIcon size={13} />}
                    />
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
