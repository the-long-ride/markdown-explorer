import { describe, expect, it, vi } from 'vitest';
import {
  exportRuntimeBundleNames,
  loadExportRuntimeAssets,
} from '../../../../ui/src/export/exportRuntimeAssets';
import type { ExportFeature } from '../../../../ui/src/export/exportSnapshot';

describe('export runtime asset selection', () => {
  it('selects only the required bundles in dependency order', () => {
    expect(exportRuntimeBundleNames(new Set<ExportFeature>(['core']))).toEqual(['core']);
    expect(exportRuntimeBundleNames(new Set<ExportFeature>(['core', 'mediaModal', 'htmlPreview']))).toEqual([
      'core', 'html-preview', 'media',
    ]);
    expect(exportRuntimeBundleNames(new Set<ExportFeature>(['core', 'charts']))).toEqual(['core', 'table', 'charts']);
  });

  it('loads local bundle text once per URL and reports missing assets clearly', async () => {
    const readText = vi.fn(async (url: string) => `runtime:${url}`);
    const cache = new Map<string, Promise<string>>();
    const features = new Set<ExportFeature>(['core', 'dataTable']);

    const first = await loadExportRuntimeAssets(features, {
      baseUrl: 'https://local.invalid/export-runtime/', readText, cache,
    });
    const second = await loadExportRuntimeAssets(features, {
      baseUrl: 'https://local.invalid/export-runtime/', readText, cache,
    });

    expect(first.map((asset) => asset.fileName)).toEqual(['core.js', 'table.js']);
    expect(second.map((asset) => asset.code)).toEqual(first.map((asset) => asset.code));
    expect(readText).toHaveBeenCalledTimes(2);

    await expect(loadExportRuntimeAssets(new Set<ExportFeature>(['core']), {
      baseUrl: 'https://missing.invalid/export-runtime/',
      readText: async () => { throw new Error('not built'); },
      cache: new Map(),
    })).rejects.toThrow('not built');
  });
});
