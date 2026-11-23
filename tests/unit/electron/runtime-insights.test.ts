import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { createInsightsWorkspaceHost } = require('../../../electron/core/runtime-insights.js');
const { isSameOrInsidePath } = require('../../../electron/core/runtime-utils.js');

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

function harness(root: string | null, fsImpl: typeof nodeFs = nodeFs, pathApi = nodePath) {
  const sent: any[] = [];
  const host = createInsightsWorkspaceHost({
    fs: fsImpl,
    pathApi,
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

  it('optimizes file tree walk by avoiding realpathSync and non-markdown statSync on non-symlink entries', async () => {
    const ws = makeWorkspace();
    ws.write('doc.md', '# doc');
    ws.write('img.png', 'PNG DATA');
    const realpathSync = vi.fn(nodeFs.realpathSync);
    const statSync = vi.fn(nodeFs.statSync);
    const fsImpl = { ...nodeFs, realpathSync, statSync } as typeof nodeFs;
    const { host, sent } = harness(ws.root, fsImpl);

    await host.scanInsightsWorkspace({ requestId: 'scan-opt', userPatterns: [] });

    const complete = sent.find(m => m.command === 'insightsScanComplete');
    expect(complete).toMatchObject({ requestId: 'scan-opt', totalEntries: 2, truncated: false });

    const realpathArgs = realpathSync.mock.calls.map(call => String(call[0]));
    expect(realpathArgs.some(arg => arg.endsWith('doc.md'))).toBe(false);
    expect(realpathArgs.some(arg => arg.endsWith('img.png'))).toBe(false);

    const statArgs = statSync.mock.calls.map(call => String(call[0]));
    expect(statArgs.some(arg => arg.endsWith('doc.md'))).toBe(true);
    expect(statArgs.some(arg => arg.endsWith('img.png'))).toBe(false);
  });

  it('reports no workspace when none is selected or its directory has disappeared', async () => {
    for (const root of [null, nodePath.join(makeWorkspace().root, 'missing')]) {
      const { host, sent } = harness(root);
      await host.scanInsightsWorkspace();
      await host.readInsightsDocumentSource();
      await host.probeWorkspaceResource();
      host.setInsightsWatchState({ active: true });
      host.cancelInsightsScan();
      host.dispose();
      expect(sent).toEqual([
        { command: 'insightsScanComplete', requestId: '', totalEntries: 0, excludedEntries: 0, skippedEntries: 0, truncated: false },
        { command: 'insightsDocumentSourceResult', requestId: '', relativePath: '', status: 'missing' },
        { command: 'workspaceResourceProbeResult', requestId: '', status: 'missing' },
        { command: 'insightsRuntimeCapabilities', requestId: '', capabilities: { fileChanges: 'unsupported', externalLinkChecking: true, documentPreviewReuse: true } },
      ]);
    }
  });

  it('probes directories and root-relative resources without crossing the workspace boundary', async () => {
    const ws = makeWorkspace();
    const outside = makeWorkspace().write('private.bin', 'private');
    ws.write('docs/file.bin', 'binary');
    ws.write('docs/denied.bin', 'unreadable');
    ws.write('docs/broken.bin', 'missing after exists');
    ws.write('docs/alias.bin', 'outside alias');
    const fsImpl = {
      ...nodeFs,
      realpathSync: (target: string) => {
        if (target.endsWith('alias.bin')) return outside;
        if (target.endsWith('broken.bin')) throw new Error('missing');
        return nodeFs.realpathSync(target);
      },
      statSync: (target: string) => {
        if (target.endsWith('denied.bin')) throw new Error('denied');
        return nodeFs.statSync(target);
      },
    } as typeof nodeFs;
    const { host, sent } = harness(ws.root, fsImpl);
    for (const [resourcePath, expected] of [
      ['/docs', { status: 'exists', kind: 'directory' }],
      ['file.bin?raw#top', { status: 'exists', kind: 'file', relativePath: 'docs/file.bin', mimeType: 'application/octet-stream' }],
      ['//missing.bin', { status: 'missing' }],
      ['../../escaped.png', { status: 'outside-workspace' }],
      ['https://example.test/image.png', { status: 'outside-workspace' }],
      ['file:///image.png', { status: 'outside-workspace' }],
      ['', { status: 'outside-workspace' }],
      ['alias.bin', { status: 'outside-workspace' }],
      ['broken.bin', { status: 'outside-workspace' }],
      ['denied.bin', { status: 'unreadable' }],
    ] as const) {
      await host.probeWorkspaceResource({ requestId: 'probe', documentPath: 'docs/page.md', resourcePath });
      expect(sent.at(-1)).toMatchObject({ command: 'workspaceResourceProbeResult', requestId: 'probe', ...expected });
    }
    await host.probeWorkspaceResource({ resourcePath: 'docs/file.bin' });
    expect(sent.at(-1)).toMatchObject({ status: 'outside-workspace' });
  });

  it('normalizes absolute Windows resource paths', async () => {
    const root = 'C:\\workspace';
    const target = 'C:\\workspace\\images\\logo.PNG';
    const fsImpl = {
      existsSync: vi.fn(() => true), realpathSync: vi.fn((p: string) => p),
      statSync: vi.fn(() => ({ isDirectory: () => false, isFile: () => true, size: 10 })),
    } as unknown as typeof nodeFs;
    const { host, sent } = harness(root, fsImpl, nodePath.win32);
    await host.probeWorkspaceResource({ resourcePath: 'C:\\workspace\\images\\.\\logo.PNG' });
    expect(fsImpl.statSync).toHaveBeenCalledExactlyOnceWith(target);
    expect(sent.at(-1)).toMatchObject({ status: 'exists', relativePath: 'images/logo.PNG', mimeType: 'image/png' });
  });

  it('reads only workspace Markdown and distinguishes absence, escaped links, and I/O errors', async () => {
    const ws = makeWorkspace();
    const outside = makeWorkspace().write('private.md', 'private');
    ws.write('alias.md', 'alias');
    ws.write('folder.md/child.md', 'child');
    ws.write('denied.md', 'unreadable');
    const fsImpl = {
      ...nodeFs,
      realpathSync: (target: string) => target.endsWith('alias.md') ? outside : nodeFs.realpathSync(target),
      readFileSync: (target: string) => { throw new Error(`denied ${target}`); },
    } as unknown as typeof nodeFs;
    const { host, sent } = harness(ws.root, fsImpl);
    for (const [relativePath, status] of [
      ['', 'missing'], ['../escaped.md', 'outside-workspace'], ['sample.txt', 'unsupported'],
      ['missing.md', 'missing'], ['folder.md', 'missing'], ['alias.md', 'outside-workspace'], ['denied.md', 'unreadable'],
    ]) {
      await host.readInsightsDocumentSource({ requestId: 'read', relativePath });
      expect(sent.at(-1)).toMatchObject({ command: 'insightsDocumentSourceResult', requestId: 'read', relativePath, status });
    }
  });

  it('combines gitignore and user patterns while preserving hard exclusions', async () => {
    const ws = makeWorkspace();
    ws.write('.gitignore', '\n# commentary\n *.tmp \n!keep.tmp\n/logs/\nignored/**/draft?.md\nfile[1].md\n');
    for (const file of [
      'discard.tmp', 'keep.tmp', 'logs/a.md', 'nested/logs/b.md', 'ignored/child/draft1.md',
      'ignored/child/draft12.md', 'file[1].md', 'node_modules/keep.md', '.git/config', 'skip.MDX',
    ]) ws.write(file, 'content');
    const { host, sent } = harness(ws.root);
    await host.scanInsightsWorkspace({
      requestId: 'patterns',
      userPatterns: [null, '# comment', 'skip.MDX', '!node_modules/', '!**/.git/**'],
    });
    expect(sent.find(m => m.command === 'insightsScanBatch').entries.map((e: { relativePath: string }) => e.relativePath).sort()).toEqual([
      '.gitignore', 'ignored/child/draft12.md', 'keep.tmp', 'nested/logs/b.md', 'node_modules/keep.md',
    ]);
    expect(sent.at(-1)).toMatchObject({ command: 'insightsScanComplete', totalEntries: 5, excludedEntries: 6 });
  });

  it('counts scan errors, rejects outside links, and deduplicates linked directories and files', async () => {
    const ws = makeWorkspace();
    const outside = makeWorkspace().write('outside.md', 'private');
    const canonical = ws.write('nested/canonical.md', '# markdown');
    const file = (name: string) => ({ name, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false });
    const link = (name: string) => ({ ...file(name), isSymbolicLink: () => true });
    const nested = nodePath.dirname(canonical);
    const fsImpl = {
      ...nodeFs,
      readdirSync: (target: string) => {
        if (target === ws.root) return [
          link('alias'), link('duplicate-dir'), link('duplicate.md'), link('external.md'), link('broken.md'),
          link('special.md'), { ...file('denied'), isDirectory: () => true }, { ...file('moved'), isDirectory: () => true },
          { ...file('gone.md'), isDirectory: () => true }, file('unreadable.md'),
          { ...file('pipe'), isFile: () => false }, { name: 'plain' },
        ];
        if (target === nodePath.join(ws.root, 'alias')) return [link('first.md')];
        throw new Error('denied');
      },
      realpathSync: (target: string) => {
        switch (nodePath.relative(ws.root, target)) {
          case 'alias': case 'duplicate-dir': return nested;
          case 'alias' + nodePath.sep + 'first.md': case 'duplicate.md': return canonical;
          case 'external.md': case 'moved': return outside;
          case 'broken.md': case 'gone.md': throw new Error('missing');
          default: return target;
        }
      },
      statSync: (target: string) => {
        if (target.endsWith('special.md')) return { isFile: () => false, isDirectory: () => false };
        return nodeFs.statSync(target);
      },
    } as typeof nodeFs;
    const { host, sent } = harness(ws.root, fsImpl);
    await host.scanInsightsWorkspace();
    expect(sent[0].entries).toMatchObject([
      { relativePath: 'alias/first.md', canonicalRelativePath: 'nested/canonical.md', isSymlink: true },
      { relativePath: 'plain', isSymlink: false },
    ]);
    expect(sent.at(-1)).toMatchObject({ totalEntries: 2, excludedEntries: 1, skippedEntries: 4 });
  });

  it('reports cancellation before scanning the next entry', async () => {
    const ws = makeWorkspace();
    ws.write('a.md', 'a');
    ws.write('b.md', 'b');
    let cancel: () => void;
    const fsImpl = {
      ...nodeFs,
      statSync: (target: string) => {
        cancel();
        return nodeFs.statSync(target);
      },
    } as typeof nodeFs;
    const { host, sent } = harness(ws.root, fsImpl);
    cancel = () => host.cancelInsightsScan({ requestId: 'cancel' });
    await host.scanInsightsWorkspace({ requestId: 'cancel' });
    expect(sent.at(-1)).toMatchObject({ requestId: 'cancel', totalEntries: 1, cancelled: true });
  });

  it('debounces watcher deltas, attaches new folders, and ignores events from stopped watchers', async () => {
    vi.useFakeTimers();
    try {
      const ws = makeWorkspace();
      const outside = makeWorkspace().write('other.md', 'private');
      ws.write('docs/a.md', 'before');
      ws.write('bad.md', 'bad');
      ws.write('outside.md', 'alias');
      ws.write('ignored/a.md', 'ignored');
      const handlers = new Map<string, Function>();
      const close = vi.fn();
      const fsImpl = {
        ...nodeFs,
        realpathSync: (target: string) => {
          if (target.endsWith('bad.md')) throw new Error('denied');
          if (target.endsWith('outside.md')) return outside;
          return nodeFs.realpathSync(target);
        },
        watch: (target: string, _: unknown, handler: Function) => {
          handlers.set(target, handler);
          return { close };
        },
      } as typeof nodeFs;
      const { host, sent } = harness(ws.root, fsImpl);
      host.setInsightsWatchState({ requestId: 'watch', active: true, userPatterns: ['ignored/'], workspaceOperationId: 'operation' });
      expect(sent.at(-1)).toMatchObject({ capabilities: { fileChanges: 'native' } });
      const emit = handlers.get(ws.root)!;
      const emitDocs = handlers.get(nodePath.join(ws.root, 'docs'))!;
      expect(handlers.has(nodePath.join(ws.root, 'ignored'))).toBe(false);
      ws.write('new/b.md', 'new file');
      emit('rename', 'new');
      expect(handlers.has(nodePath.join(ws.root, 'new'))).toBe(true);
      emit('rename', '');
      emit('rename', '.');
      emit('rename', 'ignored');
      emit('rename', 'outside.md');
      emit('rename', 'bad.md');
      emit('rename', 'deleted.md');
      emitDocs('change', Buffer.from('a.md'));
      await vi.advanceTimersByTimeAsync(50);
      expect(sent.at(-1)).toMatchObject({
        command: 'insightsFsDelta', requestId: 'watch', workspaceOperationId: 'operation',
        deltas: [
          { kind: 'delete', relativePath: 'bad.md' }, { kind: 'delete', relativePath: 'deleted.md' },
          { kind: 'update', entry: { relativePath: 'docs/a.md', extension: '.md', sizeBytes: 6 } },
        ],
      });
      emit('rename', 'second-delete.md');
      host.setInsightsWatchState();
      emit('rename', 'late.md');
      await vi.runAllTimersAsync();
      expect(close).toHaveBeenCalledTimes(3);
      expect(sent.filter(m => m.command === 'insightsFsDelta')).toHaveLength(1);
      expect(sent.at(-1)).toMatchObject({ capabilities: { fileChanges: 'unsupported' } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('emits extensionless changes without an operation ID and avoids duplicate directory watches', async () => {
    vi.useFakeTimers();
    try {
      const ws = makeWorkspace();
      ws.write('docs/README', 'details');
      const docs = nodeFs.realpathSync(nodePath.join(ws.root, 'docs'));
      const outside = nodeFs.realpathSync(makeWorkspace().root);
      mkdirSync(nodePath.join(docs, 'docs-alias'));
      mkdirSync(nodePath.join(ws.root, 'outside-alias'));
      const handlers = new Map<string, Function>();
      const fsImpl = {
        ...nodeFs,
        realpathSync: (target: string) => {
          if (nodePath.basename(target) === 'docs-alias') return docs;
          if (nodePath.basename(target) === 'outside-alias') return outside;
          return nodeFs.realpathSync(target);
        },
        watch: (target: string, _: unknown, handler: Function) => {
          handlers.set(target, handler);
          return { close: vi.fn() };
        },
      } as typeof nodeFs;
      const { host, sent } = harness(ws.root, fsImpl);
      host.setInsightsWatchState({ requestId: 'unscoped', active: true });
      expect([...handlers.keys()]).toEqual([nodeFs.realpathSync(ws.root), docs]);
      handlers.get(docs)!('change', 'README');
      await vi.runAllTimersAsync();
      expect(sent.at(-1)).toMatchObject({
        command: 'insightsFsDelta', requestId: 'unscoped',
        deltas: [{ kind: 'update', entry: { relativePath: 'docs/README', extension: undefined } }],
      });
      expect(sent.at(-1)).not.toHaveProperty('workspaceOperationId');
      host.setInsightsWatchState();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports watcher setup failures and tolerates inaccessible children and disposal errors', () => {
    const ws = makeWorkspace();
    ws.write('nested/exists', 'file');
    const close = vi.fn(() => { throw new Error('already closed'); });
    const watch = vi.fn(() => ({ close }))
      .mockImplementationOnce(() => { throw new Error('watch not available'); });
    const fsImpl = {
      ...nodeFs,
      watch,
      readdirSync: (target: string, options: { withFileTypes: true }) => {
        if (target.endsWith('nested')) throw new Error('denied');
        return nodeFs.readdirSync(target, options);
      },
    } as typeof nodeFs;
    const { host, sent } = harness(ws.root, fsImpl);
    host.setInsightsWatchState({ active: true });
    expect(sent.at(-1)).toMatchObject({ capabilities: { fileChanges: 'unsupported' } });
    host.setInsightsWatchState({ active: true });
    expect(sent.at(-1)).toMatchObject({ capabilities: { fileChanges: 'native' } });
    expect(() => host.dispose()).not.toThrow();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
