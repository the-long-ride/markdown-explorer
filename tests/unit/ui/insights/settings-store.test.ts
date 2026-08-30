import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadInsightsSettingsConfig,
  resetWorkspaceInsightsSettings,
  saveInsightsSettingsConfig,
  updateGlobalInsightsSettings,
  updateWorkspaceInsightsSettings,
} from '../../../../ui/src/insights/settingsStore';
import { resolveInsightsSettings } from '../../../../ui/src/insights/config';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('Workspace Insights settings store', () => {
  let storage: MemoryStorage;

  beforeEach(() => { storage = new MemoryStorage(); });

  it('defaults external checks off and preserves the hard source ceiling', () => {
    const config = loadInsightsSettingsConfig(storage);
    const effective = resolveInsightsSettings(config.globalDefaults, config.workspaceOverrides.demo);
    expect(effective.externalLinks.enabled).toBe(false);
    expect(effective.sourceHardLimitBytes).toBe(64 * 1024 * 1024);
  });

  it('persists global defaults and workspace overrides independently', () => {
    let config = loadInsightsSettingsConfig(storage);
    config = updateGlobalInsightsSettings(config, { sourceSoftLimitBytes: 12 * 1024 * 1024 });
    config = updateWorkspaceInsightsSettings(config, 'workspace-demo', {
      externalLinks: { enabled: true, timeoutMs: 15_000 },
      nearDuplicateThreshold: 0.94,
      userPatterns: ['!vendor/docs/**'],
      lintSuppressions: [{ scope: 'rule', ruleId: 'heading/duplicate' }],
      duplicateSuppressions: ['near:a.md\u0000b.md'],
    });
    saveInsightsSettingsConfig(config, storage);

    const restored = loadInsightsSettingsConfig(storage);
    const effective = resolveInsightsSettings(restored.globalDefaults, restored.workspaceOverrides['workspace-demo']);
    expect(effective.sourceSoftLimitBytes).toBe(12 * 1024 * 1024);
    expect(effective.externalLinks).toEqual({ enabled: true, timeoutMs: 15_000 });
    expect(effective.nearDuplicateThreshold).toBe(0.94);
    expect(effective.lintSuppressions).toEqual([{ scope: 'rule', ruleId: 'heading/duplicate' }]);
    expect(effective.duplicateSuppressions).toEqual(['near:a.md\u0000b.md']);
  });

  it('resets one workspace without changing global defaults', () => {
    let config = updateGlobalInsightsSettings(loadInsightsSettingsConfig(storage), { graphNodeCap: 140 });
    config = updateWorkspaceInsightsSettings(config, 'one', { graphNodeCap: 80 });
    config = updateWorkspaceInsightsSettings(config, 'two', { graphNodeCap: 60 });
    config = resetWorkspaceInsightsSettings(config, 'one');
    expect(resolveInsightsSettings(config.globalDefaults, config.workspaceOverrides.one).graphNodeCap).toBe(140);
    expect(resolveInsightsSettings(config.globalDefaults, config.workspaceOverrides.two).graphNodeCap).toBe(60);
  });
});
