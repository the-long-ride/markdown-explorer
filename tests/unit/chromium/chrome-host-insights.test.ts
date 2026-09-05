import { describe, expect, it, vi } from 'vitest';
import { createChromeInsightsHost } from '../../../chromium-xtension/src/chrome-host-insights';

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

describe('Chromium Insights host', () => {
  it('probes metadata without reading binary bytes and reports polling capability', async () => {
    const image = fileHandle('a.png', 'PNG', 'image/png');
    const docs = directoryHandle('docs', { 'a.md': fileHandle('a.md', '# A') });
    const img = directoryHandle('img', { 'a.png': image });
    const root = directoryHandle('root', { docs, img });
    const sent: any[] = [];
    const host = createChromeInsightsHost({ getActiveHandle: () => root, send: m => sent.push(m) });

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
    const host = createChromeInsightsHost({ getActiveHandle: () => root, send: m => sent.push(m) });

    await host.readInsightsDocumentSource({ requestId: 'source', relativePath: 'large.md', softLimitBytes: 1024 });
    expect(sent.at(-1)).toMatchObject({ status: 'too-large' });

    await host.scanInsightsWorkspace({ requestId: 'scan' });
    const entries = sent.filter(m => m.command === 'insightsScanBatch').flatMap(m => m.entries);
    expect(entries.filter((entry: any) => entry.extension === '.md')).toHaveLength(1006);
    expect(sent.find(m => m.command === 'insightsScanComplete')).toMatchObject({ truncated: false });
  });
});
