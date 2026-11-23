import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DEFAULT_HARD_LIMIT_BYTES, SCAN_BATCH_SIZE, createPanelInsightsHost } from '../../../vscode/src/core/panelInsights';

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function workspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'mdn-vscode-insights-'));
  roots.push(root);
  const write = (relativePath: string, data: string) => {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, data);
    return target;
  };
  return { root, write };
}

describe('VS Code Insights host', () => {
  it('uses stat-only resource probes and bounded source reads', async () => {
    const ws = workspace();
    const documentPath = ws.write('docs/a.md', '# A');
    ws.write('img/a.png', 'PNG');
    ws.write('large.md', 'x'.repeat(2048));
    const posted: any[] = [];
    const readFileSync = vi.fn(fs.readFileSync);
    const host = createPanelInsightsHost({
      fs: { ...fs, readFileSync } as typeof fs,
      pathApi: path,
      workspaceRoot: () => ws.root,
      postMessage: (message) => posted.push(message),
    });

    await host.probeWorkspaceResource({ requestId: 'p', documentPath, resourcePath: '../img/a.png' });
    expect(readFileSync).not.toHaveBeenCalled();
    expect(posted.at(-1)).toMatchObject({ status: 'exists', kind: 'file', sizeBytes: 3 });

    await host.readInsightsDocumentSource({ requestId: 's', relativePath: 'large.md', softLimitBytes: 1024 });
    expect(posted.at(-1)).toMatchObject({ command: 'insightsDocumentSourceResult', requestId: 's', status: 'too-large' });
  });

  it('streams every eligible file instead of inheriting sidebar scan caps', async () => {
    const ws = workspace();
    for (let i = 0; i < 1005; i += 1) ws.write(`notes/${i}.md`, `# ${i}`);
    const posted: any[] = [];
    const host = createPanelInsightsHost({ fs, pathApi: path, workspaceRoot: () => ws.root, postMessage: m => posted.push(m) });

    await host.scanInsightsWorkspace({ requestId: 'scan' });

    expect(posted.filter(m => m.command === 'insightsScanBatch').flatMap(m => m.entries)).toHaveLength(1005);
    expect(posted.find(m => m.command === 'insightsScanComplete')).toMatchObject({ totalEntries: 1005, truncated: false });
  });

  it('distinguishes no workspace, missing and unreadable targets, and portable workspace paths', async () => {
    const ws = workspace();
    ws.write('docs/a.md', 'abc');
    ws.write('docs/file.untyped', 'xyz');
    fs.mkdirSync(path.join(ws.root, 'docs', 'dir.md'));
    const postMessage = vi.fn();
    let root: string | null = null;
    const realpathSync = vi.fn((file: string) => {
      if (file.endsWith('file.untyped')) throw new Error('permission denied');
      return fs.realpathSync(file);
    });
    const host = createPanelInsightsHost({ fs: { ...fs, realpathSync } as unknown as typeof fs, pathApi: path, workspaceRoot: () => root, postMessage });

    async function probe(resourcePath: string | undefined, expected: object) {
      await host.probeWorkspaceResource({ resourcePath, documentPath: 'docs/a.md' });
      expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ requestId: '', ...expected }));
    }
    async function read(relativePath: string | undefined, expected: object, limits = {}) {
      await host.readInsightsDocumentSource({ relativePath, ...limits });
      expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ requestId: '', ...expected }));
    }

    await probe('other', { status: 'missing' });
    await read('docs/a.md', { status: 'missing' });
    await host.scanInsightsWorkspace({});
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ command: 'insightsScanComplete', totalEntries: 0 }));
    root = path.join(ws.root, 'missing');
    await probe('other', { status: 'missing' });
    root = ws.root;
    await probe(undefined, { status: 'outside-workspace' });
    await probe('https://example.test/picture.jpg', { status: 'outside-workspace' });
    await probe('../../other', { status: 'outside-workspace' });
    await probe('nonexistent', { status: 'missing' });
    await probe('file.untyped', { status: 'unreadable' });
    await probe('/docs/dir.md#anchor', { status: 'exists', relativePath: 'docs/dir.md', kind: 'directory' });
    await probe('/docs/a.md?rev=7', { status: 'exists', relativePath: 'docs/a.md', mimeType: 'text/markdown' });
    ws.write('docs/data.untyped', 'xyz');
    await probe('data.untyped', { status: 'exists', mimeType: 'application/octet-stream' });

    await read(undefined, { status: 'missing' });
    await read('../outside.md', { status: 'outside-workspace' });
    await read('docs/file.untyped', { status: 'unsupported' });
    await read('docs/nonexistent.md', { status: 'unreadable' });
    await read('docs/dir.md', { status: 'missing' });
    await read('docs/a.md', { status: 'too-large', hardLimit: true }, { hardLimitBytes: 1 });
    await read('docs/a.md', {
      status: 'ok', source: 'abc', sizeBytes: 3,
      contentHash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    }, { hardLimitBytes: DEFAULT_HARD_LIMIT_BYTES * 2 });
  });

  it('honors exclude overrides and stops a scan cancelled after the first batch', async () => {
    const ws = workspace();
    ws.write('.git/metadata', '');
    ws.write('dist/retain', '');
    ws.write('build/ignore', '');
    ws.write('docs/private/ignore', '');
    ws.write('docs/public/retain.md', '');
    const posted = vi.fn();
    const host = createPanelInsightsHost({ fs, pathApi: path, workspaceRoot: () => ws.root, postMessage: posted });
    await host.scanInsightsWorkspace({ userPatterns: ['', '# notes', '!dist/', '!/.git', '/docs/private'] });
    expect(posted).toHaveBeenCalledWith(expect.objectContaining({
      command: 'insightsScanBatch', entries: expect.arrayContaining([
        expect.objectContaining({ relativePath: 'dist/retain', extension: undefined }),
        expect.objectContaining({ relativePath: 'docs/public/retain.md', extension: '.md' }),
      ]),
    }));
    expect(posted).toHaveBeenLastCalledWith(expect.objectContaining({ totalEntries: 2, excludedEntries: 3 }));

    for (let i = 0; i < SCAN_BATCH_SIZE + 10; i++) ws.write(`notes/note-${i}.md`, '');
    posted.mockClear();
    posted.mockImplementation((message) => {
      if (message.command === 'insightsScanBatch') host.cancelInsightsScan({ requestId: 'interrupt' });
    });
    host.cancelInsightsScan({});
    await host.scanInsightsWorkspace({ requestId: 'interrupt' });
    expect(posted).toHaveBeenCalledTimes(2);
    expect(posted).toHaveBeenLastCalledWith(expect.objectContaining({ totalEntries: SCAN_BATCH_SIZE, cancelled: true }));
  });

  it('publishes watch deltas and ignores callbacks from a previous watch session', async () => {
    const ws = workspace();
    const doc = ws.write('docs/a.md', '# A');
    ws.write('ref', 'content');
    const callbacks = new Map<string, (event: string, fileName: string | null) => void>();
    const watch = vi.fn((dir, _options, callback) => {
      callbacks.set(dir, callback);
      return { close: vi.fn() };
    });
    const posted = vi.fn();
    const host = createPanelInsightsHost({
      fs: { ...fs, watch } as unknown as typeof fs, pathApi: path, workspaceRoot: () => ws.root, postMessage: posted,
    });
    await host.setInsightsWatchState({ active: true, requestId: 'watch', workspaceOperationId: 'workspace' });
    expect(posted).toHaveBeenLastCalledWith(expect.objectContaining({ capabilities: expect.objectContaining({ fileChanges: 'native' }) }));
    const root = fs.realpathSync(ws.root);
    const onDoc = callbacks.get(path.join(root, 'docs'))!;
    const onRoot = callbacks.get(root)!;
    onDoc('change', null);
    expect(posted).toHaveBeenCalledTimes(1);
    onDoc('change', 'a.md');
    expect(posted).toHaveBeenLastCalledWith(expect.objectContaining({
      command: 'insightsFsDelta', requestId: 'watch', workspaceOperationId: 'workspace',
      deltas: [{ kind: 'update', entry: expect.objectContaining({ relativePath: 'docs/a.md', extension: '.md' }) }],
    }));
    onRoot('change', 'ref');
    expect(posted).toHaveBeenLastCalledWith(expect.objectContaining({
      deltas: [{ kind: 'update', entry: expect.objectContaining({ relativePath: 'ref', extension: undefined }) }],
    }));
    fs.rmSync(doc);
    onDoc('rename', 'a.md');
    expect(posted).toHaveBeenLastCalledWith(expect.objectContaining({ deltas: [{ kind: 'delete', relativePath: 'docs/a.md' }] }));
    fs.mkdirSync(path.join(ws.root, 'new'));
    onRoot('rename', 'new');
    expect(callbacks.has(path.join(root, 'new'))).toBe(true);

    await host.setInsightsWatchState({ active: false, requestId: 'stop' });
    for (const { value } of watch.mock.results) expect(value.close).toHaveBeenCalledOnce();
    expect(posted).toHaveBeenLastCalledWith(expect.objectContaining({ capabilities: expect.objectContaining({ fileChanges: 'unsupported' }) }));
    const messageCount = posted.mock.calls.length;
    onDoc('change', 'a.md');
    expect(posted).toHaveBeenCalledTimes(messageCount);
    host.dispose();
  });
});
