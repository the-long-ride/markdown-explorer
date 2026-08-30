import { beforeEach, describe, expect, it } from 'vitest';
import { createSettingsExport, parseSettingsImport } from '../../../../ui/src/settings/settingsImportExport';
import {
  loadInsightsSettingsConfig,
  saveInsightsSettingsConfig,
} from '../../../../ui/src/insights/settingsStore';
import type { AppSettings } from '../../../../ui/src/types';

const settings: AppSettings = {
  showTitle: false,
  defaultHtmlPreview: true,
  defaultHtmlCodeBlockPreview: true,
  defaultCsvPreview: true,
  fileTabs: false,
  bookmarksEnabled: false,
  documentConversion: false,
};

describe('Workspace Insights settings portability', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips global defaults and per-workspace overrides in settings JSON', () => {
    const envelope = createSettingsExport({
      theme: 'auto',
      themeStyle: 'default',
      settings,
      recentWorkspaces: [],
      insights: {
        globalDefaults: {
          externalLinks: { enabled: false, timeoutMs: 12_000 },
          graphNodeCap: 120,
        },
        workspaceOverrides: {
          'workspace-demo': {
            externalLinks: { enabled: true, timeoutMs: 9_000 },
            nearDuplicateThreshold: 0.93,
            lintSuppressions: [{ scope: 'path-rule', path: 'guide.md', ruleId: 'heading/duplicate' }],
            duplicateSuppressions: ['exact:abc'],
          },
        },
      },
    });

    const imported = parseSettingsImport(JSON.stringify(envelope), false);
    expect(imported.insights?.globalDefaults.externalLinks).toEqual({ enabled: false, timeoutMs: 12_000 });
    expect(imported.insights?.workspaceOverrides['workspace-demo']).toEqual(expect.objectContaining({
      externalLinks: { enabled: true, timeoutMs: 9_000 },
      nearDuplicateThreshold: 0.93,
      duplicateSuppressions: ['exact:abc'],
    }));
  });

  it('uses the persisted Insights store for normal Settings export', () => {
    saveInsightsSettingsConfig({
      globalDefaults: { graphNodeCap: 175, externalLinks: { enabled: false, timeoutMs: 11_000 } },
      workspaceOverrides: { 'workspace-demo': { nearDuplicateThreshold: 0.94 } },
    });
    const envelope = createSettingsExport({ theme: 'auto', themeStyle: 'default', settings, recentWorkspaces: [] });
    expect(envelope.payload.insights.globalDefaults.graphNodeCap).toBe(175);
    expect(envelope.payload.insights.workspaceOverrides['workspace-demo']?.nearDuplicateThreshold).toBe(0.94);
  });

  it('parses imported Insights settings without mutating storage', () => {
    saveInsightsSettingsConfig({ globalDefaults: { graphNodeCap: 225 }, workspaceOverrides: {} });
    const envelope = createSettingsExport({
      theme: 'auto', themeStyle: 'default', settings, recentWorkspaces: [],
      insights: { globalDefaults: { graphNodeCap: 175 }, workspaceOverrides: {} },
    });
    const imported = parseSettingsImport(JSON.stringify(envelope), false);
    expect(imported.insights?.globalDefaults.graphNodeCap).toBe(175);
    expect(loadInsightsSettingsConfig().globalDefaults.graphNodeCap).toBe(225);
  });

  it('does not synthesize Insights data for an older backup without Insights', () => {
    saveInsightsSettingsConfig({ globalDefaults: { graphNodeCap: 225 }, workspaceOverrides: {} });
    const envelope = createSettingsExport({ theme: 'auto', themeStyle: 'default', settings, recentWorkspaces: [], insights: {} });
    const legacyEnvelope = { ...envelope, payload: { ...envelope.payload } } as any;
    delete legacyEnvelope.payload.insights;
    const imported = parseSettingsImport(JSON.stringify(legacyEnvelope), false);
    expect(imported.insights).toBeUndefined();
    expect(loadInsightsSettingsConfig().globalDefaults.graphNodeCap).toBe(225);
  });

  it('never imports a configurable replacement for the absolute 64 MiB safety ceiling', () => {
    const envelope = createSettingsExport({
      theme: 'auto', themeStyle: 'default', settings, recentWorkspaces: [],
      insights: { globalDefaults: { sourceHardLimitBytes: 1024 * 1024 * 1024 }, workspaceOverrides: {} } as any,
    });
    const imported = parseSettingsImport(JSON.stringify(envelope), false);
    expect(imported.insights?.globalDefaults.sourceHardLimitBytes).toBeUndefined();
  });
});
