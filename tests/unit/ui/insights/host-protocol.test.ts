import { describe, expect, it, vi } from 'vitest';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';
import type { InsightsWorkspaceEntry } from '../../../../ui/src/insights/contracts';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import {
  cancelExternalLinkChecks,
  cancelInsightsScan,
  checkExternalLinks,
  probeWorkspaceResource,
  readInsightsDocumentSource,
  scanInsightsWorkspace,
  setInsightsWatchState,
} from '../../../../ui/src/platform/bridge';

function createFakeBridge() {
  const handlers = new Set<(message: HostMessage) => void>();
  const posted: WebviewMessage[] = [];
  const bridge: PlatformBridge = {
    postMessage: (message) => { posted.push(message); },
    onMessage: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    getState: () => undefined,
    setState: () => undefined,
    copyToClipboard: vi.fn(),
  };
  return {
    bridge,
    posted,
    emit(message: HostMessage) {
      for (const handler of [...handlers]) handler(message);
    },
    listenerCount: () => handlers.size,
  };
}

const entry: InsightsWorkspaceEntry = {
  relativePath: 'docs/a.md',
  canonicalRelativePath: 'docs/a.md',
  kind: 'file',
  sizeBytes: 12,
  mtimeMs: 123,
  extension: '.md',
};

describe('Insights host protocol bridge', () => {
  it('correlates streamed scan batches and completion by request id', async () => {
    const host = createFakeBridge();
    const onBatch = vi.fn();
    const scan = scanInsightsWorkspace(host.bridge, {
      requestId: 'scan-1',
      workspaceOperationId: 'ws-1',
      userPatterns: [],
    }, onBatch);

    host.emit({
      command: 'insightsScanBatch',
      requestId: 'other',
      entries: [entry],
      scannedEntries: 1,
      excludedEntries: 0,
    });
    host.emit({
      command: 'insightsScanBatch',
      requestId: 'scan-1',
      entries: [entry],
      scannedEntries: 1,
      excludedEntries: 0,
    });
    host.emit({
      command: 'insightsScanComplete',
      requestId: 'scan-1',
      totalEntries: 1,
      excludedEntries: 0,
      skippedEntries: 0,
      truncated: false,
    });

    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onBatch).toHaveBeenCalledWith(expect.objectContaining({ entries: [entry] }));
    await expect(scan.done).resolves.toMatchObject({ requestId: 'scan-1', truncated: false });
    expect(host.listenerCount()).toBe(0);
    expect(host.posted[0]).toMatchObject({ command: 'scanInsightsWorkspace', requestId: 'scan-1' });
  });

  it('cancels scans with the same request id', () => {
    const host = createFakeBridge();
    cancelInsightsScan(host.bridge, 'scan-2');
    expect(host.posted).toEqual([{ command: 'cancelInsightsScan', requestId: 'scan-2' }]);
  });

  it('reads bounded document source through a correlated result', async () => {
    const host = createFakeBridge();
    const promise = readInsightsDocumentSource(host.bridge, {
      requestId: 'source-1',
      relativePath: 'docs/a.md',
      softLimitBytes: 10 * 1024 * 1024,
    });
    host.emit({
      command: 'insightsDocumentSourceResult',
      requestId: 'source-1',
      relativePath: 'docs/a.md',
      status: 'ok',
      source: '# A',
      sizeBytes: 3,
    });
    await expect(promise).resolves.toMatchObject({ status: 'ok', source: '# A' });
  });

  it('probes metadata only and never requests binary resource content', async () => {
    const host = createFakeBridge();
    const promise = probeWorkspaceResource(host.bridge, {
      requestId: 'probe-1',
      documentPath: 'docs/a.md',
      resourcePath: '../img/a.png',
    });
    expect(host.posted[0]).toEqual({
      command: 'probeWorkspaceResource',
      requestId: 'probe-1',
      documentPath: 'docs/a.md',
      resourcePath: '../img/a.png',
    });
    expect(host.posted[0]).not.toHaveProperty('dataBase64');

    host.emit({
      command: 'workspaceResourceProbeResult',
      requestId: 'probe-1',
      status: 'exists',
      relativePath: 'img/a.png',
      kind: 'file',
      sizeBytes: 42,
      mimeType: 'image/png',
    });
    await expect(promise).resolves.toEqual({
      status: 'exists',
      relativePath: 'img/a.png',
      kind: 'file',
      sizeBytes: 42,
      mimeType: 'image/png',
    });
  });

  it('sets watch visibility without starting an implicit scan', () => {
    const host = createFakeBridge();
    setInsightsWatchState(host.bridge, {
      requestId: 'watch-1',
      workspaceOperationId: 'ws-1',
      active: true,
      visible: false,
    });
    expect(host.posted).toEqual([{
      command: 'setInsightsWatchState',
      requestId: 'watch-1',
      workspaceOperationId: 'ws-1',
      active: true,
      visible: false,
    }]);
  });

  it('preserves per-URL external results and completion correlation', async () => {
    const host = createFakeBridge();
    const onResult = vi.fn();
    const check = checkExternalLinks(host.bridge, {
      requestId: 'ext-1',
      urls: ['https://a.test', 'https://b.test'],
      timeoutMs: 5000,
    }, onResult);
    host.emit({
      command: 'externalLinkCheckResult',
      requestId: 'ext-1',
      url: 'https://a.test',
      status: 'broken',
      httpStatus: 404,
    });
    host.emit({
      command: 'externalLinkCheckResult',
      requestId: 'other',
      url: 'https://b.test',
      status: 'reachable',
      httpStatus: 200,
    });
    host.emit({ command: 'externalLinkCheckComplete', requestId: 'ext-1', cancelled: false });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://a.test', status: 'broken' }));
    await expect(check.done).resolves.toEqual({ requestId: 'ext-1', cancelled: false });
    expect(host.listenerCount()).toBe(0);
  });

  it('cancels external checks explicitly', () => {
    const host = createFakeBridge();
    cancelExternalLinkChecks(host.bridge, 'ext-2');
    expect(host.posted).toEqual([{ command: 'cancelExternalLinkChecks', requestId: 'ext-2' }]);
  });
});
