import { describe, expect, it, vi } from 'vitest';
import { createBrowserInsightsHost } from '../../../website-app/src/browser-insights-host';

function fileHandle(name: string, text: string, type = 'text/markdown') {
  const arrayBuffer = vi.fn(async () => new TextEncoder().encode(text).buffer);
  return {
    kind: 'file',
    name,
    getFile: vi.fn(async () => ({
      name,
      size: text.length,
      type,
      lastModified: 123,
      text: async () => text,
      arrayBuffer,
    })),
    _arrayBuffer: arrayBuffer,
  } as any;
}

function directoryHandle(name: string, files: Record<string, any>) {
  const entries = Object.entries(files);
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const entry of entries) yield entry;
    },
    async getFileHandle(fileName: string) {
      const handle = files[fileName];
      if (!handle || handle.kind !== 'file') throw new DOMException('missing', 'NotFoundError');
      return handle;
    },
    async getDirectoryHandle(dirName: string) {
      const handle = files[dirName];
      if (!handle || handle.kind !== 'directory') throw new DOMException('missing', 'NotFoundError');
      return handle;
    },
  } as any;
}

describe('Browser Insights host', () => {
  it('probes metadata without reading binary bytes and reports polling capability', async () => {
    const image = fileHandle('a.png', 'PNG', 'image/png');
    const docs = directoryHandle('docs', { 'a.md': fileHandle('a.md', '# A') });
    const img = directoryHandle('img', { 'a.png': image });
    const root = directoryHandle('root', { docs, img });
    const sent: any[] = [];
    const host = createBrowserInsightsHost({ getActiveHandle: () => root, send: m => sent.push(m) });

    await host.probeWorkspaceResource({ requestId: 'p', documentPath: 'docs/a.md', resourcePath: '../img/a.png' });

    expect(image._arrayBuffer).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({ status: 'exists', sizeBytes: 3, mimeType: 'image/png' });
    expect(host.capabilities).toMatchObject({ fileChanges: 'polling', externalLinkChecking: false });
  });

  it('enforces source limits and scans beyond 1000 files', async () => {
    const files: Record<string, any> = {};
    for (let i = 0; i < 1005; i += 1) files[`${i}.md`] = fileHandle(`${i}.md`, `# ${i}`);
    files['large.md'] = fileHandle('large.md', 'x'.repeat(2048));
    const root = directoryHandle('root', files);
    const sent: any[] = [];
    const host = createBrowserInsightsHost({ getActiveHandle: () => root, send: m => sent.push(m) });

    await host.readInsightsDocumentSource({ requestId: 'source', relativePath: 'large.md', softLimitBytes: 1024 });
    expect(sent.at(-1)).toMatchObject({ status: 'too-large' });

    await host.scanInsightsWorkspace({ requestId: 'scan' });
    const entries = sent.filter(m => m.command === 'insightsScanBatch').flatMap(m => m.entries);
    expect(entries.filter((entry: any) => entry.extension === '.md')).toHaveLength(1006);
    expect(sent.find(m => m.command === 'insightsScanComplete')).toMatchObject({ truncated: false });
  });

  it('reports missing, outside-workspace, directory and unreadable resources', async () => {
    const unreadable = fileHandle('private.md', '');
    unreadable.getFile.mockRejectedValue(new Error('denied'));
    let root = directoryHandle('root', {
      docs: directoryHandle('docs', {
        'figure.png': fileHandle('figure.png', 'PNG', ''),
        'unknown': fileHandle('unknown', '?', ''),
        'private.md': unreadable,
      }),
    });
    const send = vi.fn();
    const host = createBrowserInsightsHost({ getActiveHandle: () => root, send });
    for (const [path, expected] of [
      ['/docs', { status: 'exists', kind: 'directory' }],
      ['.\\figure.png?raw#view', { status: 'exists', mimeType: 'image/png' }],
      ['unknown', { status: 'exists', mimeType: 'application/octet-stream' }],
      ['private.md', { status: 'unreadable' }],
      ['no-folder/test.png', { status: 'missing' }],
      ['../../outside.md', { status: 'outside-workspace' }],
      ['https://example.test/figure.png', { status: 'outside-workspace' }],
      [undefined, { status: 'outside-workspace' }],
    ] as const) {
      await host.probeWorkspaceResource({ documentPath: 'docs/index.md', resourcePath: path });
      expect(send).toHaveBeenLastCalledWith(expect.objectContaining(expected));
    }
    root = null;
    await host.probeWorkspaceResource({ resourcePath: 'figure.png' });
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'missing', requestId: '' }));
  });

  it('reads source according to file type and limits, with optional hashing', async () => {
    const broken = fileHandle('broken.md', '');
    broken.getFile.mockRejectedValue(new Error('unreadable'));
    const document = fileHandle('document.mdx', '# source');
    document.getFile.mockResolvedValueOnce({ size: 9, text: async () => '# source' });
    const root = directoryHandle('root', { docs: directoryHandle('docs', { 'document.mdx': document, 'broken.md': broken }) });
    const send = vi.fn();
    const host = createBrowserInsightsHost({ getActiveHandle: () => root, send });
    for (const [relativePath, expected] of [
      [undefined, { status: 'missing' }],
      ['docs/figure.png', { status: 'unsupported' }],
      ['docs/missing.md', { status: 'missing' }],
      ['docs/broken.md', { status: 'unreadable' }],
    ] as const) {
      await host.readInsightsDocumentSource({ relativePath });
      expect(send).toHaveBeenLastCalledWith(expect.objectContaining(expected));
    }
    await host.readInsightsDocumentSource({ relativePath: 'docs/document.mdx', hardLimitBytes: 4 });
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'too-large', hardLimit: true, mtimeMs: 0 }));
    const digest = vi.fn().mockResolvedValue(new Uint8Array([0, 16, 255]).buffer);
    vi.stubGlobal('crypto', { subtle: { digest } });
    await host.readInsightsDocumentSource({ relativePath: 'docs/document.mdx' });
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ok', source: '# source', contentHash: '0010ff' }));
    expect(digest).toHaveBeenCalledWith('SHA-256', new TextEncoder().encode('# source'));
    digest.mockRejectedValueOnce(new Error('unavailable'));
    await host.readInsightsDocumentSource({ relativePath: 'docs/document.mdx' });
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ok', contentHash: undefined }));
    vi.stubGlobal('crypto', undefined);
    await host.readInsightsDocumentSource({ relativePath: 'docs/document.mdx' });
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ok', contentHash: undefined }));
  });

  it('honors ignored and re-included paths, and counts unreadable entries', async () => {
    const broken = fileHandle('broken.md', '');
    broken.getFile.mockRejectedValue(new Error('unreadable'));
    const root = directoryHandle('root', {
      '.git': directoryHandle('.git', { 'config': fileHandle('config', '') }),
      'node_modules': directoryHandle('node_modules', { 'readme.md': fileHandle('readme.md', '# lib') }),
      docs: directoryHandle('docs', { 'draft.md': fileHandle('draft.md', ''), 'broken.md': broken }),
      'broken-folder': { kind: 'directory', async *entries() { throw new Error('unreadable'); } },
      'unknown': { kind: 'other' },
    });
    const send = vi.fn();
    const host = createBrowserInsightsHost({ getActiveHandle: () => root, send });
    await host.scanInsightsWorkspace({ requestId: 'scan', userPatterns: ['', '# comment', '!/.git', '!/node_modules/', '/docs/draft.md'] });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      command: 'insightsScanBatch', entries: [expect.objectContaining({ relativePath: 'node_modules/readme.md' })],
    }));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ totalEntries: 1, excludedEntries: 2, skippedEntries: 2 }));
  });

  it('stops walking a cancelled scan and reports an empty workspace without a handle', async () => {
    const skipped = fileHandle('second.md', '');
    const send = vi.fn();
    let root: FileSystemDirectoryHandle | null = {
      async *entries() {
        yield ['first.md', fileHandle('first.md', '# First')];
        host.cancelInsightsScan({ requestId: 'stop' });
        yield ['second.md', skipped];
      },
    } as unknown as FileSystemDirectoryHandle;
    const host = createBrowserInsightsHost({ getActiveHandle: () => root, send });
    host.cancelInsightsScan({});
    await host.scanInsightsWorkspace({ requestId: 'stop' });
    expect(skipped.getFile).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ cancelled: true, totalEntries: 1 }));
    root = null;
    await host.scanInsightsWorkspace({});
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ requestId: '', totalEntries: 0 }));
  });
});
