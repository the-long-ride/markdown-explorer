import { beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';

class MemoryFile {
  readonly kind = 'file';
  constructor(readonly name: string) {}
  async getFile() {
    const file = { lastModified: 1, size: 0, text: async () => '' } as any;
    file.slice = () => file;
    return file;
  }
}
class MemoryDir {
  readonly kind = 'directory';
  readonly entries = new Map<string, MemoryDir | MemoryFile>();
  scanGate: Promise<void> | null = null;
  constructor(readonly name: string) {}
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  async *values() { if (this.scanGate) await this.scanGate; for (const entry of [...this.entries.values()]) yield entry; }
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
  (window as any).__webDemoBus.dispatchEvent(new CustomEvent('webview-message', { detail: msg }));
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hasFolder = (tree: any, folderPath: string) => Boolean(tree?.children?.some((child: any) => child.path === folderPath));

describe('website host workspace entry commands', () => {
  const sent: any[] = [];
  const listener = ((event: Event) => { sent.push((event as CustomEvent).detail); }) as EventListener;

  beforeAll(async () => {
    const { initWebHost } = await import('../../../website-app/src/web-host');
    initWebHost('file');
  });
  beforeEach(() => {
    sent.length = 0;
    (window as any).__webDemoBus.addEventListener('host-message', listener);
  });
  afterEach(() => {
    (window as any).__webDemoBus.removeEventListener('host-message', listener);
    post({ command: 'closeWorkspace' });
  });

  it('publishes the rescanned tree (with the new empty folder) before the create reply', async () => {
    const root = new MemoryDir('site-workspace');
    post({ command: 'openFolder', handle: root, openFirstFile: false });
    await wait(300);
    sent.length = 0;

    post({ command: 'createWorkspaceEntry', requestId: 'c1', parentPath: '', name: 'empty-dir', kind: 'folder' });
    await wait(300);

    const resultIndex = sent.findIndex((m) => m.command === 'createWorkspaceEntryResult');
    expect(sent[resultIndex]).toMatchObject({ requestId: 'c1', ok: true, kind: 'folder', path: 'empty-dir' });
    const treeIndex = sent.findIndex((m) => m.command === 'workspaceFilesChanged' && hasFolder(m.tree, 'empty-dir'));
    expect(treeIndex).toBeGreaterThanOrEqual(0);
    expect(treeIndex).toBeLessThan(resultIndex);
    expect(sent[treeIndex]).toMatchObject({ workspaceName: 'site-workspace', workspacePath: 'site-workspace' });
  });

  it('deletes permanently and publishes the shrunken file list before the reply', async () => {
    const root = new MemoryDir('site-workspace');
    root.entries.set('old.md', new MemoryFile('old.md'));
    post({ command: 'openFolder', handle: root, openFirstFile: false });
    await wait(300);
    sent.length = 0;

    post({ command: 'deleteWorkspaceEntries', requestId: 'd1', paths: ['old.md'] });
    await wait(300);

    const resultIndex = sent.findIndex((m) => m.command === 'deleteWorkspaceEntriesResult');
    expect(sent[resultIndex]).toMatchObject({ requestId: 'd1', mode: 'permanent', deleted: ['old.md'], failed: [] });
    const treeIndex = sent.findIndex((m) => m.command === 'workspaceFilesChanged' && m.fileList.length === 0);
    expect(treeIndex).toBeGreaterThanOrEqual(0);
    expect(treeIndex).toBeLessThan(resultIndex);
    expect(root.entries.size).toBe(0);
  });

  it('a scan that finishes after the workspace changed writes no state and sends nothing', async () => {
    const rootA = new MemoryDir('workspace-a');
    rootA.entries.set('a.md', new MemoryFile('a.md'));
    post({ command: 'openFolder', handle: rootA, openFirstFile: false });
    await wait(300);

    let release!: () => void;
    rootA.scanGate = new Promise<void>((resolve) => { release = resolve; });
    post({ command: 'createWorkspaceEntry', requestId: 'stale', parentPath: '', name: 'extra', kind: 'folder' });
    await wait(50);

    const rootB = new MemoryDir('workspace-b');
    rootB.entries.set('b.md', new MemoryFile('b.md'));
    post({ command: 'openFolder', handle: rootB, openFirstFile: false });
    await wait(300);
    sent.length = 0;
    release();
    await wait(200);

    expect(sent.find((m) => m.command === 'workspaceFilesChanged')).toBeUndefined();
    expect(sent.find((m) => m.command === 'createWorkspaceEntryResult')).toMatchObject({ requestId: 'stale', ok: true });
    sent.length = 0;
    post({ command: 'loadWorkspaceSearchIndexes', tabs: [{ tabId: 't1', workspacePath: 'workspace-b' }] });
    await wait(50);
    const loaded = sent.find((m) => m.command === 'workspaceSearchIndexLoaded');
    expect(loaded.tabs[0].fileList.map((file: any) => file.relativePath)).toEqual(['b.md']);
    expect(loaded.tabs[0].tree.children.some((child: any) => child.path === 'extra')).toBe(false);
  });

  it('answers unsupported when no folder workspace is open', async () => {
    post({ command: 'createWorkspaceEntry', requestId: 'u1', parentPath: '', name: 'a.md', kind: 'file' });
    await wait(50);
    expect(sent.find((m) => m.command === 'createWorkspaceEntryResult')).toMatchObject({ requestId: 'u1', ok: false, reason: 'unsupported' });
  });
});
