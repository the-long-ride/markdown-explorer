import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetWorkspaceState } from '../../../chromium-xtension/src/chrome-host';

class MemoryFile {
  readonly kind = 'file';
  constructor(readonly name: string, private readonly content = '') {}
  async getFile() {
    const file = { lastModified: 1, size: this.content.length, text: async () => this.content } as any;
    file.slice = () => file;
    return file;
  }
}
class MemoryDir {
  readonly kind = 'directory';
  readonly entries = new Map<string, MemoryDir | MemoryFile>();
  constructor(readonly name: string) {}
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  async *values() { for (const entry of [...this.entries.values()]) yield entry; }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const entry = this.entries.get(name);
    if (entry instanceof MemoryDir) return entry;
    if (entry) throw new DOMException('type', 'TypeMismatchError');
    if (!options?.create) throw new DOMException('missing', 'NotFoundError');
    const dir = new MemoryDir(name);
    this.entries.set(name, dir);
    return dir;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    const entry = this.entries.get(name);
    if (entry instanceof MemoryFile) return entry;
    if (entry) throw new DOMException('type', 'TypeMismatchError');
    if (!options?.create) throw new DOMException('missing', 'NotFoundError');
    const file = new MemoryFile(name);
    this.entries.set(name, file);
    return file;
  }
  async removeEntry(name: string) {
    if (!this.entries.delete(name)) throw new DOMException('missing', 'NotFoundError');
  }
}

function post(msg: any) {
  (window as any).__chromeExtBus.dispatchEvent(new CustomEvent('webview-message', { detail: msg }));
}

function findFolder(tree: any, folderPath: string): any {
  return tree?.children?.find((child: any) => child.path === folderPath);
}

describe('chrome-host workspace entry commands', () => {
  const sent: any[] = [];
  const listener = ((event: Event) => { sent.push((event as CustomEvent).detail); }) as EventListener;

  beforeEach(() => {
    sent.length = 0;
    (window as any).__chromeExtBus = (window as any).__chromeExtBus || new EventTarget();
    (window as any).__chromeExtBus.addEventListener('host-message', listener);
    (globalThis as any).chrome = { runtime: { getManifest: () => ({ version: '1.0.0' }) } };
  });
  afterEach(() => {
    (window as any).__chromeExtBus.removeEventListener('host-message', listener);
    resetWorkspaceState();
    delete (globalThis as any).chrome;
  });

  it('creates a folder, publishes the rescanned tree with the empty folder, then replies', async () => {
    const root = new MemoryDir('entries-workspace');
    post({ command: 'openFolder', handle: root, openFirstFile: false });
    await new Promise((resolve) => setTimeout(resolve, 300));
    sent.length = 0;

    post({ command: 'createWorkspaceEntry', requestId: 'c1', parentPath: '', name: 'empty-dir', kind: 'folder' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const resultIndex = sent.findIndex((m) => m.command === 'createWorkspaceEntryResult');
    expect(sent[resultIndex]).toMatchObject({ requestId: 'c1', ok: true, kind: 'folder', path: 'empty-dir' });
    const treeIndex = sent.findIndex((m) => (m.command === 'readyAck' || m.command === 'workspaceFilesChanged') && findFolder(m.tree, 'empty-dir'));
    expect(treeIndex).toBeGreaterThanOrEqual(0);
    expect(treeIndex).toBeLessThan(resultIndex);
  });

  it('deletes permanently and publishes the tree before the reply', async () => {
    const root = new MemoryDir('entries-workspace');
    root.entries.set('old.md', new MemoryFile('old.md'));
    post({ command: 'openFolder', handle: root, openFirstFile: false });
    await new Promise((resolve) => setTimeout(resolve, 300));
    sent.length = 0;

    post({ command: 'deleteWorkspaceEntries', requestId: 'd1', paths: ['old.md'] });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const resultIndex = sent.findIndex((m) => m.command === 'deleteWorkspaceEntriesResult');
    expect(sent[resultIndex]).toMatchObject({ requestId: 'd1', mode: 'permanent', deleted: ['old.md'], failed: [] });
    const treeIndex = sent.findIndex((m) => (m.command === 'readyAck' || m.command === 'workspaceFilesChanged') && m.fileList.length === 0);
    expect(treeIndex).toBeGreaterThanOrEqual(0);
    expect(treeIndex).toBeLessThan(resultIndex);
    expect(root.entries.size).toBe(0);
  });

  it('re-renders the open document after the tree refresh so its markdown source survives', async () => {
    const root = new MemoryDir('entries-workspace');
    root.entries.set('doc.md', new MemoryFile('doc.md', '# Open doc'));
    post({ command: 'openFolder', handle: root, openFirstFile: false });
    await new Promise((resolve) => setTimeout(resolve, 300));
    post({ command: 'navigate', path: 'doc.md' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    sent.length = 0;

    post({ command: 'createWorkspaceEntry', requestId: 'c2', parentPath: '', name: 'extra.md', kind: 'file' });
    await new Promise((resolve) => setTimeout(resolve, 400));

    const resultIndex = sent.findIndex((m) => m.command === 'createWorkspaceEntryResult');
    const ackIndex = sent.findIndex((m) => m.command === 'readyAck' || m.command === 'workspaceFilesChanged');
    const renderIndex = sent.findIndex((m) => m.command === 'renderContent' && m.filePath === 'doc.md');
    expect(ackIndex).toBeGreaterThanOrEqual(0);
    expect(renderIndex).toBeGreaterThan(ackIndex);
    expect(renderIndex).toBeLessThan(resultIndex);
    expect(sent[renderIndex].markdownSource).toBe('# Open doc');
  });

  it('shows the File Not Found page when the open document is deleted', async () => {
    const root = new MemoryDir('entries-workspace');
    root.entries.set('doc.md', new MemoryFile('doc.md', '# Open doc'));
    post({ command: 'openFolder', handle: root, openFirstFile: false });
    await new Promise((resolve) => setTimeout(resolve, 300));
    post({ command: 'navigate', path: 'doc.md' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    sent.length = 0;

    post({ command: 'deleteWorkspaceEntries', requestId: 'd2', paths: ['doc.md'] });
    await new Promise((resolve) => setTimeout(resolve, 400));

    const resultIndex = sent.findIndex((m) => m.command === 'deleteWorkspaceEntriesResult');
    const renderIndex = sent.findIndex((m) => m.command === 'renderContent' && m.filePath === 'doc.md');
    expect(renderIndex).toBeGreaterThanOrEqual(0);
    expect(renderIndex).toBeLessThan(resultIndex);
    expect(sent[renderIndex].markdownSource).toContain('File Not Found');
  });

  it('answers unsupported when no workspace is open', async () => {
    post({ command: 'createWorkspaceEntry', requestId: 'u1', parentPath: '', name: 'a.md', kind: 'file' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent.find((m) => m.command === 'createWorkspaceEntryResult')).toMatchObject({ requestId: 'u1', ok: false, reason: 'unsupported' });
  });
});
