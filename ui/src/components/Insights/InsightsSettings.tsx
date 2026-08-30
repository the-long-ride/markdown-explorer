import { useEffect, useMemo, useState } from 'react';
import { INSIGHTS_TRANSLATIONS, type InsightsTranslations } from '../../contexts/insightsTranslations';
import type {
  InsightsRelationshipWeights,
  InsightsSettings,
  InsightsSettingsInput,
  InsightsWorkspaceOverrides,
} from '../../insights/config';
import { INSIGHTS_LINT_RULE_DEFAULTS } from '../../insights/lint';
import { createInsightsPathMatcher } from '../../insights/patterns';
import type { WorkspaceInsightsSessionViewModel } from '../../insights/useWorkspaceInsights';

export interface InsightsSettingsProps {
  readonly session: WorkspaceInsightsSessionViewModel;
  readonly labels?: InsightsTranslations;
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
  labels = INSIGHTS_TRANSLATIONS.en,
  settings,
  globalSettings,
  onGlobalSettingsChange,
  onSettingsChange,
  onResetWorkspaceOverrides,
}: InsightsSettingsProps) {
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
      <p>{labels.externalLinksDescription}</p>
      <div className="workspace-insights__settings-controls">
        {canEditGlobal && (
          <label>
            {labels.settingsScope}
            <select
              aria-label={labels.settingsScope}
              value={effectiveScope}
              onChange={event => setScope(event.target.value as 'workspace' | 'global')}
            >
              <option value="workspace">{labels.workspaceOverrides}</option>
              <option value="global">{labels.globalDefaults}</option>
            </select>
          </label>
        )}
        <label>
          <input
            type="checkbox"
            aria-label={labels.externalLinksLabel}
            checked={effectiveSettings.externalLinks.enabled}
            onChange={event => changeSettings({ externalLinks: { enabled: event.target.checked } })}
          />
          {labels.externalLinksLabel}
        </label>
        <label>
          {labels.externalTimeout}
          <input
            type="number"
            min={3000}
            max={30000}
            step={1000}
            aria-label={labels.externalTimeout}
            value={effectiveSettings.externalLinks.timeoutMs}
            onChange={event => changeSettings({ externalLinks: { timeoutMs: numericValue(event.target.value, effectiveSettings.externalLinks.timeoutMs) } })}
          />
        </label>
        <label>
          {nearDuplicateLabel}
          <input
            type="number"
            min={50}
            max={100}
            step={1}
            aria-label={nearDuplicateLabel}
            value={Math.round(effectiveSettings.nearDuplicateThreshold * 100)}
            onChange={event => changeSettings({ nearDuplicateThreshold: numericValue(event.target.value, effectiveSettings.nearDuplicateThreshold * 100) / 100 })}
          />
        </label>
        <label>
          {labels.graphNodeCap}
          <input
            type="number"
            min={25}
            max={500}
            step={25}
            aria-label={labels.graphNodeCap}
            value={effectiveSettings.graphNodeCap}
            onChange={event => changeSettings({ graphNodeCap: numericValue(event.target.value, effectiveSettings.graphNodeCap) })}
          />
        </label>
        <label>
          {labels.sourceSoftLimit}
          <input
            type="number"
            min={1}
            max={64}
            step={1}
            aria-label={labels.sourceSoftLimit}
            value={Math.max(1, Math.round(effectiveSettings.sourceSoftLimitBytes / (1024 * 1024)))}
            onChange={event => changeSettings({ sourceSoftLimitBytes: numericValue(event.target.value, effectiveSettings.sourceSoftLimitBytes / (1024 * 1024)) * 1024 * 1024 })}
          />
        </label>
        {effectiveScope === 'global' && (
          <label>
            {labels.cacheCap}
            <input
              type="number"
              min={64}
              max={2048}
              step={64}
              aria-label={labels.cacheCap}
              value={Math.round(effectiveSettings.cacheCapBytes / (1024 * 1024))}
              onChange={event => onGlobalSettingsChange?.({ cacheCapBytes: numericValue(event.target.value, effectiveSettings.cacheCapBytes / (1024 * 1024)) * 1024 * 1024 })}
            />
          </label>
        )}
        <label>
          {labels.relationshipPreset}
          <select
            aria-label={labels.relationshipPreset}
            value={effectiveSettings.relationshipPreset}
            onChange={event => changeSettings({ relationshipPreset: event.target.value as InsightsSettings['relationshipPreset'] })}
          >
            <option value="default">Default</option>
            <option value="link-focused">Link-focused</option>
            <option value="tag-focused">Tag-focused</option>
            <option value="terminology-focused">Terminology-focused</option>
            <option value="custom">Custom</option>
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
                {label}
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  aria-label={label}
                  value={effectiveSettings.relationshipWeights[key]}
                  onChange={event => updateRelationshipWeight(key, event.target.value)}
                />
              </label>
            ))}
          </div>
        )}
        <label>
          {labels.includeExcludePatterns}
          <textarea
            aria-label={labels.includeExcludePatterns}
            value={userPatternsDraft}
            onChange={event => updatePatterns('userPatterns', event.target.value)}
          />
        </label>
        <label>
          {labels.oversizedPatterns}
          <textarea
            aria-label={labels.oversizedPatterns}
            value={oversizedPatternsDraft}
            onChange={event => updatePatterns('oversizedPatterns', event.target.value)}
          />
        </label>
        {patternError && <div role="alert" className="workspace-insights__settings-error">{patternError}</div>}
        <fieldset className="workspace-insights__settings-lint">
          <legend>{labels.lint}</legend>
          {Object.entries(INSIGHTS_LINT_RULE_DEFAULTS).map(([ruleId, defaultSeverity]) => {
            const config = effectiveSettings.lintRules[ruleId] ?? { enabled: true, severity: defaultSeverity };
            return (
              <div key={ruleId} className="workspace-insights__settings-lint-rule">
                <label>
                  <input
                    type="checkbox"
                    aria-label={`${labels.rule}: ${ruleId}`}
                    checked={config.enabled}
                    onChange={event => updateLintRule(ruleId, { enabled: event.target.checked })}
                  />
                  {ruleId}
                </label>
                <select
                  aria-label={`${labels.severity}: ${ruleId}`}
                  value={config.severity}
                  onChange={event => updateLintRule(ruleId, { severity: event.target.value as 'info' | 'warning' | 'error' })}
                >
                  <option value="error">{labels.error}</option>
                  <option value="warning">{labels.warning}</option>
                  <option value="info">{labels.info}</option>
                </select>
              </div>
            );
          })}
        </fieldset>
        {effectiveScope === 'workspace' && onResetWorkspaceOverrides && (
          <button type="button" className="btn btn--sm" onClick={onResetWorkspaceOverrides}>{labels.resetWorkspace}</button>
        )}
      </div>
      <dl className="workspace-insights__settings-summary">
        <div><dt>{labels.networkSession}</dt><dd>{session.approvedPrivateOrigins.size}</dd></div>
        <div><dt>{labels.cacheCap}</dt><dd>{Math.round(effectiveSettings.cacheCapBytes / (1024 * 1024))} MiB</dd></div>
      </dl>
    </section>
  );
}
