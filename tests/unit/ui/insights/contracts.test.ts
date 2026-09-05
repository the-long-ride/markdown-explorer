import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INSIGHTS_SETTINGS,
  normalizeInsightsSettings,
} from '../../../../ui/src/insights/config';

import type {
  InsightsWorkspaceEntry,
  WorkspaceResourceProbeResult,
  ExternalLinkCheckRequest,
  ExternalLinkCheckResult,
} from '../../../../ui/src/insights/contracts';

describe('workspace insights contracts', () => {
  it('uses approved safety and UX defaults', () => {
    expect(DEFAULT_INSIGHTS_SETTINGS.externalLinks.enabled).toBe(false);
    expect(DEFAULT_INSIGHTS_SETTINGS.externalLinks.timeoutMs).toBe(10_000);
    expect(DEFAULT_INSIGHTS_SETTINGS.sourceSoftLimitBytes).toBe(10 * 1024 * 1024);
    expect(DEFAULT_INSIGHTS_SETTINGS.sourceHardLimitBytes).toBe(64 * 1024 * 1024);
    expect(DEFAULT_INSIGHTS_SETTINGS.nearDuplicateThreshold).toBe(0.90);
    expect(DEFAULT_INSIGHTS_SETTINGS.graphNodeCap).toBe(100);
    expect(DEFAULT_INSIGHTS_SETTINGS.cacheCapBytes).toBe(500 * 1024 * 1024);
  });

  it('clamps external timeout to 3-30 seconds', () => {
    expect(normalizeInsightsSettings({ externalLinks: { timeoutMs: 100 } }).externalLinks.timeoutMs).toBe(3_000);
    expect(normalizeInsightsSettings({ externalLinks: { timeoutMs: 90_000 } }).externalLinks.timeoutMs).toBe(30_000);
  });

  it('keeps source hard limit non-overridable', () => {
    const normalized = normalizeInsightsSettings({
      sourceHardLimitBytes: 999 * 1024 * 1024,
      sourceSoftLimitBytes: 20 * 1024 * 1024,
    });
    expect(normalized.sourceHardLimitBytes).toBe(64 * 1024 * 1024);
    expect(normalized.sourceSoftLimitBytes).toBe(20 * 1024 * 1024);
  });

  it('exports the stable protocol shapes used by hosts', () => {
    const entry: InsightsWorkspaceEntry = {
      relativePath: 'docs/a.md',
      canonicalRelativePath: 'docs/a.md',
      kind: 'file',
      sizeBytes: 12,
      mtimeMs: 1,
    };
    const probe: WorkspaceResourceProbeResult = { status: 'exists', relativePath: 'img.png', kind: 'file' };
    const request: ExternalLinkCheckRequest = { requestId: 'x', urls: ['https://example.test'], timeoutMs: 10_000 };
    const result: ExternalLinkCheckResult = { requestId: 'x', url: request.urls[0], status: 'reachable' };
    expect(entry.kind).toBe('file');
    expect(probe.status).toBe('exists');
    expect(result.status).toBe('reachable');
  });
});
