import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWebBus, initWebHost } from '../../../website-app/src/web-host';
import { BrowserRecentWorkspaces } from '../../../website-app/src/recent-workspaces';
import { createUserVirtualWorkspace, listUserVirtualWorkspaces } from '../../../website-app/src/user-virtual-workspaces';
import { refreshVirtualWorkspace } from '../../../website-app/src/virtual-workspace';
import { asFileHandle, memoryFile, MemoryFolder } from './memory-file-system';

type Message = Record<string, unknown>;
const bus = getWebBus();
const messages: Message[] = [];
const receive = (event: Event) => messages.push((event as CustomEvent<Message>).detail);
const post = (command: string, payload: Message = {}) => {
  bus.dispatchEvent(new CustomEvent('webview-message', { detail: { command, ...payload } }));
};
async function reply(command: string, payload: Message, expected: Message) {
  const start = messages.length;
  post(command, payload);
  await vi.waitFor(() => expect(messages.slice(start)).toContainEqual(expect.objectContaining(expected)));
  return messages.slice(start);
}

beforeEach(() => {
  messages.length = 0;
  initWebHost('web');
  bus.addEventListener('host-message', receive);
});
afterEach(() => {
  bus.removeEventListener('host-message', receive);
  refreshVirtualWorkspace();
});

describe('website host protocol', () => {
  it('starts in the newest virtual workspace and supports navigation, conversion, refresh and close', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const older = createUserVirtualWorkspace('Older');
    now.mockReturnValue(2000);
    const latest = createUserVirtualWorkspace('Latest');
    expect(listUserVirtualWorkspaces()).toHaveLength(2);
    await reply('ready', { documentConversion: true }, {
      command: 'renderContent', relativePath: 'Welcome.md',
    });
    expect(messages).toContainEqual(expect.objectContaining({ command: 'readyAck', workspacePath: latest.path, documentConversionEnabled: true }));
    await reply('refresh', {}, { command: 'renderContent', relativePath: 'Welcome.md' });
    await reply('setDocumentConversion', { enabled: false }, { command: 'renderContent', documentConversionEnabled: false });
    expect(localStorage.getItem('documentConversion')).toBe('false');
    await reply('openSpecificFolder', { folderPath: older.path, openFirstFile: false }, { command: 'readyAck', workspacePath: older.path });
    await reply('navigate', { path: '#' }, { command: 'renderContent', relativePath: 'Welcome Page' });
    await reply('navigate', { path: 'Welcome.md' }, { command: 'renderContent', relativePath: 'Welcome.md' });
    await reply('navigate', { path: 'absent.md' }, { command: 'navNotFound', href: 'absent.md' });
    await reply('activateWorkspace', { workspacePath: latest.path, filePath: 'Welcome.md' }, { command: 'renderContent', relativePath: 'Welcome.md' });
    await reply('removeWorkspace', { workspacePath: older.path }, { command: 'recentWorkspacesChanged' });
    expect(listUserVirtualWorkspaces()).toMatchObject([{ path: latest.path }]);
    await reply('closeWorkspace', {}, { command: 'readyAck', fileList: [] });
    await reply('ready', { openFirstFile: false }, { command: 'readyAck', workspaceName: '', fileList: [] });
  });

  it('opens a virtual workspace for a drop and updates it on subsequent drops', async () => {
    post('openDroppedFiles', { files: {} });
    post('openDroppedFiles', { files: [] });
    await reply('openDroppedFiles', { files: [{ name: 'index.md', content: '# First' }] }, {
      command: 'renderContent', relativePath: 'index.md', markdownSource: '# First',
    });
    await reply('openDroppedFiles', { files: [
      { name: 'index.md', content: '# Updated' },
      { name: 'readme.md', content: '# Additional' },
    ] }, { command: 'renderContent', relativePath: 'index.md', markdownSource: '# Updated' });
    expect(listUserVirtualWorkspaces()).toHaveLength(1);
    await reply('navigate', { path: 'readme.md' }, { command: 'renderContent', markdownSource: '# Additional' });
    await reply('createVirtualWorkspace', { name: 'Scratchpad', type: 'createVirtualWorkspace' }, {
      command: 'readyAck', workspaceName: 'Scratchpad',
    });
    await reply('ready', { openFirstFile: false }, { command: 'readyAck', workspaceName: 'Scratchpad' });
    await reply('openDroppedFiles', { files: [{ name: 'example.html', content: '<h1>Virtual HTML</h1>' }] }, {
      command: 'renderContent', relativePath: 'example.html', documentWrite: expect.objectContaining({ supported: false }),
    });
    await reply('openDroppedFiles', { files: [{ name: 'plain.txt', content: 'Virtual text' }] }, {
      command: 'renderContent', relativePath: 'plain.txt', markdownSource: 'Virtual text',
    });
  });

  it('keeps welcome views after opening without a first file', async () => {
    const virtual = createUserVirtualWorkspace('Virtual welcome');
    await reply('openSpecificFolder', { path: virtual.path, openFirstFile: false }, { command: 'renderContent', relativePath: 'Welcome Page' });
    const first = await reply('refresh', {}, { command: 'readyAck', workspacePath: virtual.path });
    expect(first).not.toContainEqual(expect.objectContaining({ command: 'renderContent' }));
    await reply('setDocumentConversion', { enabled: true }, { command: 'workspaceFilesChanged', documentConversionEnabled: true });
    await reply('ready', { openFirstFile: false }, { command: 'renderContent', relativePath: 'Welcome Page' });
    post('ready');
    const next = await reply('listDesktopFonts', { requestId: 'font' }, { command: 'desktopFontsResult', fonts: [] });
    expect(next).not.toContainEqual(expect.objectContaining({ command: 'readyAck' }));

    const folder = new MemoryFolder('folder');
    folder.children.set('note.md', memoryFile('note.md', '# Folder'));
    await reply('openFolder', { handle: folder.asHandle(), openFirstFile: false }, { command: 'renderContent', relativePath: 'Welcome Page' });
    const refreshed = await reply('refresh', {}, { command: 'readyAck', workspacePath: folder.name });
    expect(refreshed).not.toContainEqual(expect.objectContaining({ command: 'renderContent' }));
    await reply('setDocumentConversion', { enabled: false }, { command: 'workspaceFilesChanged', documentConversionEnabled: false });
  });

  it('renders and converts sample files added to the test workspace', async () => {
    initWebHost('test');
    await reply('ready', {}, { command: 'renderContent', relativePath: 'test-basic.md' });
    await reply('saveDocument', {}, { command: 'saveDocumentResult', ok: true, filePath: '', revision: '0' });
    await reply('saveDocument', { filePath: 'sample.mdx', source: '---\nmetadata\nauthor: Sample\ntitle: "Demo title"\n---\n# Other' }, {
      command: 'saveDocumentResult', ok: true,
    });
    await reply('saveDocument', { filePath: 'README', source: '# Fixture' }, { command: 'saveDocumentResult', ok: true });
    await reply('saveDocument', { filePath: 'draft.txt', source: 'Plain text' }, { command: 'saveDocumentResult', ok: true });
    await reply('saveDocument', { filePath: 'example.html', source: '<h2>Imported</h2>' }, { command: 'saveDocumentResult', ok: true });
    await reply('navigate', { path: 'sample.mdx' }, { command: 'renderContent', title: 'Demo title' });
    await reply('loadSearchPreview', { filePath: 'README' }, { command: 'searchPreviewResult', ok: true, markdownSource: '# Fixture' });
    await reply('navigate', { path: 'draft.txt' }, {
      command: 'renderContent', markdownSource: 'Plain text', documentWrite: expect.objectContaining({ supported: true }),
    });
    await reply('navigate', { path: 'example.html' }, {
      command: 'renderContent', markdownSource: '## Imported', sourceDocumentText: '<h2>Imported</h2>',
      documentWrite: expect.objectContaining({ supported: false }),
    });
    await reply('activateWorkspace', {}, { command: 'renderContent', relativePath: 'example.html' });
    await reply('setDocumentConversion', { enabled: true }, { command: 'workspaceFilesChanged', documentConversionEnabled: true });
  });

  it('keeps the current document when a different file is renamed', async () => {
    const folder = new MemoryFolder('folder');
    const notes = new MemoryFolder('notes');
    notes.children.set('guide.md', memoryFile('guide.md', '# Guide'));
    folder.children.set('notes', notes);
    folder.children.set('other.md', memoryFile('other.md', '# Other'));
    await reply('openFolder', { handle: folder.asHandle() }, { command: 'renderContent', relativePath: 'notes/guide.md' });
    await reply('renameWorkspaceEntry', { path: 'other.md', name: 'renamed.md', kind: 'file' }, { command: 'renameWorkspaceEntryResult', ok: true });
    await reply('refresh', {}, { command: 'renderContent', relativePath: 'notes/guide.md' });
    await reply('renameWorkspaceEntry', { path: 'notes', name: 'docs', kind: 'folder' }, { command: 'renameWorkspaceEntryResult', ok: true });
    await reply('refresh', {}, { command: 'renderContent', relativePath: 'docs/guide.md' });
  });

  it('converts HTML picked from a directory while retaining the read-only preview', async () => {
    const folder = new MemoryFolder('folder');
    folder.children.set('guide.html', memoryFile('guide.html', '<h1>Guide</h1>'));
    post('setDocumentConversion', { enabled: true });
    await vi.waitFor(() => expect(localStorage.getItem('documentConversion')).toBe('true'));
    await reply('openFolder', { handle: folder.asHandle() }, {
      command: 'renderContent', relativePath: 'guide.html', markdownSource: '# Guide',
      documentWrite: expect.objectContaining({ supported: false }),
    });
  });

  it('ignores a stale file picker result after switching to another file', async () => {
    let selected!: (files: FileSystemFileHandle[]) => void;
    const pending = new Promise<FileSystemFileHandle[]>((resolve) => { selected = resolve; });
    const picker = vi.fn().mockReturnValue(pending);
    vi.stubGlobal('showOpenFilePicker', picker);
    post('openFile', { workspaceOperationId: 'old', workspaceTabId: 'tab' });
    await vi.waitFor(() => expect(picker).toHaveBeenCalledOnce());
    await reply('openFileHandle', {
      handle: asFileHandle(memoryFile('current.md', '# Current')), workspaceOperationId: 'current', workspaceTabId: 'tab',
    }, { command: 'renderContent', relativePath: 'current.md' });
    selected([asFileHandle(memoryFile('stale.md', '# Stale'))]);
    await reply('refresh', {}, { command: 'renderContent', relativePath: 'current.md' });
    expect(messages).not.toContainEqual(expect.objectContaining({ relativePath: 'stale.md' }));
  });

  it('opens a single file, refreshes it, and renders missing-file errors', async () => {
    const html = '<h1>Local document</h1>';
    const file = memoryFile('notes.html', html);
    const picker = vi.fn().mockResolvedValue([asFileHandle(file)]);
    vi.stubGlobal('showOpenFilePicker', picker);
    post('setDocumentConversion', { enabled: true });
    await vi.waitFor(() => expect(localStorage.getItem('documentConversion')).toBe('true'));
    await reply('openFile', {}, { command: 'renderContent', relativePath: 'notes.html' });
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ types: expect.any(Array) }));
    await reply('refresh', {}, { command: 'renderContent', relativePath: 'notes.html' });
    await reply('navigate', { path: 'notes.html#local' }, { command: 'renderContent', relativePath: 'notes.html' });
    await reply('setDocumentConversion', { enabled: false }, { command: 'renderContent', documentConversionEnabled: false });

    const gone = memoryFile('removed.md');
    vi.spyOn(gone, 'getFile').mockRejectedValue(new DOMException('gone', 'NotFoundError'));
    await reply('openFileHandle', { handle: asFileHandle(gone) }, {
      command: 'renderContent', markdownSource: expect.stringContaining('File Not Found'),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    picker.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));
    post('openFile');
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('Single file selection'), expect.anything()));
  });

  it('opens, renames and refreshes a directory, then activates and removes recents', async () => {
    const folder = new MemoryFolder('guide');
    folder.children.set('guide.md', memoryFile('guide.md', '# Guide'));
    const locked = new MemoryFolder('locked', 'denied');
    vi.spyOn(BrowserRecentWorkspaces, 'getHandle').mockImplementation(async (path) =>
      path === 'guide' ? folder.asHandle() : path === 'locked' ? locked.asHandle() : null,
    );
    vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(folder.asHandle()));
    const operation = { workspaceOperationId: 'open', workspaceTabId: 'tab' };
    await reply('openFolder', { ...operation, replaceRecentWorkspacePath: 'old' }, {
      command: 'renderContent', relativePath: 'guide.md', markdownSource: '# Guide', ...operation,
    });
    await reply('renameWorkspaceEntry', { path: 'guide.md', name: 'moved.md', kind: 'file' }, {
      command: 'renameWorkspaceEntryResult', ok: true, path: 'moved.md',
    });
    await reply('refresh', {}, { command: 'renderContent', relativePath: 'moved.md' });
    await reply('setDocumentConversion', { enabled: true }, { command: 'renderContent', documentConversionEnabled: true });
    await reply('ready', {}, { command: 'renderContent', relativePath: 'moved.md' });
    await reply('navigate', { path: 'moved.md' }, { command: 'renderContent', relativePath: 'moved.md' });
    await reply('activateWorkspace', { workspacePath: 'guide', filePath: 'moved.md' }, {
      command: 'renderContent', relativePath: 'moved.md',
    });
    await reply('openRecentWorkspace', { path: 'guide', openFirstFile: true }, { command: 'renderContent', relativePath: 'moved.md' });
    await reply('openRecentWorkspace', { path: 'locked' }, { command: 'workspaceUnavailable', reason: 'locked' });
    await reply('openRecentWorkspace', { path: 'missing' }, { command: 'workspaceUnavailable', reason: 'missing' });
    await reply('deleteRecentWorkspace', { path: 'guide' }, { command: 'recentWorkspacesChanged' });
  });

  it('cancels missing or rejected pickers and invalidates a stale picker result', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let complete!: (handle: FileSystemDirectoryHandle) => void;
    const pending = new Promise<FileSystemDirectoryHandle>((resolve) => { complete = resolve; });
    const picker = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new DOMException('cancel', 'AbortError')).mockReturnValueOnce(pending);
    vi.stubGlobal('showDirectoryPicker', picker);
    const operation = { workspaceOperationId: 'open', workspaceTabId: 'tab' };
    await reply('openFolder', operation, { command: 'workspaceOpenCancelled', ...operation });
    await reply('openFolder', operation, { command: 'workspaceOpenCancelled', ...operation });
    expect(warn).toHaveBeenCalledOnce();
    post('openFolder', operation);
    await vi.waitFor(() => expect(picker).toHaveBeenCalledTimes(3));
    post('cancelWorkspaceScan', { workspaceOperationId: 'wrong' });
    await reply('cancelWorkspaceScan', { workspaceOperationId: 'open' }, {
      command: 'workspaceScanProgress', active: false, ...operation,
    });
    complete(new MemoryFolder('stale').asHandle());
    await reply('closeWorkspace', {}, { command: 'readyAck', fileList: [] });
    expect(messages).not.toContainEqual(expect.objectContaining({ workspaceName: 'stale' }));
    post('cancelAllWorkspaceScans');
  });

  it('serves demo mode over the same bus without invoking native file pickers', async () => {
    initWebHost('test');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    await reply('ready', { documentConversion: true }, { command: 'readyAck', documentConversionEnabled: true });
    post('ready');
    post('unknown');
    await reply('readInsightsDocumentSource', { relativePath: 'test-basic.md' }, { command: 'insightsDocumentSourceResult', status: 'ok' });
    expect(messages.filter(({ command }) => command === 'readyAck')).toHaveLength(1);
    await reply('refresh', {}, { command: 'readyAck', workspaceName: expect.any(String) });
    await reply('activateWorkspace', { filePath: 'missing.md' }, { command: 'renderContent', relativePath: 'test-basic.md' });
    await reply('readWorkspaceTextResource', { resourcePath: 'demo.css' }, { command: 'workspaceTextResourceResult', reason: 'unsupported' });
    await reply('searchWorkspace', {}, { command: 'workspaceSearchResults', total: 0, done: true });
    await reply('loadSearchPreview', {}, { command: 'searchPreviewResult', ok: false });
    post('openExternal', { url: 'about:blank' });
    post('openExternal', { url: 'https://example.test' });
    await vi.waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith('https://example.test', '_blank'));
    await reply('closeWorkspace', {}, { command: 'readyAck', fileList: [] });
  });
});
