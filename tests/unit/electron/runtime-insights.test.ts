import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { createInsightsWorkspaceHost } = require('../../../electron/core/runtime-insights.js');

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function makeWorkspace() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'mdn-insights-'));
  roots.push(root);
  const write = (relativePath: string, data: string) => {
    const target = nodePath.join(root, relativePath);
    mkdirSync(nodePath.dirname(target), { recursive: true });
    writeFileSync(target, data);
    return target;
  };
  return { root, write };
}

function isSameOrInsidePath(base: string, target: string) {
  const rel = nodePath.relative(nodePath.resolve(base), nodePath.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !nodePath.isAbsolute(rel));
}

function harness(root: string, fsImpl: typeof nodeFs = nodeFs) {
  const sent: any[] = [];
  const host = createInsightsWorkspaceHost({
    fs: fsImpl,
    pathApi: nodePath,
    getWorkspaceBaseDir: () => root,
    isSameOrInsidePath,
    sendHostMessage: (message: any) => sent.push(message),
  });
  return { sent, host };
}

describe('Electron Insights workspace host', () => {
  it('probes resource metadata without reading binary contents', async () => {
    const ws = makeWorkspace();
    const documentPath = ws.write('docs/a.md', '# A');
    ws.write('img/a.png', 'PNG');
    const readFileSync = vi.fn(nodeFs.readFileSync);
    const fsImpl = { ...nodeFs, readFileSync } as typeof nodeFs;
    const { sent, host } = harness(ws.root, fsImpl);

    await host.probeWorkspaceResource({
      requestId: 'probe-1',
      documentPath,
      resourcePath: '../img/a.png',
    });

    expect(readFileSync).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      command: 'workspaceResourceProbeResult',
      requestId: 'probe-1',
      status: 'exists',
      relativePath: 'img/a.png',
      kind: 'file',
      sizeBytes: 3,
    });
  });

  it('enforces soft and hard Markdown source limits explicitly', async () => {
    const ws = makeWorkspace();
    ws.write('ok.md', '# ok');
    ws.write('large.md', 'x'.repeat(2048));
    const { sent, host } = harness(ws.root);

    await host.readInsightsDocumentSource({ requestId: 'ok', relativePath: 'ok.md', softLimitBytes: 1024 });
    await host.readInsightsDocumentSource({ requestId: 'soft', relativePath: 'large.md', softLimitBytes: 1024 });
    await host.readInsightsDocumentSource({ requestId: 'hard', relativePath: 'large.md', softLimitBytes: 4096, hardLimitBytes: 1024 });

    expect(sent.find(m => m.requestId === 'ok')).toMatchObject({ status: 'ok', source: '# ok' });
    expect(sent.find(m => m.requestId === 'soft')).toMatchObject({ status: 'too-large' });
    expect(sent.find(m => m.requestId === 'hard')).toMatchObject({ status: 'too-large' });
  });

  it('does not silently stop at 1000 eligible files', async () => {
    const ws = makeWorkspace();
    for (let i = 0; i < 1005; i += 1) ws.write(`notes/${i}.md`, `# ${i}`);
    const { sent, host } = harness(ws.root);

    await host.scanInsightsWorkspace({ requestId: 'scan-1', userPatterns: [] });

    const batches = sent.filter(m => m.command === 'insightsScanBatch');
    const complete = sent.find(m => m.command === 'insightsScanComplete');
    expect(batches.flatMap(m => m.entries)).toHaveLength(1005);
    expect(complete).toMatchObject({ requestId: 'scan-1', totalEntries: 1005, truncated: false });
  });
});
