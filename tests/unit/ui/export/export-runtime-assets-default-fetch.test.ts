import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function load() {
  return import('../../../../ui/src/export/exportRuntimeAssets');
}

describe('loadExportRuntimeAssets default fetch reader', () => {
  it('fetches runtime bundles relative to the document base url', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => 'console.log(1)' }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadExportRuntimeAssets } = await load();
    const assets = await loadExportRuntimeAssets(new Set());
    expect(assets).toEqual([{ name: 'core', fileName: 'core.js', code: 'console.log(1)' }]);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/export-runtime/core.js');
  });

  it('rejects failed responses and evicts them from the cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => '' })));
    const { loadExportRuntimeAssets } = await load();
    await expect(loadExportRuntimeAssets(new Set())).rejects.toThrow('Unable to load export runtime asset');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'ok' })));
    await expect(loadExportRuntimeAssets(new Set())).resolves.toHaveLength(1);
  });

  it('rejects empty runtime assets', async () => {
    const { loadExportRuntimeAssets } = await load();
    await expect(loadExportRuntimeAssets(new Set(), { baseUrl: 'http://x/', readText: async () => '  ', cache: new Map() }))
      .rejects.toThrow('Export runtime asset is empty: core.js');
  });
});
