import { describe, expect, it } from 'vitest';
import { normalizeInsightsSettings, normalizeInsightsSettingsExport, resetWorkspaceInsightsOverrides } from '../../../../ui/src/insights/config';

describe('insights settings export normalization', () => {
  it('normalizes workspace overrides and skips invalid entries', () => {
    const result = normalizeInsightsSettingsExport({
      globalDefaults: { duplicateSuppressions: [' a ', 'a', 3, ''], lintSuppressions: [
        null, [], { scope: 'finding', findingId: ' f1 ' }, { scope: 'finding', findingId: 'f1' },
        { scope: 'path-rule', path: ' p.md ', ruleId: ' r ' }, { scope: 'path-rule', path: '', ruleId: 'r' }, { scope: 'other' },
      ], lintRules: { ' ': { enabled: true }, r1: null as any, r2: { enabled: false, severity: 'loud' as any }, r3: { severity: 'error' } } },
      workspaceOverrides: {
        ' ': { graphNodeCap: 1 },
        list: [],
        empty: {},
        full: {
          externalLinks: { enabled: 1, timeoutMs: 999_999 }, sourceSoftLimitBytes: 0.4, userPatterns: [' x/** ', 7], oversizedPatterns: ['big/**'],
          nearDuplicateThreshold: 2, duplicateSuppressions: ['d'], graphNodeCap: 9999, relationshipPreset: 'custom',
          relationshipWeights: { links: 5 }, lintRules: { r: { enabled: true } }, lintSuppressions: [{ scope: 'finding', findingId: 'x' }],
        },
        links: { externalLinks: { enabled: true } },
      },
    });
    expect(Object.keys(result.workspaceOverrides).sort()).toEqual(['empty', 'full', 'links']);
    const full = result.workspaceOverrides.full as any;
    expect(full.externalLinks).toEqual({ enabled: false, timeoutMs: 30_000 });
    expect(full.sourceSoftLimitBytes).toBe(1);
    expect(full.nearDuplicateThreshold).toBe(1);
    expect(full.graphNodeCap).toBe(500);
    expect(result.workspaceOverrides.links).toEqual({ externalLinks: { enabled: true } });
    expect(result.globalDefaults.duplicateSuppressions).toEqual(['a']);
    expect(result.globalDefaults.lintSuppressions).toHaveLength(2);
    expect(resetWorkspaceInsightsOverrides(result.workspaceOverrides, 'full')).not.toHaveProperty('full');
  });

  it('handles non-object exports and caps suppressions', () => {
    expect(normalizeInsightsSettingsExport(null).workspaceOverrides).toEqual({});
    expect(normalizeInsightsSettingsExport({ globalDefaults: 1, workspaceOverrides: [] }).workspaceOverrides).toEqual({});
    const many = Array.from({ length: 2000 }, (_, i) => `s${i}`);
    const settings = normalizeInsightsSettings({ duplicateSuppressions: many, lintSuppressions: many.map((id) => ({ scope: 'finding', findingId: id })) as any, userPatterns: 'no' as any });
    expect(settings.duplicateSuppressions.length).toBeLessThanOrEqual(2000);
    expect(settings.lintSuppressions.length).toBeLessThan(2000);
  });
});
