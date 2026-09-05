import { useEffect, useMemo, useState } from 'react';
import type { InsightsTranslations } from '../../contexts/insightsTranslations';
import {
  ensureInsightsUiTranslations,
  insightsLintRuleLabel,
  type InsightsUiTranslations,
} from '../../contexts/insightsUiTranslations';
import type {
  InsightsRelationshipWeights,
  InsightsSettings,
  InsightsSettingsInput,
  InsightsWorkspaceOverrides,
} from '../../insights/config';
import { INSIGHTS_LINT_RULE_DEFAULTS } from '../../insights/lint';
import { createInsightsPathMatcher } from '../../insights/patterns';
import type { WorkspaceInsightsSessionViewModel } from '../../insights/useWorkspaceInsights';
import { SwitchButton } from '../shared/SwitchButton';

export interface InsightsSettingsProps {
  readonly session: WorkspaceInsightsSessionViewModel;
  readonly labels?: InsightsTranslations | InsightsUiTranslations;
  readonly settings: InsightsSettings;
  readonly globalSettings?: InsightsSettings;
  readonly onGlobalSettingsChange?: (patch: InsightsSettingsInput) => void;
  readonly onSettingsChange?: (patch: InsightsWorkspaceOverrides) => void;
  readonly onResetWorkspaceOverrides?: () => void;
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function controlLabel(value: string): string {
  return value.replace(/\s*[:：]?\s*\{[^}]+\}%?\s*$/, '').trim();
}

function patternLines(value: string): string[] {
  return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

export function InsightsSettings({
  session,
  labels: suppliedLabels,
  settings,
  globalSettings,
  onGlobalSettingsChange,
  onSettingsChange,
  onResetWorkspaceOverrides,
}: InsightsSettingsProps) {
  const labels = ensureInsightsUiTranslations(suppliedLabels);
  const canEditGlobal = Boolean(globalSettings && onGlobalSettingsChange);
  const [scope, setScope] = useState<'workspace' | 'global'>('workspace');
  const effectiveScope = scope === 'global' && canEditGlobal ? 'global' : 'workspace';
  const effectiveSettings = effectiveScope === 'global' ? globalSettings ?? settings : settings;
  const changeSettings = useMemo(() => (
    effectiveScope === 'global'
      ? (patch: InsightsSettingsInput) => onGlobalSettingsChange?.(patch)
      : (patch: InsightsWorkspaceOverrides) => onSettingsChange?.(patch)
  ), [effectiveScope, onGlobalSettingsChange, onSettingsChange]);
  const nearDuplicateLabel = controlLabel(labels.nearDuplicateThreshold);
  const [userPatternsDraft, setUserPatternsDraft] = useState(() => effectiveSettings.userPatterns.join('\n'));
  const [oversizedPatternsDraft, setOversizedPatternsDraft] = useState(() => effectiveSettings.oversizedPatterns.join('\n'));
  const [patternError, setPatternError] = useState<string | null>(null);

  useEffect(() => {
    setUserPatternsDraft(effectiveSettings.userPatterns.join('\n'));
    setOversizedPatternsDraft(effectiveSettings.oversizedPatterns.join('\n'));
    setPatternError(null);
  }, [effectiveScope, effectiveSettings.oversizedPatterns, effectiveSettings.userPatterns]);

  const updatePatterns = (kind: 'userPatterns' | 'oversizedPatterns', value: string) => {
    if (kind === 'userPatterns') setUserPatternsDraft(value);
    else setOversizedPatternsDraft(value);
    const patterns = patternLines(value);
    try {
      createInsightsPathMatcher({ userPatterns: patterns });
      setPatternError(null);
      changeSettings({ [kind]: patterns });
    } catch {
      const label = kind === 'userPatterns' ? labels.includeExcludePatterns : labels.oversizedPatterns;
      setPatternError(`${labels.error}: ${label}`);
    }
  };

  const updateRelationshipWeight = (key: keyof InsightsRelationshipWeights, value: string) => {
    const current = effectiveSettings.relationshipWeights[key];
    changeSettings({
      relationshipWeights: {
        ...effectiveSettings.relationshipWeights,
        [key]: numericValue(value, current),
      },
    });
  };

  const updateLintRule = (
    ruleId: string,
    patch: Partial<{ enabled: boolean; severity: 'info' | 'warning' | 'error' }>,
  ) => {
    const current = effectiveSettings.lintRules[ruleId] ?? {
      enabled: true,
      severity: INSIGHTS_LINT_RULE_DEFAULTS[ruleId] ?? 'warning',
    };
    changeSettings({
      lintRules: {
        ...effectiveSettings.lintRules,
        [ruleId]: { ...current, ...patch },
      },
    });
  };

  return (
    <section className="workspace-insights__settings" role="region" aria-label={`${labels.entry} ${labels.settings}`}>
      <div className="workspace-insights__settings-heading">{labels.settings}</div>
      <div className="workspace-insights__settings-desc">{labels.externalLinksDescription}</div>

      <div className="workspace-insights__settings-controls">
        <div className="workspace-insights__settings-section">
          <div className="workspace-insights__settings-section-title">{labels.scopeAndNetwork}</div>
          {canEditGlobal && (
            <label className="workspace-insights__setting-row">
              <span>{labels.settingsScope}</span>
              <select aria-label={labels.settingsScope} value={effectiveScope} onChange={event => setScope(event.target.value as 'workspace' | 'global')}>
                <option value="workspace">{labels.workspaceOverrides}</option>
                <option value="global">{labels.globalDefaults}</option>
              </select>
            </label>
          )}
          <div className="workspace-insights__toggle-row">
            <span>{labels.externalLinksLabel}</span>
            <SwitchButton
              checked={effectiveSettings.externalLinks.enabled}
              label={labels.externalLinksLabel}
              onClick={() => changeSettings({ externalLinks: { enabled: !effectiveSettings.externalLinks.enabled } })}
            />
          </div>
          <label className="workspace-insights__setting-row">
            <span>
              {labels.externalTimeout}
              <span className="workspace-insights__unit-note">({labels.unitMs})</span>
            </span>
            <input type="number" min={3000} max={30000} step={1000} aria-label={labels.externalTimeout} value={effectiveSettings.externalLinks.timeoutMs} onChange={event => changeSettings({ externalLinks: { timeoutMs: numericValue(event.target.value, effectiveSettings.externalLinks.timeoutMs) } })} />
          </label>
        </div>

        <div className="workspace-insights__settings-section">
          <div className="workspace-insights__settings-section-title">{labels.limitsAndTuning}</div>
          <label className="workspace-insights__setting-row">
            <span>
              {nearDuplicateLabel}
              <span className="workspace-insights__unit-note">({labels.unitPercent})</span>
            </span>
            <input type="number" min={50} max={100} step={1} aria-label={nearDuplicateLabel} value={Math.round(effectiveSettings.nearDuplicateThreshold * 100)} onChange={event => changeSettings({ nearDuplicateThreshold: numericValue(event.target.value, effectiveSettings.nearDuplicateThreshold * 100) / 100 })} />
          </label>
          <label className="workspace-insights__setting-row">
            <span>
              {labels.graphNodeCap}
              <span className="workspace-insights__unit-note">({labels.unitNodes})</span>
            </span>
            <input type="number" min={25} max={500} step={25} aria-label={labels.graphNodeCap} value={effectiveSettings.graphNodeCap} onChange={event => changeSettings({ graphNodeCap: numericValue(event.target.value, effectiveSettings.graphNodeCap) })} />
          </label>
          <label className="workspace-insights__setting-row">
            <span>
              {labels.sourceSoftLimit}
              <span className="workspace-insights__unit-note">({labels.unitMb})</span>
            </span>
            <input type="number" min={1} max={64} step={1} aria-label={labels.sourceSoftLimit} value={Math.max(1, Math.round(effectiveSettings.sourceSoftLimitBytes / (1024 * 1024)))} onChange={event => changeSettings({ sourceSoftLimitBytes: numericValue(event.target.value, effectiveSettings.sourceSoftLimitBytes / (1024 * 1024)) * 1024 * 1024 })} />
          </label>
          {effectiveScope === 'global' && (
            <label className="workspace-insights__setting-row">
              <span>
                {labels.cacheCap}
                <span className="workspace-insights__unit-note">({labels.unitMb})</span>
              </span>
              <input type="number" min={64} max={2048} step={64} aria-label={labels.cacheCap} value={Math.round(effectiveSettings.cacheCapBytes / (1024 * 1024))} onChange={event => onGlobalSettingsChange?.({ cacheCapBytes: numericValue(event.target.value, effectiveSettings.cacheCapBytes / (1024 * 1024)) * 1024 * 1024 })} />
            </label>
          )}
        </div>

        <div className="workspace-insights__settings-section">
          <div className="workspace-insights__settings-section-title">{labels.relationshipPreset}</div>
          <label className="workspace-insights__setting-row">
            <span>{labels.relationshipPreset}</span>
            <select aria-label={labels.relationshipPreset} value={effectiveSettings.relationshipPreset} onChange={event => changeSettings({ relationshipPreset: event.target.value as InsightsSettings['relationshipPreset'] })}>
              {(['default', 'link-focused', 'tag-focused', 'terminology-focused', 'custom'] as const).map(preset => (
                <option key={preset} value={preset}>{labels.presentation.relationshipPresets[preset]}</option>
              ))}
            </select>
          </label>
          {effectiveSettings.relationshipPreset === 'custom' && (
            <div className="workspace-insights__settings-subgroup" aria-label={labels.relationshipPreset}>
              {([
                ['links', labels.directLinks],
                ['tags', labels.sharedTags],
                ['headings', labels.sharedHeadings],
                ['title', labels.sharedTitleTerms],
                ['terminology', labels.sharedTerminology],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input type="number" min={0} max={100} step={1} aria-label={label} value={effectiveSettings.relationshipWeights[key]} onChange={event => updateRelationshipWeight(key, event.target.value)} />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="workspace-insights__settings-section">
          <div className="workspace-insights__settings-section-title">{labels.patternFilters}</div>
          <label className="workspace-insights__setting-col">
            <span>{labels.includeExcludePatterns}</span>
            <textarea placeholder="e.g. docs/**&#10;!archive/**" aria-label={labels.includeExcludePatterns} value={userPatternsDraft} onChange={event => updatePatterns('userPatterns', event.target.value)} />
          </label>
          <label className="workspace-insights__setting-col">
            <span>{labels.oversizedPatterns}</span>
            <textarea placeholder="e.g. large-reference.md" aria-label={labels.oversizedPatterns} value={oversizedPatternsDraft} onChange={event => updatePatterns('oversizedPatterns', event.target.value)} />
          </label>
          {patternError && <div role="alert" className="workspace-insights__settings-error">{patternError}</div>}
        </div>

        <fieldset className="workspace-insights__settings-lint">
          <legend>{labels.lint}</legend>
          {Object.entries(INSIGHTS_LINT_RULE_DEFAULTS).map(([ruleId, defaultSeverity]) => {
            const config = effectiveSettings.lintRules[ruleId] ?? { enabled: true, severity: defaultSeverity };
            const ruleLabel = insightsLintRuleLabel(labels, ruleId);
            return (
              <div key={ruleId} className="workspace-insights__settings-lint-rule">
                <div className="workspace-insights__checkbox-label">
                  <SwitchButton
                    checked={config.enabled}
                    label={`${labels.rule}: ${ruleLabel}`}
                    onClick={() => updateLintRule(ruleId, { enabled: !config.enabled })}
                  />
                  <span onClick={() => updateLintRule(ruleId, { enabled: !config.enabled })}>
                    {ruleLabel}
                  </span>
                </div>
                <select aria-label={`${labels.severity}: ${ruleLabel}`} value={config.severity} onChange={event => updateLintRule(ruleId, { severity: event.target.value as 'info' | 'warning' | 'error' })}>
                  <option value="error">{labels.error}</option>
                  <option value="warning">{labels.warning}</option>
                  <option value="info">{labels.info}</option>
                </select>
              </div>
            );
          })}
        </fieldset>

        {effectiveScope === 'workspace' && onResetWorkspaceOverrides && (
          <button type="button" className="btn btn--sm" onClick={onResetWorkspaceOverrides}>
            {labels.resetWorkspace}
          </button>
        )}
      </div>

      <dl className="workspace-insights__settings-summary">
        <div><dt>{labels.networkSession}</dt><dd>{session.approvedPrivateOrigins.size}</dd></div>
        <div><dt>{labels.cacheCap}</dt><dd>{Math.round(effectiveSettings.cacheCapBytes / (1024 * 1024))} MiB</dd></div>
      </dl>
    </section>
  );
}
