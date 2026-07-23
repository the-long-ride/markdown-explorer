import { describe, expect, test, vi, beforeEach } from 'vitest';
import { refreshPanelFromWatch } from '../../../vscode/src/core/panelWatch';

vi.mock('../../../vscode/src/core/incrementalScan', () => ({
  scanWorkspaceIncrementally: vi.fn(async (opts: any) => {
    if (!opts.isCurrent()) return null;
    opts.onProgress(1);
    const snap = { fileList: [], tree: null };
    opts.onReveal(snap);
    opts.onChanged(snap);
    return { flat: [{ fsPath: '/ws/a.md', relativePath: 'a.md' }], tree: null };
  }),
}));

const scanned = await import('../../../vscode/src/core/incrementalScan');

function makeHost(overrides: Partial<Parameters<typeof refreshPanelFromWatch>[0]> = {}) {
  const postMessage = vi.fn();
  return {
    documentConversionEnabled: false,
    currentFile: '/ws/a.md',
    workspaceName: 'ws',
    postMessage,
    bumpScanGeneration: () => 5,
    isCurrentScan: () => true,
    setFlat: vi.fn(),
    scanGeneration: 1,
    ...overrides,
  };
}

describe('refreshPanelFromWatch', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('posts workspaceScanProgress + workspaceFilesChanged + final progress + currentFileChanged', async () => {
    const host = makeHost();
    await refreshPanelFromWatch(host as any, '/ws/a.md');
    const commands = host.postMessage.mock.calls.map((c: any) => c[0]?.command);
    expect(commands).toContain('workspaceScanProgress');
    expect(commands).toContain('workspaceFilesChanged');
    expect(commands).toContain('currentFileChanged');
    const changed = host.postMessage.mock.calls.find((c: any) => c[0]?.command === 'currentFileChanged');
    expect(changed?.[0]?.filePath).toBe('/ws/a.md');
  });

  test('does NOT emit currentFileChanged when path does not match currentFile', async () => {
    const host = makeHost();
    await refreshPanelFromWatch(host as any, '/ws/other.md');
    const changed = host.postMessage.mock.calls.find((c: any) => c[0]?.command === 'currentFileChanged');
    expect(changed).toBeUndefined();
  });

  test('does not emit currentFileChanged when changedPath is empty/null', async () => {
    const host = makeHost();
    await refreshPanelFromWatch(host as any, null);
    const changed = host.postMessage.mock.calls.find((c: any) => c[0]?.command === 'currentFileChanged');
    expect(changed).toBeUndefined();
  });

  test('respects isCurrentScan cancellation via publish guard', async () => {
    const setFlat = vi.fn();
    const host = makeHost({ isCurrentScan: () => false, setFlat });
    await refreshPanelFromWatch(host as any, '/ws/a.md');
    expect(setFlat).not.toHaveBeenCalled();
  });

  test('handles null result from scan', async () => {
    vi.mocked(scanned.scanWorkspaceIncrementally).mockResolvedValueOnce(null as any);
    const host = makeHost();
    await refreshPanelFromWatch(host as any, '/ws/a.md');
    expect(host.postMessage).toHaveBeenCalled();
  });
});
