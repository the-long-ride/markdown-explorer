export type InsightsLintSeverity = 'info' | 'warning' | 'error';

export type InsightsLintSuppressionConfig =
  | { readonly scope: 'finding'; readonly findingId: string }
  | { readonly scope: 'path-rule'; readonly path: string; readonly ruleId: string }
  | { readonly scope: 'rule'; readonly ruleId: string };

export interface InsightsRelationshipWeights {
  readonly links: number;
  readonly tags: number;
  readonly headings: number;
  readonly title: number;
  readonly terminology: number;
}

export interface InsightsSettings {
  readonly externalLinks: {
    readonly enabled: boolean;
    readonly timeoutMs: number;
  };
  readonly sourceSoftLimitBytes: number;
  readonly sourceHardLimitBytes: number;
  readonly userPatterns: readonly string[];
  readonly oversizedPatterns: readonly string[];
  readonly nearDuplicateThreshold: number;
  readonly duplicateSuppressions: readonly string[];
  readonly graphNodeCap: number;
  readonly cacheCapBytes: number;
  readonly relationshipPreset: 'default' | 'link-focused' | 'tag-focused' | 'terminology-focused' | 'custom';
  readonly relationshipWeights: InsightsRelationshipWeights;
  readonly lintRules: Readonly<Record<string, { readonly enabled: boolean; readonly severity: InsightsLintSeverity }>>;
  readonly lintSuppressions: readonly InsightsLintSuppressionConfig[];
}

export interface InsightsWorkspaceOverrides {
  readonly externalLinks?: Partial<InsightsSettings['externalLinks']>;
  readonly sourceSoftLimitBytes?: number;
  readonly userPatterns?: readonly string[];
  readonly oversizedPatterns?: readonly string[];
  readonly nearDuplicateThreshold?: number;
  readonly duplicateSuppressions?: readonly string[];
  readonly graphNodeCap?: number;
  readonly relationshipPreset?: InsightsSettings['relationshipPreset'];
  readonly relationshipWeights?: Partial<InsightsRelationshipWeights>;
  readonly lintRules?: InsightsSettings['lintRules'];
  readonly lintSuppressions?: readonly InsightsLintSuppressionConfig[];
}

export interface InsightsSettingsInput extends Partial<Omit<InsightsSettings, 'externalLinks' | 'relationshipWeights' | 'lintRules'>> {
  readonly externalLinks?: Partial<InsightsSettings['externalLinks']>;
  readonly relationshipWeights?: Partial<InsightsRelationshipWeights>;
  readonly lintRules?: Readonly<Record<string, Partial<{ readonly enabled: boolean; readonly severity: InsightsLintSeverity }>>>;
}

export interface InsightsSettingsExportConfig {
  readonly globalDefaults: InsightsSettingsInput;
  readonly workspaceOverrides: Readonly<Record<string, InsightsWorkspaceOverrides>>;
}

const MIB = 1024 * 1024;
const SOURCE_HARD_LIMIT_BYTES = 64 * MIB;
const MAX_SUPPRESSIONS = 5_000;

export const DEFAULT_INSIGHTS_SETTINGS: InsightsSettings = Object.freeze({
  externalLinks: Object.freeze({ enabled: false, timeoutMs: 10_000 }),
  sourceSoftLimitBytes: 10 * MIB,
  sourceHardLimitBytes: SOURCE_HARD_LIMIT_BYTES,
  userPatterns: Object.freeze([]),
  oversizedPatterns: Object.freeze([]),
  nearDuplicateThreshold: 0.90,
  duplicateSuppressions: Object.freeze([]),
  graphNodeCap: 100,
  cacheCapBytes: 500 * MIB,
  relationshipPreset: 'default',
  relationshipWeights: Object.freeze({
    links: 35,
    tags: 20,
    headings: 15,
    title: 10,
    terminology: 20,
  }),
  lintRules: Object.freeze({}),
  lintSuppressions: Object.freeze([]),
});

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePatterns(value: unknown, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.flatMap((item) => typeof item === 'string' && item.trim() ? [item.trim()] : []);
}

function normalizeStringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim().slice(0, 2_048);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= MAX_SUPPRESSIONS) break;
  }
  return result;
}

function normalizeLintSuppressions(value: unknown): readonly InsightsLintSuppressionConfig[] {
  if (!Array.isArray(value)) return [];
  const result: InsightsLintSuppressionConfig[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    let suppression: InsightsLintSuppressionConfig | undefined;
    if (raw.scope === 'finding' && typeof raw.findingId === 'string' && raw.findingId.trim()) {
      suppression = { scope: 'finding', findingId: raw.findingId.trim().slice(0, 512) };
    } else if (raw.scope === 'rule' && typeof raw.ruleId === 'string' && raw.ruleId.trim()) {
      suppression = { scope: 'rule', ruleId: raw.ruleId.trim().slice(0, 256) };
    } else if (raw.scope === 'path-rule' && typeof raw.path === 'string' && raw.path.trim() && typeof raw.ruleId === 'string' && raw.ruleId.trim()) {
      suppression = { scope: 'path-rule', path: raw.path.trim().slice(0, 2_048), ruleId: raw.ruleId.trim().slice(0, 256) };
    }
    if (!suppression) continue;
    const key = JSON.stringify(suppression);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(suppression);
    if (result.length >= MAX_SUPPRESSIONS) break;
  }
  return result;
}

function normalizeWeights(value: Partial<InsightsRelationshipWeights> | undefined): InsightsRelationshipWeights {
  const defaults = DEFAULT_INSIGHTS_SETTINGS.relationshipWeights;
  return {
    links: Math.max(0, finiteNumber(value?.links, defaults.links)),
    tags: Math.max(0, finiteNumber(value?.tags, defaults.tags)),
    headings: Math.max(0, finiteNumber(value?.headings, defaults.headings)),
    title: Math.max(0, finiteNumber(value?.title, defaults.title)),
    terminology: Math.max(0, finiteNumber(value?.terminology, defaults.terminology)),
  };
}

function normalizeLintRules(value: InsightsSettingsInput['lintRules']): InsightsSettings['lintRules'] {
  if (!value || typeof value !== 'object') return {};
  const severities = new Set<InsightsLintSeverity>(['info', 'warning', 'error']);
  return Object.fromEntries(Object.entries(value).flatMap(([rule, config]) => {
    if (!rule.trim() || !config || typeof config !== 'object') return [];
    const severity = severities.has(config.severity as InsightsLintSeverity)
      ? config.severity as InsightsLintSeverity
      : 'warning';
    return [[rule.slice(0, 256), { enabled: config.enabled !== false, severity }] as const];
  }));
}

export function normalizeInsightsSettings(input: InsightsSettingsInput = {}): InsightsSettings {
  const timeoutMs = clamp(
    finiteNumber(input.externalLinks?.timeoutMs, DEFAULT_INSIGHTS_SETTINGS.externalLinks.timeoutMs),
    3_000,
    30_000,
  );
  const softLimit = clamp(
    Math.round(finiteNumber(input.sourceSoftLimitBytes, DEFAULT_INSIGHTS_SETTINGS.sourceSoftLimitBytes)),
    1,
    SOURCE_HARD_LIMIT_BYTES,
  );
  const preset = input.relationshipPreset;
  const validPreset = preset === 'default' || preset === 'link-focused' || preset === 'tag-focused'
    || preset === 'terminology-focused' || preset === 'custom';

  return {
    externalLinks: {
      enabled: input.externalLinks?.enabled === true,
      timeoutMs,
    },
    sourceSoftLimitBytes: softLimit,
    sourceHardLimitBytes: SOURCE_HARD_LIMIT_BYTES,
    userPatterns: normalizePatterns(input.userPatterns, DEFAULT_INSIGHTS_SETTINGS.userPatterns),
    oversizedPatterns: normalizePatterns(input.oversizedPatterns, DEFAULT_INSIGHTS_SETTINGS.oversizedPatterns),
    nearDuplicateThreshold: clamp(
      finiteNumber(input.nearDuplicateThreshold, DEFAULT_INSIGHTS_SETTINGS.nearDuplicateThreshold),
      0.5,
      1,
    ),
    duplicateSuppressions: normalizeStringList(input.duplicateSuppressions),
    graphNodeCap: Math.round(clamp(
      finiteNumber(input.graphNodeCap, DEFAULT_INSIGHTS_SETTINGS.graphNodeCap),
      25,
      500,
    )),
    cacheCapBytes: Math.round(clamp(
      finiteNumber(input.cacheCapBytes, DEFAULT_INSIGHTS_SETTINGS.cacheCapBytes),
      64 * MIB,
      2 * 1024 * MIB,
    )),
    relationshipPreset: validPreset ? preset : DEFAULT_INSIGHTS_SETTINGS.relationshipPreset,
    relationshipWeights: normalizeWeights(input.relationshipWeights),
    lintRules: normalizeLintRules(input.lintRules),
    lintSuppressions: normalizeLintSuppressions(input.lintSuppressions),
  };
}

/** Precedence: workspace override -> global user defaults -> built-in defaults. */
export function resolveInsightsSettings(
  globalDefaults: InsightsSettingsInput = {},
  workspaceOverrides: InsightsWorkspaceOverrides = {},
): InsightsSettings {
  const global = normalizeInsightsSettings(globalDefaults);
  return normalizeInsightsSettings({
    ...global,
    ...workspaceOverrides,
    externalLinks: { ...global.externalLinks, ...workspaceOverrides.externalLinks },
    relationshipWeights: { ...global.relationshipWeights, ...workspaceOverrides.relationshipWeights },
    lintRules: workspaceOverrides.lintRules ?? global.lintRules,
    lintSuppressions: workspaceOverrides.lintSuppressions ?? global.lintSuppressions,
    duplicateSuppressions: workspaceOverrides.duplicateSuppressions ?? global.duplicateSuppressions,
  });
}

export function resetWorkspaceInsightsOverrides(
  overrides: Readonly<Record<string, InsightsWorkspaceOverrides>>,
  workspaceId: string,
): Record<string, InsightsWorkspaceOverrides> {
  const next = { ...overrides };
  delete next[workspaceId];
  return next;
}

function normalizeWorkspaceOverride(candidate: unknown): InsightsWorkspaceOverrides | undefined {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;
  const resolved = candidate as InsightsWorkspaceOverrides;
  return {
    ...(resolved.externalLinks ? { externalLinks: { enabled: resolved.externalLinks.enabled === true, ...(typeof resolved.externalLinks.timeoutMs === 'number' ? { timeoutMs: clamp(resolved.externalLinks.timeoutMs, 3_000, 30_000) } : {}) } } : {}),
    ...(typeof resolved.sourceSoftLimitBytes === 'number' ? { sourceSoftLimitBytes: clamp(Math.round(resolved.sourceSoftLimitBytes), 1, SOURCE_HARD_LIMIT_BYTES) } : {}),
    ...(Array.isArray(resolved.userPatterns) ? { userPatterns: normalizePatterns(resolved.userPatterns, []) } : {}),
    ...(Array.isArray(resolved.oversizedPatterns) ? { oversizedPatterns: normalizePatterns(resolved.oversizedPatterns, []) } : {}),
    ...(typeof resolved.nearDuplicateThreshold === 'number' ? { nearDuplicateThreshold: clamp(resolved.nearDuplicateThreshold, 0.5, 1) } : {}),
    ...(Array.isArray(resolved.duplicateSuppressions) ? { duplicateSuppressions: normalizeStringList(resolved.duplicateSuppressions) } : {}),
    ...(typeof resolved.graphNodeCap === 'number' ? { graphNodeCap: Math.round(clamp(resolved.graphNodeCap, 25, 500)) } : {}),
    ...(resolved.relationshipPreset ? { relationshipPreset: resolved.relationshipPreset } : {}),
    ...(resolved.relationshipWeights ? { relationshipWeights: normalizeWeights(resolved.relationshipWeights) } : {}),
    ...(resolved.lintRules ? { lintRules: normalizeLintRules(resolved.lintRules) } : {}),
    ...(Array.isArray(resolved.lintSuppressions) ? { lintSuppressions: normalizeLintSuppressions(resolved.lintSuppressions) } : {}),
  };
}

export function normalizeInsightsSettingsExport(value: unknown): InsightsSettingsExportConfig {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const globalRaw = raw.globalDefaults && typeof raw.globalDefaults === 'object' ? raw.globalDefaults as InsightsSettingsInput : {};
  const workspaceRaw = raw.workspaceOverrides && typeof raw.workspaceOverrides === 'object' && !Array.isArray(raw.workspaceOverrides)
    ? raw.workspaceOverrides as Record<string, unknown>
    : {};
  const workspaceOverrides: Record<string, InsightsWorkspaceOverrides> = {};
  for (const [key, candidate] of Object.entries(workspaceRaw)) {
    if (!key.trim()) continue;
    const normalized = normalizeWorkspaceOverride(candidate);
    if (normalized) workspaceOverrides[key.slice(0, 512)] = normalized;
  }
  const normalizedGlobal = normalizeInsightsSettings(globalRaw);
  return {
    globalDefaults: {
      externalLinks: normalizedGlobal.externalLinks,
      sourceSoftLimitBytes: normalizedGlobal.sourceSoftLimitBytes,
      userPatterns: normalizedGlobal.userPatterns,
      oversizedPatterns: normalizedGlobal.oversizedPatterns,
      nearDuplicateThreshold: normalizedGlobal.nearDuplicateThreshold,
      duplicateSuppressions: normalizedGlobal.duplicateSuppressions,
      graphNodeCap: normalizedGlobal.graphNodeCap,
      cacheCapBytes: normalizedGlobal.cacheCapBytes,
      relationshipPreset: normalizedGlobal.relationshipPreset,
      relationshipWeights: normalizedGlobal.relationshipWeights,
      lintRules: normalizedGlobal.lintRules,
      lintSuppressions: normalizedGlobal.lintSuppressions,
    },
    workspaceOverrides,
  };
}
