import { describe, expect, it, vi } from 'vitest';

import {
  createFileModeHandlers,
  WORKSPACE_SCAN_BATCH_SIZE,
  WORKSPACE_SCAN_REVEAL_DELAY_MS,
} from '../../../website-app/src/web-file-mode';
import { BrowserRecentWorkspaces } from '../../../website-app/src/recent-workspaces';
import { asFileHandle, memoryFile, MemoryFolder } from './memory-file-system';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function connect() {
  vi.spyOn(BrowserRecentWorkspaces, 'save').mockResolvedValue();
  vi.spyOn(BrowserRecentWorkspaces, 'load').mockResolvedValue([]);
  const send = vi.fn();
  const handlers = createFileModeHandlers({
    state: { activeHandle: null, activeWorkspacePath: '', activeWorkspaceName: '', currentFile: null,
      flatList: [], workspaceTree: null, searchIndex: null, singleFileHandle: null },
    send,
    hostInfo: () => ({}),
    findFileInfo: (files, relativePath) => files.find((file) => file.relativePath === relativePath) ?? { relativePath, title: relativePath },
    extractWorkspaceName: (path) => path,
    getWorkspaceOperationMetadata: () => ({ workspaceOperationId: 'test-scan' }),
  });
  return { ...handlers, send };
}

describe('demo file-mode workspace loading', () => {
  it('reveals the workspace shell after the shared 3-second threshold', () => {
    expect(WORKSPACE_SCAN_REVEAL_DELAY_MS).toBe(3000);
  });

  it('publishes cumulative workspace refreshes in 32-file batches', () => {
    expect(WORKSPACE_SCAN_BATCH_SIZE).toBe(32);
  });

  it('reveals a slow scan, publishes batches, then includes empty folders in the final tree', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { loadHandleWorkspace, send } = connect();
    const root = new MemoryFolder('guide');
    const first = deferred();
    const rest = deferred();
    const firstStarted = deferred();
    const restStarted = deferred();
    for (let index = 0; index < WORKSPACE_SCAN_BATCH_SIZE; index += 1) {
      const name = `note-${String(index).padStart(2, '0')}.md`;
      const file = memoryFile(name, '# Note');
      root.children.set(name, file);
      if (index === 0 || index === 1) {
        const original = file.getFile;
        vi.spyOn(file, 'getFile').mockImplementationOnce(async () => {
          (index === 0 ? firstStarted : restStarted).resolve();
          await (index === 0 ? first : rest).promise;
          return original();
        });
      } else {
        const original = file.getFile;
        vi.spyOn(file, 'getFile').mockImplementationOnce(async () => { await rest.promise; return original(); });
      }
    }
    root.children.set('empty', new MemoryFolder('empty'));
    const open = loadHandleWorkspace(root.asHandle(), false);
    await Promise.all([firstStarted.promise, restStarted.promise]);
    await vi.advanceTimersByTimeAsync(WORKSPACE_SCAN_REVEAL_DELAY_MS);
    expect(send.mock.calls.flat()).not.toContainEqual(expect.objectContaining({ command: 'readyAck' }));
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      command: 'readyAck', workspaceOperationId: 'test-scan', fileList: [expect.objectContaining({ fileName: 'note-00.md' })],
    }));
    rest.resolve();
    await expect(open).resolves.toBe(true);
    const updates = send.mock.calls.flat().filter((message) => message.command === 'workspaceFilesChanged');
    expect(updates.map((message) => message.fileList.length)).toEqual([WORKSPACE_SCAN_BATCH_SIZE, WORKSPACE_SCAN_BATCH_SIZE]);
    expect(updates[0].tree.children).toHaveLength(0);
    expect(updates.at(-1)?.tree.children).toMatchObject([{ name: 'empty', files: [], children: [] }]);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ command: 'renderContent', relativePath: 'Welcome Page' }));
    await vi.runAllTimersAsync();
  });

  it('does not render a scan after it is cancelled while reading a file', async () => {
    const host = connect();
    const folder = new MemoryFolder('slow');
    const started = deferred();
    const pending = deferred();
    const file = memoryFile('old.md', '# Stale');
    const original = file.getFile;
    vi.spyOn(file, 'getFile').mockImplementation(async () => { started.resolve(); await pending.promise; return original(); });
    folder.children.set(file.name, file);
    const open = host.loadHandleWorkspace(folder.asHandle());
    await started.promise;
    host.cancelWorkspaceScan();
    pending.resolve();
    await expect(open).resolves.toBe(false);
    expect(host.send.mock.calls.flat().map((message) => message.command)).not.toContain('renderContent');
    expect(host.send.mock.calls.flat().map((message) => message.command)).not.toContain('readyAck');
  });

  it('does not reveal a workspace cancelled while the recent workspace entry is being saved', async () => {
    const host = connect();
    const save = deferred();
    vi.mocked(BrowserRecentWorkspaces.save).mockReturnValueOnce(save.promise);
    const open = host.loadHandleWorkspace(new MemoryFolder('slow').asHandle());
    host.cancelWorkspaceScan();
    save.resolve();
    await expect(open).resolves.toBe(false);
    expect(host.send.mock.calls.flat()).not.toContainEqual(expect.objectContaining({ command: 'readyAck' }));
  });

  it('does not publish the first document if the workspace is cancelled during its read', async () => {
    const host = connect();
    const root = new MemoryFolder('slow');
    const file = memoryFile('slow.md', '# Old workspace');
    root.children.set(file.name, file);
    const original = file.getFile;
    const reading = deferred();
    const read = deferred();
    vi.spyOn(file, 'getFile').mockImplementationOnce(original).mockImplementationOnce(async () => {
      reading.resolve();
      await read.promise;
      return original();
    });
    const open = host.loadHandleWorkspace(root.asHandle());
    await reading.promise;
    host.cancelWorkspaceScan();
    read.resolve();
    await expect(open).resolves.toBe(false);
    expect(host.send.mock.calls.flat()).not.toContainEqual(expect.objectContaining({ command: 'renderContent' }));
  });

  it('suppresses a superseded file open while its metadata is pending', async () => {
    const host = connect();
    const file = memoryFile('old.md', '# Old');
    const metadata = deferred();
    const original = file.getFile;
    vi.spyOn(file, 'getFile').mockImplementation(async () => { await metadata.promise; return original(); });
    const stale = host.loadSingleFileWorkspace(asFileHandle(file));
    await expect(host.loadSingleFileWorkspace(asFileHandle(memoryFile('new.md', '# New')))).resolves.toBe(true);
    metadata.resolve();
    await expect(stale).resolves.toBe(false);
    const rendered = host.send.mock.calls.flat().filter((message) => message.command === 'renderContent');
    expect(rendered).toEqual([expect.objectContaining({ relativePath: 'new.md' })]);
  });

  it('suppresses a superseded file render while its content is pending', async () => {
    const host = connect();
    const file = memoryFile('old.md', '# Old');
    const reading = deferred();
    const read = deferred();
    const original = file.getFile;
    vi.spyOn(file, 'getFile').mockImplementationOnce(original).mockImplementationOnce(async () => {
      reading.resolve();
      await read.promise;
      return original();
    });
    const stale = host.loadSingleFileWorkspace(asFileHandle(file));
    await reading.promise;
    await expect(host.loadSingleFileWorkspace(asFileHandle(memoryFile('new.md', '# New')))).resolves.toBe(true);
    read.resolve();
    await expect(stale).resolves.toBe(false);
    const rendered = host.send.mock.calls.flat().filter((message) => message.command === 'renderContent');
    expect(rendered).toEqual([expect.objectContaining({ relativePath: 'new.md' })]);
  });
});
