import { INSIGHTS_SETTINGS_STORAGE_KEY } from '../constants/storage';
import {
  normalizeInsightsSettingsExport,
  resetWorkspaceInsightsOverrides,
  type InsightsSettingsExportConfig,
  type InsightsSettingsInput,
  type InsightsWorkspaceOverrides,
} from './config';

export const INSIGHTS_SETTINGS_CHANGED_EVENT = 'markdown-explorer:workspace-insights-settings-changed';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultConfig(): InsightsSettingsExportConfig {
  return normalizeInsightsSettingsExport(undefined);
}

function safeStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function loadInsightsSettingsConfig(storage?: StorageLike): InsightsSettingsExportConfig {
  const target = safeStorage(storage);
  if (!target) return defaultConfig();
  try {
    const raw = target.getItem(INSIGHTS_SETTINGS_STORAGE_KEY);
    return raw ? normalizeInsightsSettingsExport(JSON.parse(raw)) : defaultConfig();
  } catch {
    return defaultConfig();
  }
}

export function saveInsightsSettingsConfig(
  config: InsightsSettingsExportConfig,
  storage?: StorageLike,
): InsightsSettingsExportConfig {
  const normalized = normalizeInsightsSettingsExport(config);
  const target = safeStorage(storage);
  if (target) {
    try { target.setItem(INSIGHTS_SETTINGS_STORAGE_KEY, JSON.stringify(normalized)); } catch { /* ignore unavailable/quota-limited storage */ }
  }
  return normalized;
}

export function updateGlobalInsightsSettings(
  config: InsightsSettingsExportConfig,
  patch: InsightsSettingsInput,
): InsightsSettingsExportConfig {
  const current = config.globalDefaults;
  return normalizeInsightsSettingsExport({
    ...config,
    globalDefaults: {
      ...current,
      ...patch,
      externalLinks: { ...current.externalLinks, ...patch.externalLinks },
      relationshipWeights: { ...current.relationshipWeights, ...patch.relationshipWeights },
      lintRules: patch.lintRules ?? current.lintRules,
      lintSuppressions: patch.lintSuppressions ?? current.lintSuppressions,
      duplicateSuppressions: patch.duplicateSuppressions ?? current.duplicateSuppressions,
    },
  });
}

export function updateWorkspaceInsightsSettings(
  config: InsightsSettingsExportConfig,
  workspaceId: string,
  patch: InsightsWorkspaceOverrides,
): InsightsSettingsExportConfig {
  const key = workspaceId.trim().slice(0, 512);
  if (!key) return normalizeInsightsSettingsExport(config);
  const current = config.workspaceOverrides[key] ?? {};
  return normalizeInsightsSettingsExport({
    ...config,
    workspaceOverrides: {
      ...config.workspaceOverrides,
      [key]: {
        ...current,
        ...patch,
        externalLinks: patch.externalLinks ? { ...current.externalLinks, ...patch.externalLinks } : current.externalLinks,
        relationshipWeights: patch.relationshipWeights ? { ...current.relationshipWeights, ...patch.relationshipWeights } : current.relationshipWeights,
        lintRules: patch.lintRules ?? current.lintRules,
        lintSuppressions: patch.lintSuppressions ?? current.lintSuppressions,
        duplicateSuppressions: patch.duplicateSuppressions ?? current.duplicateSuppressions,
      },
    },
  });
}

export function resetWorkspaceInsightsSettings(
  config: InsightsSettingsExportConfig,
  workspaceId: string,
): InsightsSettingsExportConfig {
  return normalizeInsightsSettingsExport({
    ...config,
    workspaceOverrides: resetWorkspaceInsightsOverrides(config.workspaceOverrides, workspaceId),
  });
}

export function announceInsightsSettingsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(INSIGHTS_SETTINGS_CHANGED_EVENT));
}
